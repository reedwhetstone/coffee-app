import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { globSync } from 'glob';
import { describe, expect, it } from 'vitest';

describe('/api/roast-profiles Parchment read boundary', () => {
	it('keeps direct roast-list access out of the BFF and page loader', () => {
		const routeSource = readFileSync(resolve('src/routes/api/roast-profiles/+server.ts'), 'utf8');
		const getHandler = routeSource.slice(
			routeSource.indexOf('export const GET'),
			routeSource.indexOf('export const POST')
		);
		const pageLoaderPath = resolve('src/routes/roast/+page.server.ts');
		const pageLoaderSource = existsSync(pageLoaderPath) ? readFileSync(pageLoaderPath, 'utf8') : '';
		const parchmentSource = readFileSync(resolve('src/lib/server/parchmentRoasts.ts'), 'utf8');

		expect(getHandler).toContain('fetchParchmentRoasts');
		expect(getHandler).not.toContain('supabase');
		expect(getHandler).not.toContain(".from('roast_profiles')");
		expect(pageLoaderSource).not.toContain(".from('roast_profiles')");
		expect(parchmentSource).toContain('client.roasts.list');
		expect(parchmentSource).not.toContain('supabase');
		expect(existsSync(resolve('src/lib/data/roast.ts'))).toBe(false);
	});

	it('keeps roast mutations behind Parchment with only the Phase 3 read carve-out', () => {
		const routeSource = readFileSync(resolve('src/routes/api/roast-profiles/+server.ts'), 'utf8');
		const artisanSource = readFileSync(resolve('src/routes/api/artisan-import/+server.ts'), 'utf8');
		const clearSource = readFileSync(resolve('src/routes/api/clear-roast/+server.ts'), 'utf8');
		const directRoastTablePattern =
			/\.from\(['"](?:roast_profiles|roast_temperatures|roast_events|artisan_import_log)['"]/;
		const runtimeFiles = globSync('src/**/*.{ts,svelte}', {
			ignore: ['**/*.test.ts', '**/*.spec.ts']
		});
		const directAccessFiles = runtimeFiles
			.filter((file) => directRoastTablePattern.test(readFileSync(resolve(file), 'utf8')))
			.sort();

		expect(routeSource).toContain('createParchmentRoasts');
		expect(routeSource).toContain('updateParchmentRoast');
		expect(routeSource).toContain('deleteParchmentRoastBatch');
		expect(routeSource).not.toContain('supabase');
		for (const source of [routeSource, artisanSource, clearSource]) {
			expect(source).toContain('isCookieSessionPrincipal');
			expect(source).toContain('isTrustedMutationRequest');
			expect(source).toContain("mode: 'session'");
			expect(source).not.toContain(".from('roast_profiles')");
			expect(source).not.toContain(".from('roast_temperatures')");
			expect(source).not.toContain(".from('roast_events')");
			expect(source).not.toContain(".from('artisan_import_log')");
		}
		expect(directAccessFiles).toEqual(['src/routes/api/tools/roast-profiles/+server.ts']);
		expect(existsSync(resolve('src/lib/services/milestoneCalculationService.ts'))).toBe(false);
		expect(existsSync(resolve('src/routes/api/admin/backfill-milestones/+server.ts'))).toBe(false);
	});
});
