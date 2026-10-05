import type { ParchmentClient } from '@purveyors/sdk';
import {
	processData,
	getFieldValue,
	getFilterableColumns,
	type DataItem
} from '$lib/data/catalogFilters';
import type { CatalogFilterValue } from '$lib/catalog/urlState';
import { fetchParchmentInventoryProjection, projectInventoryResource } from './parchmentInventory';
import { fetchParchmentRoasts } from './parchmentRoasts';

/**
 * Sort by green coffee left to roast. Parchment's Portfolio query cannot order by it, so
 * this one sort is applied here over the whole filtered selection.
 */
export const REMAINING_SORT = 'remaining';
/** Parchment returns at most this many Portfolio rows per request. */
const SELECTION_PAGE_LIMIT = 100;
export type PortfolioQuery = {
	filters: Record<string, CatalogFilterValue>;
	sortField: string | null;
	sortDirection: 'asc' | 'desc' | null;
	offset: number;
	limit: number;
};
export type PortfolioContext = {
	summary: {
		totalCount: number;
		value: number;
		purchasedLbs: number;
		remainingLbs: number;
		stockedCount: number;
		avgCost: number;
	};
	sources: Record<string, { count: number; weight: number; value: number }>;
	uniqueValues: Record<string, string[]>;
	ownerTotal: number;
};
export type PortfolioPage = {
	data: DataItem[];
	pagination: { offset: number; limit: number; total: number; hasNext: boolean };
	portfolio: PortfolioContext;
};
export function parsePortfolioQuery(params: URLSearchParams): PortfolioQuery {
	const filters = JSON.parse(params.get('filters') ?? '{"stocked":"TRUE"}');
	if (!filters || Array.isArray(filters) || typeof filters !== 'object')
		throw new Error('Invalid portfolio filters');
	const offset = Number(params.get('offset') ?? 0),
		limit = Number(params.get('limit') ?? 50);
	if (
		!Number.isSafeInteger(offset) ||
		offset < 0 ||
		!Number.isSafeInteger(limit) ||
		limit < 1 ||
		limit > 100
	)
		throw new Error('Invalid portfolio page');
	const fields = getFilterableColumns('/beans');
	if (Object.keys(filters).some((key) => !fields.includes(key)))
		throw new Error('Invalid portfolio filter');
	const sort = params.get('sort_field') ?? 'purchase_date';
	if (sort && sort !== REMAINING_SORT && !fields.includes(sort))
		throw new Error('Invalid portfolio sort');
	const direction = params.get('sort_direction') ?? 'desc';
	if (!['asc', 'desc'].includes(direction)) throw new Error('Invalid portfolio sort');
	return {
		filters,
		sortField: params.get('sort_field') ?? 'purchase_date',
		sortDirection: direction as 'asc' | 'desc',
		offset,
		limit
	};
}

/** Pounds of a portfolio coffee not yet roasted. Mirrors the card's "remaining" figure. */
function remainingLbs(row: DataItem): number {
	const roasts = (row.roast_profiles ?? []) as { oz_in?: number | null }[];
	const roastedOz =
		row.roasted_oz_in != null
			? Number(row.roasted_oz_in) || 0
			: roasts.reduce((sum, roast) => sum + (Number(roast.oz_in) || 0), 0);
	return (Number(row.purchased_qty_lbs) || 0) - roastedOz / 16;
}

function sortByRemaining(rows: DataItem[], direction: 'asc' | 'desc' | null): DataItem[] {
	const sign = direction === 'asc' ? 1 : -1;
	return [...rows].sort(
		(a, b) =>
			sign * (remainingLbs(a) - remainingLbs(b)) || (Number(b.id) || 0) - (Number(a.id) || 0)
	);
}

/** Compatibility only for an older API or specifically absent Portfolio RPC. */
export function legacyPortfolioPage(rows: DataItem[], query: PortfolioQuery): PortfolioPage {
	const byRemaining = query.sortField === REMAINING_SORT;
	const matched = processData(
		rows,
		byRemaining ? null : query.sortField,
		byRemaining ? null : query.sortDirection,
		query.filters,
		true
	);
	const selected = byRemaining ? sortByRemaining(matched, query.sortDirection) : matched;
	const sources: PortfolioContext['sources'] = Object.create(null);
	const summary = {
		totalCount: selected.length,
		value: 0,
		purchasedLbs: 0,
		remainingLbs: 0,
		stockedCount: 0,
		avgCost: 0
	};
	for (const row of selected) {
		const value = (Number(row.bean_cost) || 0) + (Number(row.tax_ship_cost) || 0),
			weight = Number(row.purchased_qty_lbs) || 0;
		const roasts = (row.roast_profiles ?? []) as { oz_in?: number }[];
		const remaining = weight - roasts.reduce((sum, r) => sum + (Number(r.oz_in) || 0), 0) / 16;
		summary.value += value;
		summary.purchasedLbs += weight;
		summary.remainingLbs += remaining >= 0.5 ? remaining : 0;
		summary.stockedCount += row.stocked ? 1 : 0;
		const source = String(getFieldValue(row, 'source') || 'Unknown');
		const group = (sources[source] ??= { count: 0, weight: 0, value: 0 });
		group.count++;
		group.weight += weight;
		group.value += value;
	}
	summary.avgCost = summary.purchasedLbs > 0 ? summary.value / summary.purchasedLbs : 0;
	const uniqueValues: Record<string, string[]> = {};
	for (const [key, field] of Object.entries({
		sources: 'source',
		continents: 'continent',
		countries: 'country',
		arrivalDates: 'arrival_date',
		purchaseDates: 'purchase_date'
	})) {
		uniqueValues[key] = [
			...new Set(
				rows
					.map((row) => getFieldValue(row, field))
					.filter(Boolean)
					.map(String)
			)
		].sort();
	}
	return {
		data: selected.slice(query.offset, query.offset + query.limit),
		pagination: {
			offset: query.offset,
			limit: query.limit,
			total: selected.length,
			hasNext: query.offset + query.limit < selected.length
		},
		portfolio: { summary, sources, uniqueValues, ownerTotal: rows.length }
	};
}
/** How often and how recently each portfolio coffee was roasted, keyed by inventory id. */
type RoastFacts = Map<number, { roast_count: number; last_roast_date: string | null }>;

