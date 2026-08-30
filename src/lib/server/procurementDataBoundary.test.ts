import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
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

	it('uses only procurement brief contracts to obtain canonical sourcing IDs', () => {
		const adapter = readFileSync(
			resolve(runtimeRoot, 'lib/server/parchmentProcurement.ts'),
			'utf8'
		);
		expect(adapter).toContain('client.procurement.briefs.matches');
		expect(adapter).not.toMatch(/client\.catalog|coffee_catalog|\.from\s*\(/);
	});

	it('limits catalog presentation to ID intersection, not criteria evaluation', () => {
		const page = readFileSync(resolve(runtimeRoot, 'routes/catalog/+page.svelte'), 'utf8');
		expect(page).toContain('summary.matchingIds.filter((id) => displayedIds.has(id))');
		expect(page).not.toMatch(/criteria\.(country|region|processing|max_price_per_lb)/);
	});
});
