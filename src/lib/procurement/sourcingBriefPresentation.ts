import type { components } from '@purveyors/sdk';

export type SourcingBriefCriteria = components['schemas']['SourcingBriefCriteria'];

export type SourcingBriefMatchSummary = {
	briefId: string;
	briefName: string;
	criteria: SourcingBriefCriteria;
	totalMatchCount: number;
	matchingIds: number[];
};

export type PageSourcingBriefMatchSummary = SourcingBriefMatchSummary & {
	matchCount: number;
};

/** Presentation-only copy for criteria already validated and normalized by Parchment. */
export function describeSourcingBriefCriteria(criteria: SourcingBriefCriteria): string {
	const parts: string[] = [];
	if (criteria.country) parts.push(`origin ${criteria.country}`);
	if (criteria.region) parts.push(`region ${criteria.region}`);
	if (criteria.processing) parts.push(`process ${criteria.processing}`);
	if (criteria.processing_base_method) {
		parts.push(`base process ${criteria.processing_base_method}`);
	}
	if (criteria.max_price_per_lb !== undefined) parts.push(`max $${criteria.max_price_per_lb}/lb`);
	if (criteria.stocked_only) parts.push('stocked only');
	if (criteria.wholesale_only) parts.push('wholesale only');
	if (criteria.stocked_days !== undefined) {
		parts.push(`stocked in the last ${criteria.stocked_days} days`);
	}
	return parts.join(', ') || 'open criteria';
}