/**
 * The card's "last roasted" line. Parchment's Portfolio response does not carry it, so it
 * is joined here from the owner's roast list. A failed roast read leaves the cards without
 * that line and never fails the portfolio.
 */
async function fetchRoastFacts(client: ParchmentClient): Promise<RoastFacts | null> {
	try {
		const facts: RoastFacts = new Map();
		for (const roast of await fetchParchmentRoasts(client)) {
			if (roast.coffee_id === null) continue;
			const entry = facts.get(roast.coffee_id) ?? { roast_count: 0, last_roast_date: null };
			entry.roast_count += 1;
			const day = roast.roast_date?.slice(0, 10) ?? null;
			if (day && (entry.last_roast_date === null || day > entry.last_roast_date)) {
				entry.last_roast_date = day;
			}
			facts.set(roast.coffee_id, entry);
		}
		return facts;
	} catch (error) {
		console.error('Error loading roast dates for the portfolio:', error);
		return null;
	}
}

function withRoastFacts(page: PortfolioPage, facts: RoastFacts | null): PortfolioPage {
	if (!facts) return page;
	return {
		...page,
		data: page.data.map((row) => ({
			...row,
			...(facts.get(Number(row.id)) ?? { roast_count: 0, last_roast_date: null })
		}))
	};
}

/** One bounded page from Parchment's Portfolio query, or null when the API predates it. */
async function requestPortfolioPage(
	client: ParchmentClient,
	query: PortfolioQuery
): Promise<PortfolioPage | null> {
	const request = {
		portfolio: 'true',
		include_pagination: 'true',
		filters: JSON.stringify(query.filters),
		sort_field: query.sortField ?? '',
		sort_direction: query.sortDirection ?? 'desc',
		offset: query.offset,
		limit: query.limit
	};
	const result = await client.inventory.list(
		request as Parameters<typeof client.inventory.list>[0]
	);
	const body = result.data as unknown as PortfolioPage | undefined;
	const code = (result.error as { error?: { code?: string } } | undefined)?.error?.code;
	if (result.error && code !== 'portfolio_query_unavailable')
		throw new Error('Unable to load Portfolio page');
	if (
		!result.error &&
		body?.portfolio &&
		body.pagination &&
		typeof body.pagination.total === 'number'
	) {
		return {
			...body,
			data: body.data.map((row) => ({
				...projectInventoryResource(row as never),
				roasted_oz_in: row.roasted_oz_in
			}))
		};
	}
	if (!result.error && body?.portfolio !== undefined) throw new Error('Invalid Portfolio response');
	// Old APIs ignore unknown query parameters and return 200 without the new
	// envelope. Never mistake that first page for the whole selected portfolio.
	if (!result.error && (!body || !Array.isArray(body.data)))
		throw new Error('Invalid Portfolio response');
	return null;
}

/**
 * The "Remaining" sort. Every row of the filtered selection is read in Parchment's own
 * order, sorted here by what is left to roast, and cut to the requested page. The totals
 * and source groups are Parchment's and already describe the whole selection.
 */
async function requestPortfolioPageByRemaining(
	client: ParchmentClient,
	query: PortfolioQuery
): Promise<PortfolioPage | null> {
	const selection = { ...query, sortField: 'purchase_date', sortDirection: 'desc' as const };
	const rows: DataItem[] = [];
	let first: PortfolioPage | null = null;
	for (let offset = 0; ; offset += SELECTION_PAGE_LIMIT) {
		const page = await requestPortfolioPage(client, {
			...selection,
			offset,
			limit: SELECTION_PAGE_LIMIT
		});
		if (!page) return null;
		first ??= page;
		rows.push(...page.data);
		if (!page.pagination.hasNext || page.data.length === 0) break;
	}
	const sorted = sortByRemaining(rows, query.sortDirection);
	return {
		data: sorted.slice(query.offset, query.offset + query.limit),
		pagination: {
			offset: query.offset,
			limit: query.limit,
			total: sorted.length,
			hasNext: query.offset + query.limit < sorted.length
		},
		portfolio: first!.portfolio
	};
}

export async function fetchPortfolioPage(
	client: ParchmentClient,
	query: PortfolioQuery,
	includeRoasts: boolean
): Promise<PortfolioPage> {
	// The roast read does not depend on the inventory read, so both start together.
	const roastFacts = includeRoasts ? fetchRoastFacts(client) : Promise.resolve(null);
	const page =
		query.sortField === REMAINING_SORT
			? await requestPortfolioPageByRemaining(client, query)
			: await requestPortfolioPage(client, query);
	if (page) return withRoastFacts(page, await roastFacts);

	const rows = await fetchParchmentInventoryProjection(client, {
		includeRoastProfiles: includeRoasts
	});
	return withRoastFacts(
		legacyPortfolioPage(rows as unknown as DataItem[], query),
		await roastFacts
	);
}
