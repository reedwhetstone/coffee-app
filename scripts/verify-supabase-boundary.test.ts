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
	type ManifestEntry
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
	it('detects table, rpc, admin-client, and auth-session access', () => {
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

	it('does not flag Array.from and other non-Supabase from() receivers', () => {
		const source = [
			"const letters = Array.from('abcdef');",
			"const bytes = Uint8Array.from('123');",
			'const items = Array.from({ length: 5 }, (_, i) => i);',
			"const buf = Buffer.from('payload');"
		].join('\n');

		expect(scanSource(source, 'src/lib/example.ts')).toEqual([]);
	});

	it('does not flag unrelated auth helpers', () => {
		const source = 'const header = request.auth.token; myClient.auth.customThing();';
		expect(scanSource(source, 'src/lib/example.ts')).toEqual([]);
	});

	it('detects unknown and nested methods beneath a Supabase auth member', () => {
		const source = [
			'await supabase.auth.resend({ type: "signup", email });',
			'await supabase.auth.signInAnonymously();',
			'await supabase.auth.linkIdentity(identity);',
			'await supabase.auth.admin.deleteUser(userId);'
		].join('\n');

		expect(scanSource(source, 'src/lib/example.ts')).toEqual([
			{ file: 'src/lib/example.ts', kind: 'auth-session', name: 'resend' },
			{ file: 'src/lib/example.ts', kind: 'auth-session', name: 'signInAnonymously' },
			{ file: 'src/lib/example.ts', kind: 'auth-session', name: 'linkIdentity' },
			{
				file: 'src/lib/example.ts',
				kind: 'auth-session',
				name: 'deleteUser',
				authContext: 'admin-client'
			}
		]);
	});

	it('traces aliased auth receivers and SupabaseClient-typed parameters', () => {
		const source = [
			"import type { SupabaseClient } from '@supabase/supabase-js';",
			'const auth = supabase.auth;',
			'await auth.resend({ type: "signup", email });',
			'const clientAlias = supabase;',
			'await clientAlias.auth.getUser(token);',
			'function read<T extends SupabaseClient>(client: T) {',
			'\treturn client.auth.getUser(token);',
			'}'
		].join('\n');

		expect(scanSource(source, 'src/lib/example.ts')).toEqual([
			{ file: 'src/lib/example.ts', kind: 'auth-session', name: 'resend' },
			{ file: 'src/lib/example.ts', kind: 'auth-session', name: 'getUser' }
		]);

		expect(
			scanSource(
				[
					"import type { SupabaseClient } from '@supabase/supabase-js';",
					'function read<T extends SupabaseClient>(client: T) {',
					'\treturn client.auth.getUser(token);',
					'}'
				].join('\n'),
				'src/lib/generic.ts'
			)
		).toEqual([{ file: 'src/lib/generic.ts', kind: 'auth-session', name: 'getUser' }]);

		expect(
			scanSource(
				[
					"import { createAdminClient } from '$lib/supabase-admin';",
					'const admin = createAdminClient();',
					'const adminAuth = admin.auth;',
					'await adminAuth.getUser(token);'
				].join('\n'),
				'src/lib/admin.ts'
			)
		).toEqual([
			{ file: 'src/lib/admin.ts', kind: 'admin-client', name: 'createAdminClient' },
			{
				file: 'src/lib/admin.ts',
				kind: 'auth-session',
				name: 'getUser',
				authContext: 'admin-client'
			}
		]);
	});

	it('tracks auth calls on directly returned factory clients', () => {
		const source = [
			"import { createAdminClient } from '$lib/supabase-admin';",
			"import { createServerClient } from '@supabase/ssr';",
			'await createAdminClient().auth.getUser(token);',
			'await createServerClient().auth.getSession();'
		].join('\n');

		expect(scanSource(source, 'src/lib/direct-factory.ts')).toEqual([
			{ file: 'src/lib/direct-factory.ts', kind: 'admin-client', name: 'createAdminClient' },
			{ file: 'src/lib/direct-factory.ts', kind: 'client-factory', name: 'createServerClient' },
			{
				file: 'src/lib/direct-factory.ts',
				kind: 'auth-session',
				name: 'getUser',
				authContext: 'admin-client'
			},
			{
				file: 'src/lib/direct-factory.ts',
				kind: 'auth-session',
				name: 'getSession'
			}
		]);
	});

	it('scans Svelte script blocks with whitespace in the closing tag', () => {
		const source = [
			'<script lang="ts">',
			"await supabase.from('coffee_catalog').select('*');",
			'</script >'
		].join('\n');

		expect(scanSource(source, 'src/routes/catalog/+page.svelte')).toEqual([
			{ file: 'src/routes/catalog/+page.svelte', kind: 'table', name: 'coffee_catalog' }
		]);
	});

	it('scans Svelte script blocks with arbitrary closing-tag whitespace', () => {
		const source = [
			'<script lang="ts">',
			"await supabase.from('coffee_catalog').select('*');",
			'</script\t\n bar>'
		].join('\n');

		expect(scanSource(source, 'src/routes/catalog/+page.svelte')).toEqual([
			{ file: 'src/routes/catalog/+page.svelte', kind: 'table', name: 'coffee_catalog' }
		]);
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

	it('detects computed and generic Supabase calls', () => {
		const source = [
			"await supabase['from']('computed_table').select('*');",
			"await client.from<Row>('generic_table').select('*');",
			"await supabase['rpc']('computed_rpc');"
		].join('\n');

		expect(scanSource(source, 'src/lib/example.ts')).toEqual([
			{ file: 'src/lib/example.ts', kind: 'table', name: 'computed_table' },
			{ file: 'src/lib/example.ts', kind: 'table', name: 'generic_table' },
			{ file: 'src/lib/example.ts', kind: 'rpc', name: 'computed_rpc' }
		]);
	});

	it('detects namespace and dynamic Supabase imports', () => {
		const source = [
			"import * as sb from '@supabase/supabase-js';",
			"const direct = sb.createClient('url', 'key');",
			"const lazy = import('@supabase/supabase-js');"
		].join('\n');

		expect(scanSource(source, 'scripts/example.mjs')).toEqual([
			{ file: 'scripts/example.mjs', kind: 'client-factory', name: 'createClient' },
			{ file: 'scripts/example.mjs', kind: 'client-factory', name: 'dynamicImport' }
		]);
	});

	it('detects destructured and namespace CommonJS Supabase imports', () => {
		const source = [
			"const { createClient } = require('@supabase/supabase-js');",
			"const sb = require('@supabase/supabase-js');",
			"createClient('url', 'key');",
			"sb.createClient('url', 'key');"
		].join('\n');

		expect(scanSource(source, 'scripts/example.cjs')).toEqual([
			{ file: 'scripts/example.cjs', kind: 'client-factory', name: 'commonJsRequire' }
		]);
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
	it('passes when every access has a classified manifest entry', () => {
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

	it('fails on unclassified table access naming the file and access', () => {
		writeSourceFile(
			'src/lib/server/example.ts',
			"const { data } = await supabase.from('mystery_table').select('*');"
		);

		const result = checkBoundary(root, manifestOf());
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]).toContain('Unclassified Supabase access');
		expect(result.errors[0]).toContain('src/lib/server/example.ts');
		expect(result.errors[0]).toContain('table:mystery_table');
	});

	it('fails on unclassified rpc access', () => {
		writeSourceFile(
			'src/lib/server/example.ts',
			"await supabase.rpc('mystery_function', { arg: 1 });"
		);

		const result = checkBoundary(root, manifestOf());
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]).toContain('Unclassified Supabase access');
		expect(result.errors[0]).toContain('rpc:mystery_function');
	});

	it('fails on stale manifest entries whose caller was deleted', () => {
		const result = checkBoundary(
			root,
			manifestOf(tableEntry('src/lib/server/deleted.ts', 'coffee_catalog'))
		);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]).toContain('Stale manifest entry');
		expect(result.errors[0]).toContain('src/lib/server/deleted.ts');
	});

	it('fails as stale and unclassified when a classified file is renamed', () => {
		writeSourceFile(
			'src/lib/server/renamed.ts',
			"const { data } = await supabase.from('coffee_catalog').select('*');"
		);

		const result = checkBoundary(
			root,
			manifestOf(tableEntry('src/lib/server/original.ts', 'coffee_catalog'))
		);
		expect(result.errors).toHaveLength(2);
		expect(
			result.errors.some((e) => e.includes('Stale manifest entry') && e.includes('original.ts'))
		).toBe(true);
		expect(
			result.errors.some(
				(e) => e.includes('Unclassified Supabase access') && e.includes('renamed.ts')
			)
		).toBe(true);
	});

	it('rejects retained admin JWT validation after the caller is renamed', () => {
		writeSourceFile(
			'src/lib/server/renamed-principal.ts',
			[
				"import { createAdminClient } from '$lib/supabase-admin';",
				'const renamedClient = createAdminClient();',
				'await renamedClient.auth.getUser(token);'
			].join('\n')
		);

		const result = checkBoundary(root, {
			entries: [
				{
					file: 'src/lib/server/renamed-principal.ts',
					kind: 'admin-client',
					name: 'createAdminClient',
					classification: 'shared-data-debt',
					plannedRemovalPr: 'PR-03',
					disposition: 'Replace.'
				},
				{
					file: 'src/lib/server/renamed-principal.ts',
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

	it('ignores Array.from in runtime files', () => {
		writeSourceFile('src/lib/server/example.ts', "const letters = Array.from('abcdef');");

		const result = checkBoundary(root, manifestOf());
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

	it('rejects duplicate entries', () => {
		const entry = tableEntry('src/lib/server/example.ts', 'coffee_catalog');
		const errors = validateManifest(manifestOf(entry, { ...entry }));
		expect(errors).toHaveLength(1);
		expect(errors[0]).toContain('Duplicate manifest entry');
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
