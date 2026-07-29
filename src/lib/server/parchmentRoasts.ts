import type { components, ParchmentClient } from '@purveyors/sdk';
import { collectOffsetPages } from '$lib/services/tools/pagination';
import { unwrapParchment } from '$lib/services/tools/parchment';

export type ParchmentRoastProfile = components['schemas']['RoastListResource'];

const PAGE_LIMIT = 200;

/**
 * List every owner-scoped roast profile through Parchment.
 *
 * The canonical endpoint uses offset pagination, so the first-party BFF must
 * exhaust every page to preserve the legacy route's all-roasts response. The
 * stable `roast_date DESC, roast_id DESC` ordering makes that traversal
 * deterministic for a static result set.
 */
export async function fetchParchmentRoasts(
	client: ParchmentClient
): Promise<ParchmentRoastProfile[]> {
	return collectOffsetPages({
		fetchPage: async (offset) =>
			unwrapParchment(await client.roasts.list({ limit: PAGE_LIMIT, offset })).data,
		key: (row) => row.roast_id
	});
}
