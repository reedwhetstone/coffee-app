import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(process.cwd(), 'src');

function source(path: string): string {
	return readFileSync(resolve(root, path), 'utf8');
}

function runtimeFiles(directory = root): string[] {
	return readdirSync(directory).flatMap((entry) => {
		const path = resolve(directory, entry);
		if (statSync(path).isDirectory()) return runtimeFiles(path);
		if (!['.ts', '.svelte', '.js'].includes(extname(path))) return [];
		if (/\.(?:test|spec)\.[^.]+$/.test(path) || path.includes('/__tests__/')) return [];
		return [path];
	});
}

function resolveRuntimeImport(specifier: string, importer: string): string | null {
	const base = specifier.startsWith('$lib/')
		? resolve(root, 'lib', specifier.slice('$lib/'.length))
		: specifier.startsWith('.')
			? resolve(dirname(importer), specifier)
			: null;
	if (!base) return null;

	for (const candidate of [
		base,
		`${base}.ts`,
		`${base}.js`,
		`${base}.svelte`,
		resolve(base, 'index.ts')
	]) {
		if (existsSync(candidate) && !statSync(candidate).isDirectory()) return candidate;
	}
	return null;
}

function dependencyFiles(entrypoints: string[]): string[] {
	const pending = entrypoints.map((entrypoint) => resolve(root, entrypoint));
	const visited = new Set<string>();

	while (pending.length > 0) {
		const path = pending.pop();
		if (!path || visited.has(path)) continue;
		visited.add(path);
		const contents = readFileSync(path, 'utf8');
		for (const match of contents.matchAll(/(?:from\s+|import\s*)['"]([^'"]+)['"]/g)) {
			const dependency = resolveRuntimeImport(match[1], path);
			if (dependency && !visited.has(dependency)) pending.push(dependency);
		}
	}

	return [...visited];
}

describe('market data boundary', () => {
	it('keeps analytics and signal hydration on canonical Parchment contracts', () => {
		const runtime = runtimeFiles();
		const analyticsBoundary = dependencyFiles([
			'routes/analytics/+page.server.ts',
			'lib/server/marketIndex.ts'
		]);

		for (const retiredToken of [
			'market_daily_summary',
			'supplier_daily_stats',
			'get_supplier_price_ranges',
			'createAdminClient',
			'supabase-admin',
			'SUPABASE_SERVICE_ROLE_KEY'
		]) {
			expect(runtime.filter((path) => readFileSync(path, 'utf8').includes(retiredToken))).toEqual(
				[]
			);
		}
		expect(
			analyticsBoundary.filter((path) =>
				/\.from\(\s*['"]coffee_catalog['"]/.test(readFileSync(path, 'utf8'))
			)
		).toEqual([]);

		expect(source('routes/analytics/+page.server.ts')).toContain('client.market.overview()');
		expect(source('routes/analytics/+page.server.ts')).toContain('client.market.evidence()');
	});

	it('keeps the obsolete service-role client deleted', () => {
		expect(existsSync(resolve(root, 'lib/supabase-admin.ts'))).toBe(false);
	});
});
