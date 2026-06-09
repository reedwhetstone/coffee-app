import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database.types';
import {
	validateSourcingBriefCriteria,
	type SourcingBriefCriteria
} from '$lib/procurement/sourcingBriefCriteria';

type SessionClient = SupabaseClient<Database>;

export interface BriefMatchSummary {
	briefId: string;
	briefName: string;
	criteria: SourcingBriefCriteria;
	matchCount: number;
	matchingIds: number[];
}

export type MatchableLot = {
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

function lotMatchesCriteria(criteria: SourcingBriefCriteria, lot: MatchableLot): boolean {
	if (criteria.country && lot.country !== criteria.country) return false;
	if (
		criteria.region &&
		!lot.region?.toLowerCase().includes(criteria.region.toLowerCase())
	)
		return false;
	if (
		criteria.processing &&
		!lot.processing?.toLowerCase().includes(criteria.processing.toLowerCase())
	)
		return false;
	if (
		criteria.processing_base_method &&
		lot.processing_base_method !== criteria.processing_base_method
	)
		return false;
	if (
		criteria.max_price_per_lb !== undefined &&
		(lot.price_per_lb == null || lot.price_per_lb > criteria.max_price_per_lb)
	)
		return false;
	if (criteria.stocked_only && !lot.stocked) return false;
	if (criteria.wholesale_only && !lot.wholesale) return false;
	return true;
}

export async function getBriefMatchSummaries(
	supabase: SessionClient,
	userId: string,
	catalogLots: MatchableLot[]
): Promise<BriefMatchSummary[]> {
	if (!catalogLots.length) return [];

	const { data: briefs } = await supabase
		.from('sourcing_briefs')
		.select('id, name, criteria')
		.eq('user_id', userId)
		.eq('is_active', true)
		.order('created_at', { ascending: false })
		.limit(10);

	if (!briefs?.length) return [];

	return (briefs as Array<{ id: string; name: string; criteria: unknown }>).flatMap((brief) => {
		let criteria: SourcingBriefCriteria;
		try {
			criteria = validateSourcingBriefCriteria(brief.criteria);
		} catch {
			return [];
		}

		const matchingIds = catalogLots
			.filter((lot) => lotMatchesCriteria(criteria, lot))
			.map((lot) => lot.id);

		if (!matchingIds.length) return [];

		return [
			{
				briefId: brief.id,
				briefName: brief.name,
				criteria,
				matchCount: matchingIds.length,
				matchingIds
			}
		];
	});
}
