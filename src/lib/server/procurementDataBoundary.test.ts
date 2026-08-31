import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { globSync } from 'glob';

const runtimeRoot = resolve(process.cwd(), 'src');
const retiredRuntimeTruth = [
	'sourcingBriefCriteria.ts',
	'sourcingBriefMatching.ts',
	'briefMatchSummary.ts'
];
const retiredSymbols = [
	'validateSourcingBriefCriteria',
	'lotMatchesSourcingBriefCriteria',
	'getSourcingBriefMatchingIds',
	'summarizeSourcingBriefMatches',
	'sourcingBriefCriteriaToCatalogSearchOptions',
	'MatchableSourcingLot'
];
const sourcingAdapter = resolve(runtimeRoot, 'lib/server/parchmentProcurement.ts');
const sourcingPresentation = resolve(runtimeRoot, 'lib/procurement/sourcingBriefPresentation.ts');

function resolveRuntimeImport(importer: string, specifier: string): string | null {
	let unresolved: string;
	if (specifier.startsWith('$lib/')) {
		unresolved = resolve(runtimeRoot, 'lib', specifier.slice('$lib/'.length));
	} else if (specifier.startsWith('.')) {
		unresolved = resolve(dirname(importer), specifier);
	} else {
		return null;
	}

	const candidates = extname(unresolved)
		? [unresolved]
		: [`${unresolved}.ts`, `${unresolved}.svelte`, resolve(unresolved, 'index.ts')];
	return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function collectRuntimeDependencies(entries: string[]): string[] {
	const pending = [...entries];
	const visited = new Set<string>();

	while (pending.length > 0) {
		const file = pending.pop();
		if (!file || visited.has(file)) continue;
		visited.add(file);

		const source = readFileSync(file, 'utf8');
		for (const match of source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) {
			const dependency = resolveRuntimeImport(file, match[1]);
			if (dependency && !visited.has(dependency)) pending.push(dependency);
		}
	}

	return [...visited];
}

describe('procurement SDK source boundary', () => {
	it('keeps retired criteria and lot-matching truth out of runtime src', () => {
		const runtimeFiles = globSync('**/*.{ts,svelte}', {
			cwd: runtimeRoot,
			absolute: true,
			ignore: ['**/*.test.ts', '**/*.spec.ts']
		});
		const runtimeSource = runtimeFiles.map((file) => readFileSync(file, 'utf8')).join('\n');

		for (const filename of retiredRuntimeTruth) {
			expect(() => statSync(resolve(runtimeRoot, 'lib/procurement', filename))).toThrow();
			expect(() => statSync(resolve(runtimeRoot, 'lib/server', filename))).toThrow();
		}
		for (const symbol of retiredSymbols) expect(runtimeSource).not.toContain(symbol);
	});

	it('uses only procurement brief contracts throughout the sourcing adapter dependency boundary', () => {
		const boundaryFiles = new Set([
			...collectRuntimeDependencies([sourcingAdapter, sourcingPresentation]),
			...globSync('lib/procurement/**/*.{ts,svelte}', {
				cwd: runtimeRoot,
				absolute: true,
				ignore: ['**/*.test.ts', '**/*.spec.ts']
			})
		]);
		const boundarySources = [...boundaryFiles].map((file) => ({
			file,
			source: readFileSync(file, 'utf8')
		}));
		const adapter = readFileSync(sourcingAdapter, 'utf8');

		expect(adapter).toContain('client.procurement.briefs.matches');
		for (const { source } of boundarySources) {
			expect(source).not.toMatch(
				/client\.catalog|\.catalog\.list\s*\(|coffee_catalog|\.from\s*\(|supabase/i
			);
		}

		// Local helpers cannot be slipped under the adapter without becoming part
		// of this recursively inspected boundary. Presentation is the sole client
		// module; the adapter itself only validates canonical response structure.
		expect([...boundaryFiles].sort()).toEqual([sourcingPresentation, sourcingAdapter].sort());
	});

	it('limits catalog presentation to ID intersection, not criteria evaluation', () => {
		const page = readFileSync(resolve(runtimeRoot, 'routes/catalog/+page.svelte'), 'utf8');
		expect(page).toContain('summary.matchingIds.filter((id) => displayedIds.has(id))');
		expect(page).not.toMatch(/criteria\.(country|region|processing|max_price_per_lb)/);
	});
});
