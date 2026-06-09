import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database.types';
import { validateSourcingBriefCriteria } from '$lib/procurement/sourcingBriefCriteria';
import {
	summarizeSourcingBriefMatches,
	type MatchableSourcingLot,
	type SourcingBriefMatchSummary
} from '$lib/procurement/sourcingBriefMatching';

type SessionClient = SupabaseClient<Database>;

export type BriefMatchSummary = SourcingBriefMatchSummary;
export type MatchableLot = MatchableSourcingLot;

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

	const validBriefs = (briefs as Array<{ id: string; name: string; criteria: unknown }>).flatMap(
		(brief) => {
			try {
				return [
					{
						briefId: brief.id,
						briefName: brief.name,
						criteria: validateSourcingBriefCriteria(brief.criteria)
					}
				];
			} catch {
				return [];
			}
		}
	);

	return summarizeSourcingBriefMatches(validBriefs, catalogLots);
}
