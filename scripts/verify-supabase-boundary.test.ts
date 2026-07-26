import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
	checkBoundary,
	collectAccesses,
	isRuntimeFile,
	scanSource,
	validateManifest,
	type Manifest,
	type ManifestEntry,
	type Suppression
} from './verify-supabase-boundary';

let root: string;

function writeSourceFile(relPath: string, content: string): void {
	const full = join(root, relPath);
	mkdirSync(dirname(full), { recursive: true });
	writeFileSync(full, content);
}

function tableEntry(file: string, name: string): ManifestEntry {
	return {
		file,
		kind: 'table',
		name,
		classification: 'shared-data-debt',
		plannedRemovalPr: 'PR-03',
		disposition: 'Replace with the Parchment contract cutover in PR-03.'
	};
}

function suppression(file: string, kind: Suppression['kind'], name: string): Suppression {
	return { file, kind, name, reason: 'Not Supabase: unrelated API sharing the shape.' };
}

function manifestOf(...entries: ManifestEntry[]): Manifest {
	return { entries };
}

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), 'supabase-boundary-'));
	mkdirSync(join(root, 'src'), { recursive: true });
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

describe('scanSource', () => {
	it('detects table, rpc, admin-client, factory, and auth-session candidates', () => {
		const source = [
			"import { createServerClient } from '@supabase/ssr';",
			"import { createAdminClient } from '$lib/supabase-admin';",
			"const { data } = await supabase.from('coffee_catalog').select('*');",
			"await supabase.rpc('get_supplier_price_ranges', { days: 30 });",
			'await supabase.auth.getSession();'
		].join('\n');

		expect(scanSource(source, 'src/lib/example.ts')).toEqual([
			{ file: 'src/lib/example.ts', kind: 'client-factory', name: 'createServerClient' },
			{ file: 'src/lib/example.ts', kind: 'admin-client', name: 'createAdminClient' },
			{ file: 'src/lib/example.ts', kind: 'table', name: 'coffee_catalog' },
			{ file: 'src/lib/example.ts', kind: 'rpc', name: 'get_supplier_price_ranges' },
			{ file: 'src/lib/example.ts', kind: 'auth-session', name: 'getSession' }
		]);
	});

	it('skips builtin from() receivers including Node stream types', () => {
		const source = [
			"const letters = Array.from('abcdef');",
			"const bytes = Uint8Array.from('123');",
			'const items = Array.from({ length: 5 }, (_, i) => i);',
			"const buf = Buffer.from('payload');",
			'const stream = Readable.from(rows);'
		].join('\n');

		expect(scanSource(source, 'src/lib/example.ts')).toEqual([]);
	});

	it('detects receiver-independent from/rpc calls (structural casts, unknown clients)', () => {
		const source = [
			'const memoryClient = client as MemoryClient;',
			"await memoryClient.from('user_memory').select('*');",
			"await transport.rpc('health.check');"
		].join('\n');

		expect(scanSource(source, 'src/lib/server/userMemory.ts')).toEqual([
			{ file: 'src/lib/server/userMemory.ts', kind: 'table', name: 'user_memory' },
			{ file: 'src/lib/server/userMemory.ts', kind: 'rpc', name: 'health.check' }
		]);
	});

	it('preserves repeated call-site counts for identical candidates', () => {
		const source = [
			"await first.from('workspaces').select('*');",
			"await second.from('workspaces').select('*');"
		].join('\n');

		expect(scanSource(source, 'src/lib/server/workspaces.ts')).toEqual([
			{ file: 'src/lib/server/workspaces.ts', kind: 'table', name: 'workspaces', count: 2 }
		]);
	});

	it('detects schema-qualified data calls', () => {
		const source = "await supabase.schema('private').from('hidden_table').select('*');";
		expect(scanSource(source, 'src/lib/example.ts')).toEqual([
			{ file: 'src/lib/example.ts', kind: 'table', name: 'hidden_table' }
		]);
	});

	it('detects auth chains regardless of receiver, including aliases and factories', () => {
		const source = [
			'await supabase.auth.resend({ type: "signup", email });',
			'await supabase.auth.admin.deleteUser(userId);',
			'const auth = supabase.auth;',
			'await auth.linkIdentity(identity);',
			'await db.auth.getUser(token);',
			'await createAdminClient().auth.getUser(token);'
		].join('\n');

		expect(scanSource(source, 'src/lib/example.ts')).toEqual([
			{ file: 'src/lib/example.ts', kind: 'auth-session', name: 'resend' },
			{ file: 'src/lib/example.ts', kind: 'auth-session', name: 'deleteUser' },
			{ file: 'src/lib/example.ts', kind: 'auth-session', name: '<memberAccess>' },
			{ file: 'src/lib/example.ts', kind: 'auth-session', name: 'linkIdentity' },
			{ file: 'src/lib/example.ts', kind: 'auth-session', name: 'getUser', count: 2 },
			{ file: 'src/lib/example.ts', kind: 'admin-client', name: 'createAdminClient' }
		]);
	});

	it('does not chase aliases, but records protected namespace escapes at their syntax site', () => {
		expect(scanSource('oauth2.authorize(); reauthorize();', 'src/lib/example.ts')).toEqual([]);

		expect(
			scanSource('const session = supabase.auth; await session.getUser(token);', 'src/lib/a.ts')
		).toEqual([{ file: 'src/lib/a.ts', kind: 'auth-session', name: '<memberAccess>' }]);

		expect(
			scanSource(
				'const { auth: identity } = client; await identity.getUser(token);',
				'src/lib/alias.ts'
			)
		).toEqual([{ file: 'src/lib/alias.ts', kind: 'auth-session', name: '<memberAccess>' }]);

		expect(
			scanSource(
				'function validate({ auth: identity }: SupabaseClient) { return identity.getUser(token); }',
				'src/lib/parameter-alias.ts'
			)
		).toEqual([
			{ file: 'src/lib/parameter-alias.ts', kind: 'auth-session', name: '<memberAccess>' }
		]);

		expect(scanSource('const header = request.auth.token;', 'src/lib/b.ts')).toEqual([
			{ file: 'src/lib/b.ts', kind: 'auth-session', name: '<memberAccess>' }
		]);

		expect(scanSource('await supabase.auth.getUser(token);', 'src/lib/c.ts')).toEqual([
			{ file: 'src/lib/c.ts', kind: 'auth-session', name: 'getUser' }
		]);
	});

	it.each([
		['destructuring', 'const { auth: identity } = client;', 'auth-session', '<memberAccess>'],
		['assignment', 'let identity; identity = client.auth;', 'auth-session', '<memberAccess>'],
		[
			'destructuring assignment',
			'let identity; ({ auth: identity } = client);',
			'auth-session',
			'<memberAccess>'
		],
		[
			'default parameter',
			'function validate(client = supabase.auth) {}',
			'auth-session',
			'<memberAccess>'
		],
		[
			'regular parameter',
			'function validate(client: Client) { return client.auth; }',
			'auth-session',
			'<memberAccess>'
		],
		[
			'destructured default parameter',
			'function validate({ auth: identity } = client) {}',
			'auth-session',
			'<memberAccess>'
		],
		[
			'destructured regular parameter',
			'function validate({ auth: identity }: Client) {}',
			'auth-session',
			'<memberAccess>'
		],
		['argument', 'consume(client.auth);', 'auth-session', '<memberAccess>'],
		['return', 'function get(client) { return client.auth; }', 'auth-session', '<memberAccess>'],
		[
			'object property',
			'const value = { session: client.auth };',
			'auth-session',
			'<memberAccess>'
		],
		['module export', 'export const sessionAuth = client.auth;', 'auth-session', '<memberAccess>'],
		[
			'service destructuring',
			'const { functions: edge } = client;',
			'service',
			'functions.<memberAccess>'
		],
		['service assignment', 'const edge = client.functions;', 'service', 'functions.<memberAccess>']
	] as const)(
		'records the %s protected namespace escape without alias chasing',
		(_, source, kind, name) => {
			expect(scanSource(source, 'src/lib/escape.ts')).toEqual([
				{ file: 'src/lib/escape.ts', kind, name }
			]);
		}
	);

	it('detects Supabase service operations (functions, storage, realtime, channel)', () => {
		const source = [
			"await supabase.functions.invoke('send-email', { body });",
			"await supabase.storage.from('avatars').upload(path, file);",
			"const room = supabase.channel('room-1');",
			'client.realtime.setAuth(token);'
		].join('\n');

		expect(scanSource(source, 'src/lib/example.ts')).toEqual([
			{ file: 'src/lib/example.ts', kind: 'service', name: 'functions.invoke' },
			{ file: 'src/lib/example.ts', kind: 'service', name: 'storage.upload' },
			{ file: 'src/lib/example.ts', kind: 'table', name: 'avatars' },
			{ file: 'src/lib/example.ts', kind: 'service', name: 'storage.from' },
			{ file: 'src/lib/example.ts', kind: 'service', name: 'channel' },
			{ file: 'src/lib/example.ts', kind: 'service', name: 'realtime.setAuth' }
		]);
	});

	it('detects factory calls without import provenance (local wrappers, aliases)', () => {
		const source = [
			"import { createClient } from '$lib/supabase';",
			'const db = createClient(fetch);',
			'const load = createSupabaseLoadClient(fetch, session);'
		].join('\n');

		expect(scanSource(source, 'src/lib/example.ts')).toEqual([
			{ file: 'src/lib/example.ts', kind: 'client-factory', name: 'createClient' },
			{ file: 'src/lib/example.ts', kind: 'client-factory', name: 'createSupabaseLoadClient' }
		]);
	});

	it('records known factory imports from local Supabase modules before aliasing', () => {
		const source = [
			"import { createBrowserClient as build } from '$lib/supabase';",
			'const client = build(fetch);'
		].join('\n');

		expect(scanSource(source, 'src/lib/feature.ts')).toEqual([
			{ file: 'src/lib/feature.ts', kind: 'client-factory', name: 'createBrowserClient' }
		]);
	});

	it('detects named and star re-exports from Supabase modules', () => {
		expect(
			scanSource(
				"export { createClient as makeClient } from '@supabase/supabase-js';",
				'src/lib/barrel.ts'
			)
		).toEqual([
			{ file: 'src/lib/barrel.ts', kind: 'client-factory', name: 'reexport:createClient' }
		]);

		expect(scanSource("export * from '@supabase/supabase-js';", 'src/lib/star.ts')).toEqual([
			{ file: 'src/lib/star.ts', kind: 'client-factory', name: 'starReexport' }
		]);

		expect(
			scanSource("export { createAdminClient as makeDb } from './supabase-admin';", 'src/lib/b.ts')
		).toEqual([
			{ file: 'src/lib/b.ts', kind: 'admin-client', name: 'createAdminClient' },
			{ file: 'src/lib/b.ts', kind: 'client-factory', name: 'reexport:createAdminClient' }
		]);
	});

	it('ignores type-only imports and exports', () => {
		const source = [
			"import type { SupabaseClient } from '@supabase/supabase-js';",
			"export type { Database } from '$lib/supabase';"
		].join('\n');

		expect(scanSource(source, 'src/lib/types.ts')).toEqual([]);
	});

	it('ignores Supabase-looking text in comments and strings', () => {
		const source = [
			"// await supabase.from('commented_table').select('*');",
			'const example = "supabase.rpc(\'string_rpc\')";',
			'/* createAdminClient(); supabase.auth.getUser(); */'
		].join('\n');

		expect(scanSource(source, 'src/lib/example.ts')).toEqual([]);
	});

	it('fails closed on nonliteral table and rpc resources', () => {
		const source = [
			"await supabase.from(tableName).select('*');",
			'await supabase.rpc(functionName);'
		].join('\n');

		expect(scanSource(source, 'src/lib/example.ts')).toEqual([
			{ file: 'src/lib/example.ts', kind: 'table', name: '<dynamic>' },
			{ file: 'src/lib/example.ts', kind: 'rpc', name: '<dynamic>' }
		]);
	});

	it('detects computed access, namespace imports, and dynamic imports', () => {
		const source = [
			"import * as sb from '@supabase/supabase-js';",
			"await supabase['from']('computed_table').select('*');",
			"const direct = sb.createClient('url', 'key');",
			"const lazy = import('@supabase/supabase-js');"
		].join('\n');

		expect(scanSource(source, 'scripts/example.mjs')).toEqual([
			{ file: 'scripts/example.mjs', kind: 'client-factory', name: 'namespaceImport' },
			{ file: 'scripts/example.mjs', kind: 'table', name: 'computed_table' },
			{ file: 'scripts/example.mjs', kind: 'client-factory', name: 'createClient' },
			{ file: 'scripts/example.mjs', kind: 'client-factory', name: 'dynamicImport' }
		]);
	});

	it('detects CommonJS Supabase requires', () => {
		const source = [
			"const { createClient } = require('@supabase/supabase-js');",
			"createClient('url', 'key');"
		].join('\n');

		expect(scanSource(source, 'scripts/example.cjs')).toEqual([
			{ file: 'scripts/example.cjs', kind: 'client-factory', name: 'commonJsRequire' },
			{ file: 'scripts/example.cjs', kind: 'client-factory', name: 'createClient' }
		]);
	});

	it('scans Svelte instance and module script blocks via svelte/compiler', () => {
		const source = [
			'<script lang="ts" module>',
			"await supabase.rpc('module_rpc');",
			'</script>',
			'<script lang="ts">',
			"await supabase.from('coffee_catalog').select('*');",
			'</script>',
			'<p>catalog</p>'
		].join('\n');

		expect(scanSource(source, 'src/routes/catalog/+page.svelte')).toEqual([
			{ file: 'src/routes/catalog/+page.svelte', kind: 'table', name: 'coffee_catalog' },
			{ file: 'src/routes/catalog/+page.svelte', kind: 'rpc', name: 'module_rpc' }
		]);
	});

	it('flags Supabase-shaped markup operations regardless of receiver name', () => {
		const source = [
			'<script lang="ts">',
			"import { supabase } from '$lib/supabase';",
			'const db = supabase;',
			'</script>',
			'<button onclick={() => supabase.auth.signOut()}>Sign out</button>',
			"<p>{db.from('hidden_table')}</p>"
		].join('\n');

		const accesses = scanSource(source, 'src/routes/account/+page.svelte');
		expect(accesses).toContainEqual({
			file: 'src/routes/account/+page.svelte',
			kind: 'markup',
			name: 'auth'
		});
		expect(accesses).toContainEqual({
			file: 'src/routes/account/+page.svelte',
			kind: 'markup',
			name: 'from'
		});
	});

	it('flags bare protected namespace members in Svelte expressions', () => {
		const source = [
			'<script lang="ts">',
			'const client = getClient();',
			'</script>',
			'<Widget auth={client.auth} service={client.functions} />',
			'{client.storage}'
		].join('\n');

		expect(scanSource(source, 'src/routes/account/+page.svelte')).toEqual([
			{ file: 'src/routes/account/+page.svelte', kind: 'markup', name: 'auth' },
			{ file: 'src/routes/account/+page.svelte', kind: 'markup', name: 'functions' },
			{ file: 'src/routes/account/+page.svelte', kind: 'markup', name: 'storage' }
		]);
	});

	it('does not flag scalar supabase-named markup values or builtin calls', () => {
		const source = [
			'<script lang="ts">',
			"await supabase.from('coffee_catalog').select('*');",
			'const supabaseStatus = "ok";',
			'</script>',
			'<p>{supabaseStatus}</p>',
			'<p>{Array.from(items).length} items from {supplierName}</p>',
			'<span class="supabase-note">plain text mentioning supabase is fine</span>'
		].join('\n');

		expect(scanSource(source, 'src/routes/catalog/+page.svelte')).toEqual([
			{ file: 'src/routes/catalog/+page.svelte', kind: 'table', name: 'coffee_catalog' }
		]);
	});

	it('fails closed on unparseable Svelte files', () => {
		expect(() => scanSource('<script>const x = ;</script>', 'src/routes/bad/+page.svelte')).toThrow(
			/Failed to parse Svelte file/
		);
	});
});

