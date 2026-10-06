import type { RoastProfile } from '$lib/types/component.types';
import { parseBatchId, roastDay } from './roast-batches';

/** The most roasts the roast list route returns in one request. */
export const ROAST_REQUEST_LIMIT = 200;

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

/**
 * The batches dated from `start` to `end` (`YYYY-MM-DD`), each with the number of every roast
 * it holds, whatever the roast list is narrowed to.
 */
export async function requestBatchRosters(
	start: string,
	end: string,
	fetcher: typeof fetch = fetch
): Promise<Map<string, number[]>> {
	const response = await fetcher(`/api/roast-batches?date_start=${start}&date_end=${end}`);
	if (!response.ok) throw new Error(`Roast batches could not be loaded (${response.status})`);
	const body: unknown = await response.json();
	if (typeof body !== 'object' || body === null || !('data' in body) || !Array.isArray(body.data)) {
		throw new Error('Roast batches could not be read');
	}
	const rosters = new Map<string, number[]>();
	for (const batch of body.data as { id?: unknown; roast_ids?: unknown }[]) {
		const id = typeof batch?.id === 'string' ? parseBatchId(batch.id) : null;
		if (id && Array.isArray(batch.roast_ids)) rosters.set(id, batch.roast_ids as number[]);
	}
	return rosters;
}

function batchIds(roasts: readonly RoastProfile[]): string[] {
	return [...new Set(roasts.flatMap((roast) => parseBatchId(roast.batch_id) ?? []))];
}

/** The roasts held once a page's batches are finished, and the batches known to be whole. */
export interface WholeBatches {
	roasts: RoastProfile[];
	/** Batches shown with every roast they have under the filters, by batch ID. */
	whole: Set<string>;
}

/**
 * Finish the batches a page of the roast list shows.
 *
 * A page is cut by roast, newest first, and a batch can hold roasts from more than one day,
 * so any batch on a page may have roasts the page did not reach, not only the batch it ends
 * in. Each batch header counts every one of its roasts that matches, so the rest are read:
 *
 * 1. The batch the page ends in is read by its ID, as it is the one most often cut.
 * 2. The batch route says which roasts each of the page's batches holds. A batch with all
 *    of them held is whole and is not asked for.
 * 3. A batch that may still have more is read by its ID, or the roasts after the page are
 *    read through for them when that takes fewer requests.
 *
 * A request that fails leaves its batches as they are; they are not marked whole.
 */
export async function completeBatches(options: {
	/** Every roast held, the new page included. */
	held: readonly RoastProfile[];
	/** The roasts of the new page. */
	page: readonly RoastProfile[];
	/** Roasts asked for so far, a page at a time: where the next page starts. */
	offset: number;
	/** Roasts the filters match. */
	matching: number;
	/** Batches already known to be whole. */
	whole: ReadonlySet<string>;
	/** The list request for the filters in force, narrowed to one batch or to one page. */
	query: (
		batch: string | null,
		page: { limit: number; offset: number } | null
	) => URLSearchParams | string;
	fetcher?: typeof fetch;
}): Promise<WholeBatches> {
	const { page, offset, matching, query, fetcher = fetch } = options;
	const whole = new Set(options.whole);
	let roasts = [...options.held];

	// Nothing is left to load, so every batch shown is whole.
	if (offset >= matching || roasts.length >= matching) {
		for (const id of batchIds(roasts)) whole.add(id);
		return { roasts, whole };
	}

	let open = batchIds(page).filter((id) => !whole.has(id));
	if (open.length === 0) return { roasts, whole };

	const readBatch = async (id: string) => (await requestRoasts(query(id, null), fetcher)).data;
	const last = parseBatchId(page.at(-1)?.batch_id);
	const days = page.flatMap((roast) => roastDay(roast) ?? []).sort();
	const [rosters, lastRoasts] = await Promise.all([
		days.length > 0
			? requestBatchRosters(days[0], days[days.length - 1], fetcher).catch(() => null)
			: new Map<string, number[]>(),
		last !== null && open.includes(last) ? readBatch(last).catch(() => null) : null
	]);
	if (last !== null && lastRoasts) {
		roasts = mergeRoasts(roasts, lastRoasts);
		whole.add(last);
	}
	// Without the batches' own roasts there is no telling which other batch is cut.
	if (rosters === null) return { roasts, whole };

	const heldIds = new Set(roasts.map((roast) => roast.roast_id));
	open = open.filter((id) => {
		if (whole.has(id)) return false;
		if (!rosters.get(id)?.every((roastId) => heldIds.has(roastId))) return true;
		whole.add(id);
		return false;
	});
	if (open.length === 0) return { roasts, whole };

	const readsAhead = Math.ceil((matching - offset) / ROAST_REQUEST_LIMIT);
	if (open.length <= readsAhead) {
		const batches = await Promise.all(
			open.map((id) =>
				readBatch(id)
					.then((rest) => ({ id, rest }))
					.catch(() => null)
			)
		);
		for (const batch of batches) {
			if (!batch) continue;
			roasts = mergeRoasts(roasts, batch.rest);
			whole.add(batch.id);
		}
		return { roasts, whole };
	}

	try {
		const wanted = new Set(open);
		const pages = await Promise.all(
			Array.from({ length: readsAhead }, (_, index) =>
				requestRoasts(
					query(null, { limit: ROAST_REQUEST_LIMIT, offset: offset + index * ROAST_REQUEST_LIMIT }),
					fetcher
				)
			)
		);
		for (const ahead of pages) {
			roasts = mergeRoasts(
				roasts,
				ahead.data.filter((roast) => wanted.has(parseBatchId(roast.batch_id) ?? ''))
			);
		}
		for (const id of open) whole.add(id);
	} catch {
		// The batches stay as they are.
	}
	return { roasts, whole };
}
