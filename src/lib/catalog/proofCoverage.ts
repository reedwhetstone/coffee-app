import {
	createCatalogProofSummary,
	type CatalogProofFamilyKey,
	type CatalogProofFamilyLabel,
	type CatalogProofInput,
	type CatalogProofLimitation,
	type CatalogProofOverallLabel,
	type CatalogProofSummary
} from './proofSummary';

export interface CatalogProofCoverageBucket<TLabel extends string = string> {
	label: TLabel;
	count: number;
	share: number;
}

export interface CatalogProofCoverageGap {
	family: CatalogProofFamilyKey;
	label: 'not_available';
	count: number;
	share: number;
}

export interface CatalogProofCoverageSummary {
	overall: CatalogProofCoverageBucket<CatalogProofOverallLabel>[];
	families: Record<CatalogProofFamilyKey, CatalogProofCoverageBucket<CatalogProofFamilyLabel>[]>;
	signals: Record<string, number>;
	top_gaps: CatalogProofCoverageGap[];
	limitations: CatalogProofLimitation[];
}

const FAMILY_KEYS: CatalogProofFamilyKey[] = ['process', 'provenance', 'freshness', 'pricing'];
const LIMITATIONS: CatalogProofLimitation[] = [
	'not_certification',
	'raw_evidence_not_included',
	'supplier_verification_not_performed'
];

function increment<TKey extends string>(counts: Map<TKey, number>, key: TKey): void {
	counts.set(key, (counts.get(key) ?? 0) + 1);
}

function toShare(count: number, total: number): number {
	if (total <= 0) return 0;
	return Number((count / total).toFixed(3));
}

function toBuckets<TLabel extends string>(
	counts: Map<TLabel, number>,
	total: number
): CatalogProofCoverageBucket<TLabel>[] {
	return Array.from(counts.entries())
		.map(([label, count]) => ({
			label,
			count,
			share: toShare(count, total)
		}))
		.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function summarizeCatalogProofCoverage(
	summaries: CatalogProofSummary[]
): CatalogProofCoverageSummary {
	const totalRows = summaries.length;
	const overallCounts = new Map<CatalogProofOverallLabel, number>();
	const familyCounts = Object.fromEntries(
		FAMILY_KEYS.map((family) => [family, new Map<CatalogProofFamilyLabel, number>()])
	) as Record<CatalogProofFamilyKey, Map<CatalogProofFamilyLabel, number>>;
	const signalCounts = new Map<string, number>();

	for (const summary of summaries) {
		increment(overallCounts, summary.overall.label);

		for (const family of FAMILY_KEYS) {
			const familySummary = summary.families[family];
			increment(familyCounts[family], familySummary.label);

			for (const signal of familySummary.signals) {
				increment(signalCounts, `${family}.${signal}`);
			}
		}
	}

	const families = Object.fromEntries(
		FAMILY_KEYS.map((family) => [family, toBuckets(familyCounts[family], totalRows)])
	) as Record<CatalogProofFamilyKey, CatalogProofCoverageBucket<CatalogProofFamilyLabel>[]>;

	const top_gaps = FAMILY_KEYS.map((family) => {
		const count = familyCounts[family].get('not_available') ?? 0;
		return {
			family,
			label: 'not_available' as const,
			count,
			share: toShare(count, totalRows)
		};
	})
		.filter((gap) => gap.count > 0)
		.sort((a, b) => b.count - a.count || a.family.localeCompare(b.family));

	const signals = Object.fromEntries(
		Array.from(signalCounts.entries()).sort(([a], [b]) => a.localeCompare(b))
	);

	return {
		overall: toBuckets(overallCounts, totalRows),
		families,
		signals,
		top_gaps,
		limitations: LIMITATIONS
	};
}

export function createCatalogProofCoverage(
	items: CatalogProofInput[]
): CatalogProofCoverageSummary {
	return summarizeCatalogProofCoverage(items.map((item) => createCatalogProofSummary(item)));
}
