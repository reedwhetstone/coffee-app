/**
 * Market intelligence data functions for the chat agent.
 *
 * These back the catalog_facets, supplier_list, and catalog_rank chat tools.
 * They read only the public coffee_catalog surface (RLS limits SELECT to
 * public_coffee = true for every role), so results are identical for all
 * users and safe to cache process-wide.
 *
 * Ranking is deterministic and server-side: the LLM narrates orderings, it
 * never invents them. Purveyor Score is the single quality composite —
 * objectives change the sort, not the score.
 */

import {
	catalogFacetFields,
	catalogRankObjectives,
	listCatalogFacets as cliListCatalogFacets,
	rankCatalog as cliRankCatalog,
	type CatalogFacetField,
	type CatalogRankObjective
} from '@purveyors/cli/catalog';

interface CatalogRowsResult {
	data: Array<Record<string, unknown>> | null;
	error: { message: string } | null;
}

interface CatalogQueryBuilder extends PromiseLike<CatalogRowsResult> {
	eq(column: string, value: string | boolean | number): CatalogQueryBuilder;
	gte(column: string, value: string | number): CatalogQueryBuilder;
	lte(column: string, value: string | number): CatalogQueryBuilder;
	ilike(column: string, pattern: string): CatalogQueryBuilder;
	or(filter: string): CatalogQueryBuilder;
	order(column: string, options: { ascending: boolean; nullsFirst?: boolean }): CatalogQueryBuilder;
	range(from: number, to: number): CatalogQueryBuilder;
	limit(count: number): CatalogQueryBuilder;
}

export interface MarketToolsClient {
	from(table: 'coffee_catalog'): {
		select(columns: string): CatalogQueryBuilder;
	};
}

// ─── Process-wide TTL cache (catalog visibility is uniform across users) ────

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const cache = new Map<string, { expires: number; value: unknown }>();

function getCached<T>(key: string): T | undefined {
	const entry = cache.get(key);
	if (!entry) return undefined;
	if (Date.now() > entry.expires) {
		cache.delete(key);
		return undefined;
	}
	return entry.value as T;
}

function setCached(key: string, value: unknown): void {
	cache.set(key, { expires: Date.now() + CACHE_TTL_MS, value });
}

/** Test hook: clear the market tools cache. */
export function _clearMarketToolsCache(): void {
	cache.clear();
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

/** Strip PostgREST filter metacharacters from ilike inputs (CLI parity). */
function sanitizeFilterValue(value: string): string {
	return value.replace(/[%_,()]/g, ' ').trim();
}

const PAGE_SIZE = 1000;
const MAX_ROWS = 5000;

/**
 * Fetch all matching rows with range pagination. PostgREST caps single
 * responses at 1000 rows; aggregate tools need the full stocked set.
 */
async function fetchAllRows(
	buildQuery: () => CatalogQueryBuilder
): Promise<Array<Record<string, unknown>>> {
	const rows: Array<Record<string, unknown>> = [];

	for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
		const { data, error } = await buildQuery().range(offset, offset + PAGE_SIZE - 1);
		if (error) throw new Error(`coffee_catalog query failed: ${error.message}`);
		const page = data ?? [];
		rows.push(...page);
		if (page.length < PAGE_SIZE) break;
	}

	return rows;
}

function asNumber(value: unknown): number | null {
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'string') {
		const parsed = Number.parseFloat(value);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
}

function round(value: number, decimals = 2): number {
	const factor = 10 ** decimals;
	return Math.round(value * factor) / factor;
}

// ─── catalog_facets ──────────────────────────────────────────────────────────

export const CATALOG_FACET_FIELDS = catalogFacetFields;
export type { CatalogFacetField };

const MAX_FACET_VALUES = 60;

export interface CatalogFacetsInput {
	field: CatalogFacetField;
	stocked_only?: boolean;
}

export interface CatalogFacetsResult {
	field: CatalogFacetField;
	stocked_only: boolean;
	scope: 'stocked_only' | 'all_visible';
	rows_examined: number;
	distinct_values: number;
	values: Array<{ value: string; count: number }>;
	truncated: boolean;
}

export async function getCatalogFacets(
	client: MarketToolsClient,
	input: CatalogFacetsInput
): Promise<CatalogFacetsResult> {
	const stockedOnly = input.stocked_only ?? true;
	const cacheKey = `facets:${input.field}:${stockedOnly}`;

	const cached = getCached<CatalogFacetsResult>(cacheKey);
	if (cached) return cached;

	const response = await cliListCatalogFacets(client as never, {
		field: input.field,
		stockedOnly,
		limit: MAX_FACET_VALUES,
		sampleSize: MAX_ROWS
	});

	const result: CatalogFacetsResult = {
		field: response.meta.field,
		stocked_only: response.meta.stocked_only,
		scope: response.meta.scope,
		rows_examined: response.meta.rows_examined,
		distinct_values: response.meta.distinct_values,
		values: response.data,
		truncated: response.meta.truncated
	};

	setCached(cacheKey, result);
	return result;
}

// ─── supplier_list ───────────────────────────────────────────────────────────

const SUPPLIER_LIST_COLUMNS =
	'source, country, stocked, wholesale, price_per_lb, score_value, purveyor_score';
const DEFAULT_SUPPLIER_LIMIT = 15;
const MAX_SUPPLIER_LIMIT = 25;

export interface SupplierListInput {
	stocked_only?: boolean;
	non_wholesale_only?: boolean;
	country?: string;
	limit?: number;
}

export interface SupplierSummary {
	supplier: string;
	listings: number;
	non_wholesale_listings: number;
	price_min: number | null;
	price_max: number | null;
	avg_purveyor_score: number | null;
	avg_cup_score: number | null;
	top_countries: string[];
}