describe('isRuntimeFile', () => {
	it('scans .ts and .svelte runtime files and skips tests and fixtures', () => {
		expect(isRuntimeFile('src/lib/data/inventory.ts')).toBe(true);
		expect(isRuntimeFile('src/lib/components/layout/AuthSidebar.svelte')).toBe(true);
		expect(isRuntimeFile('scripts/backfill-supply-index.ts')).toBe(true);
		expect(isRuntimeFile('scripts/validate-schemas.js')).toBe(true);
		expect(isRuntimeFile('scripts/check-env-contract.mjs')).toBe(true);
		expect(isRuntimeFile('scripts/tool.cjs')).toBe(true);
		expect(isRuntimeFile('src/lib/data/inventory.test.ts')).toBe(false);
		expect(isRuntimeFile('src/lib/data/inventory.spec.ts')).toBe(false);
		expect(isRuntimeFile('src/test-setup.ts')).toBe(false);
		expect(isRuntimeFile('src/lib/server/__fixtures__/sample.ts')).toBe(false);
		expect(isRuntimeFile('src/lib/data/notes.md')).toBe(false);
	});
});

describe('checkBoundary', () => {
	it('passes when every candidate has a classified manifest entry', () => {
		writeSourceFile(
			'src/lib/server/example.ts',
			"const { data } = await supabase.from('coffee_catalog').select('*');"
		);

		const result = checkBoundary(
			root,
			manifestOf(tableEntry('src/lib/server/example.ts', 'coffee_catalog'))
		);
		expect(result.errors).toEqual([]);
	});

	it('fails on unclassified access naming the file and access', () => {
		writeSourceFile(
			'src/lib/server/example.ts',
			"const { data } = await supabase.from('mystery_table').select('*');"
		);

		const result = checkBoundary(root, manifestOf());
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]).toContain('Unclassified Supabase-shaped access');
		expect(result.errors[0]).toContain('table:mystery_table');
	});

	it('requires the manifest count to match repeated call sites', () => {
		writeSourceFile(
			'src/lib/server/workspaces.ts',
			[
				"await first.from('workspaces').select('*');",
				"await second.from('workspaces').select('*');"
			].join('\n')
		);

		const missingCount = checkBoundary(
			root,
			manifestOf(tableEntry('src/lib/server/workspaces.ts', 'workspaces'))
		);
		expect(missingCount.errors).toHaveLength(1);
		expect(missingCount.errors[0]).toContain('Manifest call-site count mismatch');

		const matched = checkBoundary(root, {
			entries: [{ ...tableEntry('src/lib/server/workspaces.ts', 'workspaces'), count: 2 }]
		});
		expect(matched.errors).toEqual([]);
	});

	it('fails loudly on structurally typed clients instead of silently passing', () => {
		writeSourceFile(
			'src/lib/server/userMemory.ts',
			[
				'const memory = client as MemoryClient;',
				"await memory.from('user_memory').upsert(row);"
			].join('\n')
		);

		const unclassified = checkBoundary(root, manifestOf());
		expect(unclassified.errors).toHaveLength(1);
		expect(unclassified.errors[0]).toContain('user_memory');

		const classified = checkBoundary(root, {
			entries: [
				{
					file: 'src/lib/server/userMemory.ts',
					kind: 'table',
					name: 'user_memory',
					classification: 'retained-web-local',
					owner: 'workspace-memory',
					disposition: 'Retained chat memory persistence.'
				}
			]
		});
		expect(classified.errors).toEqual([]);
	});

	it('accepts explicit suppressions for non-Supabase shapes and rejects stale ones', () => {
		writeSourceFile('src/lib/server/transport.ts', "await transport.rpc('health.check');");

		const suppressed = checkBoundary(root, {
			entries: [],
			suppressions: [suppression('src/lib/server/transport.ts', 'rpc', 'health.check')]
		});
		expect(suppressed.errors).toEqual([]);

		const stale = checkBoundary(root, {
			entries: [],
			suppressions: [
				suppression('src/lib/server/transport.ts', 'rpc', 'health.check'),
				suppression('src/lib/server/deleted.ts', 'rpc', 'gone')
			]
		});
		expect(stale.errors).toHaveLength(1);
		expect(stale.errors[0]).toContain('Stale suppression');
	});

	it('rejects records that are both classified and suppressed', () => {
		writeSourceFile('src/lib/server/example.ts', "await supabase.rpc('real_rpc');");

		const result = checkBoundary(root, {
			entries: [
				{
					file: 'src/lib/server/example.ts',
					kind: 'rpc',
					name: 'real_rpc',
					classification: 'shared-data-debt',
					plannedRemovalPr: 'PR-03',
					disposition: 'Replace.'
				}
			],
			suppressions: [suppression('src/lib/server/example.ts', 'rpc', 'real_rpc')]
		});
		expect(result.errors.some((e) => e.includes('both classified and suppressed'))).toBe(true);
	});

	it('fails on stale manifest entries whose caller was deleted', () => {
		const result = checkBoundary(
			root,
			manifestOf(tableEntry('src/lib/server/deleted.ts', 'coffee_catalog'))
		);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]).toContain('Stale manifest entry');
	});

	it('catches consumers of factory re-export barrels', () => {
		writeSourceFile(
			'src/lib/server/barrel.ts',
			"export { createClient as makeClient } from '@supabase/supabase-js';"
		);
		writeSourceFile(
			'src/lib/server/consumer.ts',
			[
				"import { makeClient } from './barrel';",
				'const db = makeClient(url, key);',
				"await db.from('hidden_table').select('*');"
			].join('\n')
		);

		const result = checkBoundary(root, manifestOf());
		expect(
			result.errors.some((e) => e.includes('barrel.ts') && e.includes('reexport:createClient'))
		).toBe(true);
		expect(
			result.errors.some((e) => e.includes('consumer.ts') && e.includes('table:hidden_table'))
		).toBe(true);
	});

	it('rejects retained auth even when the admin client is laundered through aliases', () => {
		writeSourceFile(
			'src/lib/server/aliased-admin.ts',
			[
				"import { createAdminClient } from '$lib/supabase-admin';",
				'const admin = createAdminClient();',
				'const client = admin;',
				'await client.auth.signOut();'
			].join('\n')
		);

		const result = checkBoundary(root, {
			entries: [
				{
					file: 'src/lib/server/aliased-admin.ts',
					kind: 'admin-client',
					name: 'createAdminClient',
					classification: 'shared-data-debt',
					plannedRemovalPr: 'PR-03',
					disposition: 'Replace.'
				},
				{
					file: 'src/lib/server/aliased-admin.ts',
					kind: 'auth-session',
					name: 'signOut',
					classification: 'retained-web-local',
					owner: 'auth-session',
					disposition: 'Retain.'
				}
			]
		});

		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]).toContain('Admin-client Supabase auth access can never be retained');
	});

	it('rejects retained getUser in a helper that may receive an external client', () => {
		writeSourceFile(
			'src/lib/server/billing/identity-helper.ts',
			[
				'type AuthClient = { auth: { getUser(token: string): Promise<unknown> } };',
				'export async function resolvePrincipal(client: AuthClient, token: string) {',
				'	return client.auth.getUser(token);',
				'}'
			].join('\n')
		);

		const result = checkBoundary(root, {
			entries: [
				{
					file: 'src/lib/server/billing/identity-helper.ts',
					kind: 'auth-session',
					name: 'getUser',
					classification: 'retained-web-local',
					owner: 'auth-session',
					disposition: 'Retain.'
				}
			]
		});

		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]).toContain('externally supplied clients');
	});

	it('rejects retained getUser when an admin client shares the same file', () => {
		writeSourceFile(
			'src/routes/auth/callback/+server.ts',
			[
				"import { createAdminClient } from '$lib/supabase-admin';",
				'const admin = createAdminClient();',
				'await admin.auth.getUser(token);'
			].join('\n')
		);

		const result = checkBoundary(root, {
			entries: [
				{
					file: 'src/routes/auth/callback/+server.ts',
					kind: 'admin-client',
					name: 'createAdminClient',
					classification: 'shared-data-debt',
					plannedRemovalPr: 'PR-03',
					disposition: 'Replace.'
				},
				{
					file: 'src/routes/auth/callback/+server.ts',
					kind: 'auth-session',
					name: 'getUser',
					classification: 'retained-web-local',
					owner: 'auth-session',
					disposition: 'Retain.'
				}
			]
		});

		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]).toContain('Admin-client Supabase auth access can never be retained');
	});

	it('fails on Supabase-shaped access in Svelte template markup', () => {
		writeSourceFile(
			'src/routes/account/+page.svelte',
			[
				'<script lang="ts">',
				"import { supabase } from '$lib/supabase';",
				'const db = supabase;',
				'</script>',
				"<p>{db.from('hidden_table')}</p>"
			].join('\n')
		);

		const result = checkBoundary(root, manifestOf());
		expect(result.errors.some((e) => e.includes('Svelte template markup is banned'))).toBe(true);
	});

	it('does not require classification for test files', () => {
		writeSourceFile(
			'src/lib/server/example.test.ts',
			"const { data } = await supabase.from('coffee_catalog').select('*');"
		);

		const result = checkBoundary(root, manifestOf());
		expect(result.errors).toEqual([]);
	});

	it('classifies operational scripts instead of silently excluding them', () => {
		for (const extension of ['ts', 'js', 'mjs', 'cjs']) {
			writeSourceFile(
				`scripts/backfill.${extension}`,
				"const { data } = await supabase.from('coffee_catalog').select('*');"
			);
		}

		const result = checkBoundary(root, {
			entries: ['ts', 'js', 'mjs', 'cjs'].map((extension) =>
				tableEntry(`scripts/backfill.${extension}`, 'coffee_catalog')
			)
		});
		expect(result.errors).toEqual([]);
	});
});

