import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoot = resolve('src');
const allowedSupabaseFiles = new Set([
	'src/app.d.ts',
	'src/hooks.server.ts',
	'src/lib/components/Auth.svelte',
	'src/lib/components/layout/AuthSidebar.svelte',
	'src/lib/server/auth.ts',
	'src/lib/server/pageAuth.ts',
	'src/lib/server/principal.ts',
	'src/lib/stores/auth.ts',
	'src/lib/supabase.ts',
	'src/routes/+layout.ts',
	'src/routes/account/+page.svelte',
	'src/routes/auth/+page.svelte',
	'src/routes/private/+layout.svelte',
	'src/routes/subscription/+page.svelte'
]);

function runtimeSourceFiles(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = resolve(directory, entry.name);
		if (entry.isDirectory()) return runtimeSourceFiles(path);
		if (!entry.isFile() || !/\.(?:ts|svelte)$/.test(entry.name)) return [];
		if (/\.(?:test|spec|test-utils)\.ts$/.test(entry.name)) return [];
		return [path];
	});
}

describe('terminal Coffee App source boundary', () => {
	it('keeps product data and AI orchestration behind Parchment', () => {
		const forbidden = [
			/\.from\(\s*['"]/,
			/\.rpc\(\s*['"]/,
			/Database\[['"]public['"]\]/,
			/OPENROUTER_API_KEY/,
			/openrouter\.ai/,
			/@ai-sdk\/openai/,
			/createOpenAI/,
			/\bstreamText\b/,
			/\bcreateChatTools\b/,
			/SUPABASE_SERVICE_ROLE_KEY/
		];
		const offenders = runtimeSourceFiles(sourceRoot).flatMap((file) => {
			const source = readFileSync(file, 'utf8');
			return forbidden.some((pattern) => pattern.test(source))
				? [relative(process.cwd(), file)]
				: [];
		});

		expect(offenders).toEqual([]);
	});

	it('limits Supabase imports to browser identity and session plumbing', () => {
		const offenders = runtimeSourceFiles(sourceRoot).flatMap((file) => {
			const source = readFileSync(file, 'utf8');
			if (!source.includes('@supabase') && !source.includes('$lib/supabase')) return [];
			return [relative(process.cwd(), file)];
		});

		expect(new Set(offenders)).toEqual(allowedSupabaseFiles);
	});

	it('keeps retired backend surfaces deleted', () => {
		for (const path of [
			'src/lib/types/database.types.ts',
			'src/lib/types/api.types.ts',
			'src/lib/services/ragService.ts',
			'src/lib/services/tools.ts',
			'src/lib/server/cherryRuntime.ts',
			'src/lib/services/cherryIdentity.eval.test.ts',
			'scripts/backfill-supply-index.ts',
			'.github/workflows/typegen.yml'
		]) {
			expect(existsSync(resolve(path)), path).toBe(false);
		}

		const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
		expect(packageJson.devDependencies?.['@ai-sdk/openai']).toBeUndefined();
	});
});
