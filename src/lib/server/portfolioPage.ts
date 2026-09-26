import type { ParchmentClient } from '@purveyors/sdk';
import {
	processData,
	getFieldValue,
	getFilterableColumns,
	type DataItem
} from '$lib/data/catalogFilters';
import type { CatalogFilterValue } from '$lib/catalog/urlState';
import { fetchParchmentInventoryProjection, projectInventoryResource } from './parchmentInventory';
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
	if (sort && !fields.includes(sort)) throw new Error('Invalid portfolio sort');
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

/** Compatibility only for an older API or specifically absent Portfolio RPC. */
export function legacyPortfolioPage(rows: DataItem[], query: PortfolioQuery): PortfolioPage {
	const selected = processData(rows, query.sortField, query.sortDirection, query.filters, true);
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
export async function fetchPortfolioPage(
	client: ParchmentClient,
	query: PortfolioQuery,
	includeRoasts: boolean
): Promise<PortfolioPage> {
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
	const rows = await fetchParchmentInventoryProjection(client, {
		includeRoastProfiles: includeRoasts
	});
	return legacyPortfolioPage(rows as unknown as DataItem[], query);
}