describe('validateManifest', () => {
	it('rejects retained classifications for product-authorization data', () => {
		const errors = validateManifest(
			manifestOf({
				file: 'src/lib/server/principal.ts',
				kind: 'table',
				name: 'user_roles',
				classification: 'retained-web-local',
				owner: 'billing',
				disposition: 'Retain.'
			})
		);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toContain('can never be retained-web-local');
	});

	it('restricts the retained auth allowlist to session lifecycle access', () => {
		const errors = validateManifest(
			manifestOf({
				file: 'src/lib/server/example.ts',
				kind: 'table',
				name: 'coffee_catalog',
				classification: 'retained-web-local',
				owner: 'auth-session',
				disposition: 'Retain.'
			})
		);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toContain('OAuth/session lifecycle');
	});

	it('rejects retained protected namespace escapes', () => {
		const errors = validateManifest(
			manifestOf({
				file: 'src/lib/supabase.ts',
				kind: 'auth-session',
				name: '<memberAccess>',
				classification: 'retained-web-local',
				owner: 'auth-session',
				disposition: 'Retain.'
			})
		);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toContain('OAuth/session lifecycle');
	});

	it('rejects retained entries in product-principal and credential-validation files', () => {
		const errors = validateManifest(
			manifestOf({
				file: 'src/lib/server/principal.ts',
				kind: 'auth-session',
				name: 'getUser',
				classification: 'retained-web-local',
				owner: 'auth-session',
				disposition: 'Retain.'
			})
		);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toContain('can never hold retained-web-local entries');
	});

	it('restricts retained admin-client custody to named billing files', () => {
		const errors = validateManifest(
			manifestOf({
				file: 'src/lib/server/marketIndex.ts',
				kind: 'admin-client',
				name: 'createAdminClient',
				classification: 'retained-web-local',
				owner: 'billing',
				disposition: 'Retain.'
			})
		);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toContain('retained admin-client custody is limited');
	});

	it('restricts retained client factories to named session and billing factories', () => {
		const errors = validateManifest(
			manifestOf({
				file: 'scripts/backfill.ts',
				kind: 'client-factory',
				name: 'createClient',
				classification: 'retained-web-local',
				owner: 'billing',
				disposition: 'Retain.'
			})
		);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toContain('retained Supabase client factories are limited');
	});

	it('requires plannedRemovalPr in PR-03..PR-10 for shared-data-debt', () => {
		const errors = validateManifest(
			manifestOf({
				file: 'src/lib/server/example.ts',
				kind: 'table',
				name: 'coffee_catalog',
				classification: 'shared-data-debt',
				plannedRemovalPr: 'PR-99',
				disposition: 'Replace.'
			})
		);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toContain('plannedRemovalPr in PR-03..PR-10');
	});

	it('does not allow dynamic table or RPC names into the manifest', () => {
		const errors = validateManifest(
			manifestOf(tableEntry('src/lib/server/example.ts', '<dynamic>'))
		);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toContain('cannot be allowlisted');
	});

	it('does not allow markup entries into the manifest', () => {
		const errors = validateManifest(
			manifestOf({
				file: 'src/routes/account/+page.svelte',
				kind: 'markup',
				name: 'auth',
				classification: 'retained-web-local',
				owner: 'auth-session',
				disposition: 'Retain.'
			})
		);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toContain('cannot be classified');
	});

	it('requires a reason on suppressions', () => {
		const errors = validateManifest({
			entries: [],
			suppressions: [{ file: 'src/lib/a.ts', kind: 'rpc', name: 'x', reason: '' }]
		});
		expect(errors).toHaveLength(1);
		expect(errors[0]).toContain('missing a reason');
	});

	it('requires positive integer manifest counts', () => {
		const errors = validateManifest(
			manifestOf({ ...tableEntry('src/lib/server/example.ts', 'coffee_catalog'), count: 0 })
		);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toContain('count must be a positive integer');
	});

	it('rejects duplicate records across entries and suppressions', () => {
		const entry = tableEntry('src/lib/server/example.ts', 'coffee_catalog');
		expect(validateManifest(manifestOf(entry, { ...entry }))).toHaveLength(1);

		const dupSuppression = suppression('src/lib/a.ts', 'rpc', 'x');
		const errors = validateManifest({
			entries: [],
			suppressions: [dupSuppression, { ...dupSuppression }]
		});
		expect(errors).toHaveLength(1);
		expect(errors[0]).toContain('Duplicate manifest record');
	});
});

describe('collectAccesses', () => {
	it('returns deterministic sorted output', () => {
		writeSourceFile('src/lib/z.ts', "await supabase.from('workspaces').select('*');");
		writeSourceFile(
			'src/lib/a.ts',
			"await supabase.rpc('match_coffee_chunks'); await supabase.from('coffee_catalog').select();"
		);

		expect(collectAccesses(root)).toEqual([
			{ file: 'src/lib/a.ts', kind: 'rpc', name: 'match_coffee_chunks' },
			{ file: 'src/lib/a.ts', kind: 'table', name: 'coffee_catalog' },
			{ file: 'src/lib/z.ts', kind: 'table', name: 'workspaces' }
		]);
	});
});
