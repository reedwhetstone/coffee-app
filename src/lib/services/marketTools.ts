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
	supplierList as cliSupplierList,
	type SupplierAggregate,
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

const MAX_ROWS = 5000;
const PAGE_SIZE = 1000;

/**
 * Fetch all matching rows with range pagination. PostgREST caps single
 * responses at 1000 rows; legacy compatibility fields still need the sampled
 * row-level values that are not exposed by the CLI supplier aggregate yet.
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
	total_listings: number;
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
		total_listings: response.meta.rows_examined,
		distinct_values: response.meta.distinct_values,
		values: response.data,
		truncated: response.meta.truncated
	};

	setCached(cacheKey, result);
	return result;
}

// ─── supplier_list ───────────────────────────────────────────────────────────

const DEFAULT_SUPPLIER_LIMIT = 15;
const MAX_SUPPLIER_LIMIT = 25;
const SUPPLIER_LEGACY_COLUMNS = 'source, country, stocked, wholesale, score_value';

export interface SupplierListInput {
	stocked_only?: boolean;
	non_wholesale_only?: boolean;
	country?: string;
	limit?: number;
}

export interface SupplierSummary extends SupplierAggregate {
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
	rows_examined: number;
	caveats: string[];
	truncated: boolean;
}

type SupplierLegacySummary = Pick<
	SupplierSummary,
	'non_wholesale_listings' | 'avg_cup_score' | 'top_countries'
>;

async function getSupplierLegacySummaries(
	client: MarketToolsClient,
	input: { stockedOnly: boolean; nonWholesaleOnly: boolean; country: string | null }
): Promise<Map<string, SupplierLegacySummary>> {
	const rows = await fetchAllRows(() => {
		let query = client.from('coffee_catalog').select(SUPPLIER_LEGACY_COLUMNS);
		if (input.stockedOnly) query = query.eq('stocked', true);
		if (input.country) query = query.ilike('country', `%${input.country}%`);
		if (input.nonWholesaleOnly) query = query.or('wholesale.is.null,wholesale.eq.false');
		return query;
	});

	interface Bucket {
		nonWholesale: number;
		cupScores: number[];
		countries: Map<string, number>;
	}

	const buckets = new Map<string, Bucket>();
	for (const row of rows) {
		const supplier = typeof row.source === 'string' ? row.source.trim() : '';
		if (!supplier) continue;

		let bucket = buckets.get(supplier);
		if (!bucket) {
			bucket = { nonWholesale: 0, cupScores: [], countries: new Map() };
			buckets.set(supplier, bucket);
		}

		if (row.wholesale !== true) bucket.nonWholesale += 1;

		const cupScore = asNumber(row.score_value);
		if (cupScore !== null && cupScore > 0) bucket.cupScores.push(cupScore);

		const rowCountry = typeof row.country === 'string' ? row.country.trim() : '';
		if (rowCountry) bucket.countries.set(rowCountry, (bucket.countries.get(rowCountry) ?? 0) + 1);
	}

	const avg = (values: number[], decimals: number): number | null =>
		values.length ? round(values.reduce((sum, v) => sum + v, 0) / values.length, decimals) : null;

	return new Map(
		[...buckets.entries()].map(([supplier, bucket]) => [
			supplier,
			{
				non_wholesale_listings: bucket.nonWholesale,
				avg_cup_score: avg(bucket.cupScores, 1),
				top_countries: [...bucket.countries.entries()]
					.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
					.slice(0, 3)
					.map(([name]) => name)
			}
		])
	);
}

function toSupplierSummary(
	supplier: SupplierAggregate,
	legacy?: SupplierLegacySummary
): SupplierSummary {
	return {
		...supplier,
		listings: supplier.total,
		non_wholesale_listings: legacy?.non_wholesale_listings ?? supplier.total,
		price_min: supplier.price.min_per_lb,
		price_max: supplier.price.max_per_lb,
		avg_purveyor_score: supplier.score.average,
		avg_cup_score: legacy?.avg_cup_score ?? null,
		top_countries: legacy?.top_countries.length ? legacy.top_countries : supplier.origins
	};
}

export async function getSupplierList(
	client: MarketToolsClient,
	input: SupplierListInput = {}
): Promise<SupplierListResult> {
	const stockedOnly = input.stocked_only ?? true;
	const country = input.country ? sanitizeFilterValue(input.country) : null;
	const limit = Math.min(Math.max(input.limit ?? DEFAULT_SUPPLIER_LIMIT, 1), MAX_SUPPLIER_LIMIT);
	const cacheKey = `suppliers:${stockedOnly}:${input.non_wholesale_only ?? false}:${country ?? ''}:${limit}`;

	const cached = getCached<SupplierListResult>(cacheKey);
	if (cached) return cached;

	const response = await cliSupplierList(client as never, {
		stocked: stockedOnly,
		country: country ?? undefined,
		nonWholesaleOnly: input.non_wholesale_only ?? false,
		limit,
		sampleSize: MAX_ROWS
	});
	const legacySummaries = await getSupplierLegacySummaries(client, {
		stockedOnly,
		nonWholesaleOnly: input.non_wholesale_only ?? false,
		country
	});

	const result: SupplierListResult = {
		suppliers: response.data.map((supplier) =>
			toSupplierSummary(supplier, legacySummaries.get(supplier.supplier))
		),
		total_suppliers: response.meta.returned,
		scope: {
			stocked_only: stockedOnly,
			non_wholesale_only: input.non_wholesale_only ?? false,
			country
		},
		rows_examined: response.meta.rows_examined,
		caveats: response.meta.caveats,
		truncated: response.meta.truncated
	};

	setCached(cacheKey, result);
	return result;
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
		priceMax: input.max_price != null && input.max_price > 0 ? input.max_price : undefined,
		minScore:
			input.min_purveyor_score != null && input.min_purveyor_score > 0
				? input.min_purveyor_score
				: undefined,
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
