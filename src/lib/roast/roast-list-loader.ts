import type { RoastProfile } from '$lib/types/component.types';

/** Totals for every roast the filters match, whatever page was asked for. */
export interface RoastListTotals {
	roasts: number;
	batches: number;
	/** Null when none of the matching roasts has a weight loss on record. */
	average_loss_percent: number | null;
}

/** What the roast list route answers with. */
export interface RoastListPage {
	data: RoastProfile[];
	totals: RoastListTotals;
}

/**
 * The roast list route turned a request down. `invalid-search` is a search term that cannot
 * be used, which the page explains; anything else is a failure to try again.
 */
export class RoastListRequestError extends Error {
	constructor(public kind: 'invalid-search' | 'failed') {
		super(kind === 'invalid-search' ? 'Invalid search term' : 'Roasts could not be loaded');
		this.name = 'RoastListRequestError';
	}
}

function isTotals(value: unknown): value is RoastListTotals {
	if (typeof value !== 'object' || value === null) return false;
	const totals = value as Record<string, unknown>;
	return (
		typeof totals.roasts === 'number' &&
		typeof totals.batches === 'number' &&
		(totals.average_loss_percent === null || typeof totals.average_loss_percent === 'number')
	);
}

/** Ask the roast list route for the roasts a query names. */
export async function requestRoasts(
	query: URLSearchParams | string,
	fetcher: typeof fetch = fetch
): Promise<RoastListPage> {
	const response = await fetcher(`/api/roast-profiles?${query}`);
	if (!response.ok) {
		const failure: unknown = await response.json().catch(() => null);
		const code =
			typeof failure === 'object' && failure !== null && 'code' in failure ? failure.code : null;
		throw new RoastListRequestError(
			response.status === 400 && code === 'invalid_search' ? 'invalid-search' : 'failed'
		);
	}
	const body: unknown = await response.json();
	if (
		typeof body !== 'object' ||
		body === null ||
		!('data' in body) ||
		!Array.isArray(body.data) ||
		!('totals' in body) ||
		!isTotals(body.totals)
	) {
		throw new RoastListRequestError('failed');
	}
	return { data: body.data as RoastProfile[], totals: body.totals };
}

/** One roast by its number, or null when the account has no such roast. */
export async function requestRoast(
	roastId: number,
	fetcher: typeof fetch = fetch
): Promise<RoastProfile | null> {
	return (await requestRoasts(`roast_id=${roastId}`, fetcher)).data[0] ?? null;
}

/** Every roast in one batch, newest first. */
export async function requestBatchRoasts(
	batchId: string,
	fetcher: typeof fetch = fetch
): Promise<RoastProfile[]> {
	return (await requestRoasts(`batch_id=${batchId}`, fetcher)).data;
}

/** Add roasts to a list, keeping the first copy of any roast both hold. */
export function mergeRoasts<T extends { roast_id: number }>(
	held: readonly T[],
	added: readonly T[]
): T[] {
	const seen = new Set(held.map((roast) => roast.roast_id));
	const merged = [...held];
	for (const roast of added) {
		if (seen.has(roast.roast_id)) continue;
		seen.add(roast.roast_id);
		merged.push(roast);
	}
	return merged;
}
