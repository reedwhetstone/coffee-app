import type { SourcingBriefCriteria } from '$lib/procurement/sourcingBriefCriteria';

export type MatchableSourcingLot = {
	id: number;
	country?: string | null;
	region?: string | null;
	processing?: string | null;
	processing_base_method?: string | null;
	price_per_lb?: number | null;
	stocked?: boolean | null;
	stocked_date?: string | null;
	wholesale?: boolean | null;
};

export type SourcingBriefMatchSummaryInput = {
	briefId: string;
	briefName: string;
	criteria: SourcingBriefCriteria;
};

export type SourcingBriefMatchSummary = SourcingBriefMatchSummaryInput & {
	matchCount: number;
	matchingIds: number[];
};

function textIncludes(value: string | null | undefined, expected: string | undefined): boolean {
	return Boolean(value && expected && value.toLowerCase().includes(expected.toLowerCase()));
}

function stockedWithinDays(
	stockedDate: string | null | undefined,
	stockedDays: number | undefined,
	now = new Date()
): boolean {
	if (stockedDays === undefined) return true;
	if (!stockedDate) return false;

	const stockedAt = new Date(`${stockedDate}T00:00:00Z`);
	if (Number.isNaN(stockedAt.getTime())) return false;

	const cutoff = new Date(now);
	cutoff.setUTCHours(0, 0, 0, 0);
	cutoff.setUTCDate(cutoff.getUTCDate() - stockedDays);
	return stockedAt >= cutoff;
}

export function lotMatchesSourcingBriefCriteria(
	criteria: SourcingBriefCriteria,
	lot: MatchableSourcingLot,
	now = new Date()
): boolean {
	if (criteria.country && lot.country !== criteria.country) return false;
	if (criteria.region && !textIncludes(lot.region, criteria.region)) return false;
	if (criteria.processing && !textIncludes(lot.processing, criteria.processing)) return false;
	if (
		criteria.processing_base_method &&
		lot.processing_base_method !== criteria.processing_base_method
	) {
		return false;
	}
	if (
		criteria.max_price_per_lb !== undefined &&
		(lot.price_per_lb == null || lot.price_per_lb > criteria.max_price_per_lb)
	) {
		return false;
	}
	if (criteria.stocked_only && !lot.stocked) return false;
	if (criteria.wholesale_only && !lot.wholesale) return false;
	if (!stockedWithinDays(lot.stocked_date, criteria.stocked_days, now)) return false;
	return true;
}

export function getSourcingBriefMatchingIds(
	criteria: SourcingBriefCriteria,
	lots: MatchableSourcingLot[],
	now = new Date()
): number[] {
	return lots
		.filter((lot) => lotMatchesSourcingBriefCriteria(criteria, lot, now))
		.map((lot) => lot.id);
}

export function summarizeSourcingBriefMatches(
	briefs: SourcingBriefMatchSummaryInput[],
	lots: MatchableSourcingLot[],
	now = new Date()
): SourcingBriefMatchSummary[] {
	return briefs.flatMap((brief) => {
		const matchingIds = getSourcingBriefMatchingIds(brief.criteria, lots, now);
		if (!matchingIds.length) return [];
		return [
			{
				...brief,
				matchCount: matchingIds.length,
				matchingIds
			}
		];
	});
}
