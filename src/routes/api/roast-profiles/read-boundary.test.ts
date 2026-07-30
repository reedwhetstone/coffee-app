import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
		const legacyDataSource = readFileSync(resolve('src/lib/data/roast.ts'), 'utf8');

		expect(getHandler).toContain('fetchParchmentRoasts');
		expect(getHandler).not.toContain('supabase');
		expect(getHandler).not.toContain(".from('roast_profiles')");
		expect(pageLoaderSource).not.toContain(".from('roast_profiles')");
		expect(parchmentSource).toContain('client.roasts.list');
		expect(parchmentSource).not.toContain('supabase');
		expect(legacyDataSource).not.toContain('function listRoasts');
	});
});
