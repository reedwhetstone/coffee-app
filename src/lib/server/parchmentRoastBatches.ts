import { json } from '@sveltejs/kit';
import type { ParchmentClient, RoastBatch } from '@purveyors/sdk';
import { AuthError } from '$lib/server/auth';
import { ParchmentConfigError } from '$lib/server/parchmentClient';
import { collectOffsetPages } from '$lib/services/tools/pagination';
import { unwrapParchment } from '$lib/services/tools/parchment';

const PAGE_LIMIT = 200;
const BATCH_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A batch ID in the form Parchment stores and returns it, or null when the value is not one.
 * A UUID reads the same in either letter case, so an ID sent in capitals is the same batch.
 */
export function parseRoastBatchId(value: unknown): string | null {
	return typeof value === 'string' && BATCH_ID.test(value) ? value.toLowerCase() : null;
}

/**
 * List every roast batch the member owns, newest batch date first. A batch with no roasts
 * is left out unless `includeEmpty` is set; Parchment lists one under a placeholder name.
 * `dateStart` and `dateEnd` (`YYYY-MM-DD`, inclusive) keep the batches dated in that span.
 */
export function fetchParchmentRoastBatches(
	client: ParchmentClient,
	options: { includeEmpty?: boolean; dateStart?: string; dateEnd?: string } = {}
): Promise<RoastBatch[]> {
	const filter = {
		...(options.includeEmpty ? { include_empty: 'true' as const } : {}),
		...(options.dateStart === undefined ? {} : { date_start: options.dateStart }),
		...(options.dateEnd === undefined ? {} : { date_end: options.dateEnd })
	};
	return collectOffsetPages({
		// Called only after session authorization (no API-key cap).
		pageSize: PAGE_LIMIT,
		fetchPage: async (offset) =>
			unwrapParchment(await client.roastBatches.list({ ...filter, limit: PAGE_LIMIT, offset }))
				.data,
		key: (row) => row.id
	});
}

/** The JSON a roast-batch route answers with when the request did not reach Parchment. */
export function roastBatchRouteFailure(error: unknown, fallback: string) {
	if (error instanceof AuthError) return json({ error: error.message }, { status: error.status });
	if (error instanceof ParchmentConfigError) {
		return json({ error: 'Roast batches are temporarily unavailable' }, { status: 503 });
	}
	console.error(fallback, error);
	return json({ error: fallback }, { status: 500 });
}
