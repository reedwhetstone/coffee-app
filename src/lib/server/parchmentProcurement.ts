import type { ParchmentClient, components } from '@purveyors/sdk';

export type SourcingBriefResource = components['schemas']['SourcingBriefResource'];

type SourcingBriefListResult = {
	data?: { data?: unknown };
	error?: unknown;
};

/**
 * List the authenticated caller's active sourcing briefs through Parchment.
 *
 * The canonical endpoint owns user scoping, active filtering, and newest-first
 * ordering. Coffee-app callers may take a smaller prefix for presentation.
 */
export async function listActiveSourcingBriefs(
	client: ParchmentClient,
	limit?: number
): Promise<SourcingBriefResource[]> {
	const result = (await client.procurement.briefs.list()) as SourcingBriefListResult;
	if (result.error) {
		throw result.error;
	}

	const rows = Array.isArray(result.data?.data)
		? (result.data.data as SourcingBriefResource[])
		: [];

	return limit === undefined ? rows : rows.slice(0, Math.max(0, limit));
}
