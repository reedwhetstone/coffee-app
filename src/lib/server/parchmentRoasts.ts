import type { components, ParchmentClient } from '@purveyors/sdk';
import { collectOffsetPages } from '$lib/services/tools/pagination';

export type ParchmentRoastProfile = components['schemas']['RoastListResource'];
export type ParchmentRoastTotals = components['schemas']['RoastListTotals'];

/** The most roasts one request asks Parchment for. */
export const ROAST_PAGE_LIMIT = 200;

/** The filters `GET /v1/roasts` narrows by. They narrow together. */
export interface RoastListFilter {
	/** A portfolio inventory id. */
	coffeeId?: number;
	roastId?: number;
	batchId?: string;
	/** `YYYY-MM-DD`, inclusive. */
	dateStart?: string;
	/** `YYYY-MM-DD`, inclusive. */
	dateEnd?: string;
	/** One search term across coffee name, batch name, and roast number. */
	q?: string;
	/** True for roasts of a wholesale coffee, false for every other roast. */
	isWholesale?: boolean;
}

export interface RoastList {
	data: ParchmentRoastProfile[];
	/** Totals for every roast the filters match, whatever page was asked for. */
	totals: ParchmentRoastTotals;
}

/** Parchment turned the roast list request down. `code` is its error code. */
export class ParchmentRoastListError extends Error {
	constructor(
		public status: number,
		public code: string,
		message: string
	) {
		super(message);
		this.name = 'ParchmentRoastListError';
	}
}

function upstreamQuery(filter: RoastListFilter) {
	return {
		...(filter.coffeeId === undefined ? {} : { coffee_id: filter.coffeeId }),
		...(filter.roastId === undefined ? {} : { roast_id: filter.roastId }),
		...(filter.batchId === undefined ? {} : { batch_id: filter.batchId }),
		...(filter.dateStart === undefined ? {} : { date_start: filter.dateStart }),
		...(filter.dateEnd === undefined ? {} : { date_end: filter.dateEnd }),
		...(filter.q === undefined ? {} : { q: filter.q }),
		...(filter.isWholesale === undefined ? {} : { is_wholesale: filter.isWholesale })
	};
}

async function listPage(
	client: ParchmentClient,
	filter: RoastListFilter,
	limit: number,
	offset: number
): Promise<RoastList> {
	const result = await client.roasts.list({ ...upstreamQuery(filter), limit, offset });
	if (result.error) {
		throw new ParchmentRoastListError(
			result.response.status,
			result.error.error.code,
			result.error.error.message
		);
	}
	if (result.data === undefined) throw new Error('Parchment API returned no data');
	return { data: result.data.data, totals: result.data.meta.totals };
}

/** One page of the owner's roasts under the filters, newest first, with the filtered totals. */
export function fetchParchmentRoastPage(
	client: ParchmentClient,
	filter: RoastListFilter,
	page: { limit: number; offset: number }
): Promise<RoastList> {
	return listPage(client, filter, page.limit, page.offset);
}

/**
 * Every owner-scoped roast the filters match, with the filtered totals.
 *
 * The canonical endpoint uses offset pagination, so every page is read. The stable
 * `roast_date DESC, roast_id DESC` ordering makes that traversal deterministic for a static
 * result set. For callers that need a whole set: one batch, one coffee's history, or the
 * choices in a picker.
 */
export async function fetchParchmentRoastList(
	client: ParchmentClient,
	filter: RoastListFilter = {}
): Promise<RoastList> {
	let totals: ParchmentRoastTotals | undefined;
	const data = await collectOffsetPages({
		// These BFF projections are called only after session authorization (no API-key cap).
		pageSize: ROAST_PAGE_LIMIT,
		fetchPage: async (offset) => {
			const page = await listPage(client, filter, ROAST_PAGE_LIMIT, offset);
			totals ??= page.totals;
			return page.data;
		},
		key: (row) => row.roast_id
	});
	if (totals === undefined) throw new Error('Parchment API returned no roast totals');
	return { data, totals };
}

/**
 * Every owner-scoped roast profile. `coffeeId` is a portfolio inventory id; with it,
 * Parchment returns only that coffee's roasts.
 */
export async function fetchParchmentRoasts(
	client: ParchmentClient,
	options: { coffeeId?: number } = {}
): Promise<ParchmentRoastProfile[]> {
	return (await fetchParchmentRoastList(client, options)).data;
}