export interface SupplierListResult {
	suppliers: SupplierSummary[];
	total_suppliers: number;
	scope: { stocked_only: boolean; non_wholesale_only: boolean; country: string | null };
	truncated: boolean;
}

export async function getSupplierList(
	client: MarketToolsClient,
	input: SupplierListInput = {}
): Promise<SupplierListResult> {
	const stockedOnly = input.stocked_only ?? true;
	const nonWholesaleOnly = input.non_wholesale_only ?? false;
	const country = input.country ? sanitizeFilterValue(input.country) : null;
	const limit = Math.min(Math.max(input.limit ?? DEFAULT_SUPPLIER_LIMIT, 1), MAX_SUPPLIER_LIMIT);
	const cacheKey = `suppliers:${stockedOnly}:${nonWholesaleOnly}:${country ?? ''}`;

	let aggregated = getCached<SupplierSummary[]>(cacheKey);

	if (!aggregated) {
		const rows = await fetchAllRows(() => {
			let query = client.from('coffee_catalog').select(SUPPLIER_LIST_COLUMNS);
			if (stockedOnly) query = query.eq('stocked', true);
			if (country) query = query.ilike('country', `%${country}%`);
			return query;
		});

		interface Bucket {
			listings: number;
			nonWholesale: number;
			prices: number[];
			purveyorScores: number[];
			cupScores: number[];
			countries: Map<string, number>;
		}

		const buckets = new Map<string, Bucket>();
		for (const row of rows) {
			const supplier = typeof row.source === 'string' ? row.source.trim() : '';
			if (!supplier) continue;
			const isWholesale = row.wholesale === true;
			if (nonWholesaleOnly && isWholesale) continue;

			let bucket = buckets.get(supplier);
			if (!bucket) {
				bucket = {
					listings: 0,
					nonWholesale: 0,
					prices: [],
					purveyorScores: [],
					cupScores: [],
					countries: new Map()
				};
				buckets.set(supplier, bucket);
			}

			bucket.listings += 1;
			if (!isWholesale) bucket.nonWholesale += 1;

			const price = asNumber(row.price_per_lb);
			if (price !== null && price > 0) bucket.prices.push(price);

			const purveyorScore = asNumber(row.purveyor_score);
			if (purveyorScore !== null) bucket.purveyorScores.push(purveyorScore);

			const cupScore = asNumber(row.score_value);
			if (cupScore !== null && cupScore > 0) bucket.cupScores.push(cupScore);

			const rowCountry = typeof row.country === 'string' ? row.country.trim() : '';
			if (rowCountry) bucket.countries.set(rowCountry, (bucket.countries.get(rowCountry) ?? 0) + 1);
		}

		const avg = (values: number[], decimals: number): number | null =>
			values.length ? round(values.reduce((sum, v) => sum + v, 0) / values.length, decimals) : null;

		aggregated = [...buckets.entries()]
			.map(([supplier, bucket]) => ({
				supplier,
				listings: bucket.listings,
				non_wholesale_listings: bucket.nonWholesale,
				price_min: bucket.prices.length ? round(Math.min(...bucket.prices)) : null,
				price_max: bucket.prices.length ? round(Math.max(...bucket.prices)) : null,
				avg_purveyor_score: avg(bucket.purveyorScores, 1),
				avg_cup_score: avg(bucket.cupScores, 1),
				top_countries: [...bucket.countries.entries()]
					.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
					.slice(0, 3)
					.map(([name]) => name)
			}))
			.sort((a, b) => b.listings - a.listings || a.supplier.localeCompare(b.supplier));

		setCached(cacheKey, aggregated);
	}

	return {
		suppliers: aggregated.slice(0, limit),
		total_suppliers: aggregated.length,
		scope: { stocked_only: stockedOnly, non_wholesale_only: nonWholesaleOnly, country },
		truncated: aggregated.length > limit
	};
}

// ─── catalog_rank ────────────────────────────────────────────────────────────

export const RANK_OBJECTIVES = catalogRankObjectives;
export type RankObjective = CatalogRankObjective;

const DEFAULT_RANK_LIMIT = 8;
const MAX_RANK_LIMIT = 15;

export interface RankCatalogInput {
	objective: RankObjective;
	stocked_only?: boolean;
	supplier?: string;
	country?: string;
	process?: string;
	max_price?: number;
	min_purveyor_score?: number;
	non_wholesale_only?: boolean;
	limit?: number;
}

export interface RankedCoffee extends Record<string, unknown> {
	rank: number;
	rank_basis: string;
}

export interface RankCatalogResult {
	objective: RankObjective;
	coffees: RankedCoffee[];
	candidates_considered: number;
	caveats: string[];
	filters_applied: RankCatalogInput;
}

export async function rankCatalog(
	client: MarketToolsClient,
	input: RankCatalogInput
): Promise<RankCatalogResult> {
	const limit = Math.min(Math.max(input.limit ?? DEFAULT_RANK_LIMIT, 1), MAX_RANK_LIMIT);
	const response = await cliRankCatalog(client as never, {
		objective: input.objective,
		stockedOnly: input.stocked_only ?? true,
		supplier: input.supplier,
		country: input.country,
		process: input.process,
		priceMax: input.max_price,
		minScore: input.min_purveyor_score,
		nonWholesaleOnly: input.non_wholesale_only,
		limit,
		sampleSize: MAX_ROWS
	});

	return {
		objective: response.meta.objective,
		coffees: response.data as unknown as RankedCoffee[],
		candidates_considered: response.meta.candidates_considered,
		caveats: response.meta.caveats,
		filters_applied: input
	};
}
