import type { ParchmentClient } from '@purveyors/sdk';
import { validateSourcingBriefCriteria } from '$lib/procurement/sourcingBriefCriteria';
import { listActiveSourcingBriefs } from '$lib/server/parchmentProcurement';
import {
	summarizeSourcingBriefMatches,
	type MatchableSourcingLot,
	type SourcingBriefMatchSummary
} from '$lib/procurement/sourcingBriefMatching';

export type BriefMatchSummary = SourcingBriefMatchSummary;
export type MatchableLot = MatchableSourcingLot;

export async function getBriefMatchSummaries(
	client: ParchmentClient,
	catalogLots: MatchableLot[]
): Promise<BriefMatchSummary[]> {
	if (!catalogLots.length) return [];

	const briefs = await listActiveSourcingBriefs(client, 10);

	if (!briefs.length) return [];

	const validBriefs = briefs.flatMap((brief) => {
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
	});

	return summarizeSourcingBriefMatches(validBriefs, catalogLots);
}
