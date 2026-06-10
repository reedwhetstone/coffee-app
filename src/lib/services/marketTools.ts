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

interface CatalogRowsResult {
	data: Array<Record<string, unknown>> | null;
	error: { message: string } | null;
}

interface CatalogQueryBuilder extends PromiseLike<CatalogRowsResult> {
	eq(column: string, value: string | boolean | number): CatalogQueryBuilder;
	gte(column: string, value: string | number): CatalogQueryBuilder;
	lte(column: string, value: string | number): CatalogQueryBuilder;
	ilike(column: string, pattern: string): CatalogQueryBuilder;
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

export const CATALOG_FACET_FIELDS = [
	'supplier',
	'country',
	'processing_base_method',
	'fermentation_type',
	'drying_method',
	'grade',
	'wholesale'
] as const;

export type CatalogFacetField = (typeof CATALOG_FACET_FIELDS)[number];

const FACET_COLUMNS: Record<CatalogFacetField, string> = {
	supplier: 'source',
	country: 'country',
	processing_base_method: 'processing_base_method',
	fermentation_type: 'fermentation_type',
	drying_method: 'drying_method',
	grade: 'grade',
	wholesale: 'wholesale'
};

const MAX_FACET_VALUES = 60;

export interface CatalogFacetsInput {
	field: CatalogFacetField;
	stocked_only?: boolean;
}

export interface CatalogFacetsResult {
	field: CatalogFacetField;
	stocked_only: boolean;
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
	const column = FACET_COLUMNS[input.field];
	const cacheKey = `facets:${input.field}:${stockedOnly}`;

	const cached = getCached<CatalogFacetsResult>(cacheKey);
	if (cached) return cached;

	const rows = await fetchAllRows(() => {
		let query = client.from('coffee_catalog').select(column);
		if (stockedOnly) query = query.eq('stocked', true);
		return query;
	});

	const counts = new Map<string, number>();
	for (const row of rows) {
		const raw = row[column];
		const value =
			typeof raw === 'boolean' ? String(raw) : typeof raw === 'string' ? raw.trim() : null;
		if (!value) continue;
		counts.set(value, (counts.get(value) ?? 0) + 1);
	}

	const sorted = [...counts.entries()]
		.map(([value, count]) => ({ value, count }))
		.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));

	const result: CatalogFacetsResult = {
		field: input.field,
		stocked_only: stockedOnly,
		total_listings: rows.length,
		distinct_values: sorted.length,
		values: sorted.slice(0, MAX_FACET_VALUES),
		truncated: sorted.length > MAX_FACET_VALUES
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

export const RANK_OBJECTIVES = ['premium', 'value', 'fresh_arrival', 'rare_origin'] as const;
export type RankObjective = (typeof RANK_OBJECTIVES)[number];

const RANK_COLUMNS =
	'id, name, source, country, region, processing, processing_base_method, grade, cultivar_detail, description_short, price_per_lb, score_value, stocked, stocked_date, arrival_date, wholesale, purveyor_score, purveyor_score_tier, purveyor_score_confidence, purveyor_score_factors, purveyor_score_version';
const RANK_CANDIDATE_POOL = 500;
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

function scoreLabel(row: Record<string, unknown>): string {
	const score = asNumber(row.purveyor_score);
	if (score === null) return 'no Purveyor Score yet';
	const tier = typeof row.purveyor_score_tier === 'string' ? `, ${row.purveyor_score_tier}` : '';
	return `Purveyor Score ${score}${tier}`;
}

export async function rankCatalog(
	client: MarketToolsClient,
	input: RankCatalogInput
): Promise<RankCatalogResult> {
	const stockedOnly = input.stocked_only ?? true;
	const limit = Math.min(Math.max(input.limit ?? DEFAULT_RANK_LIMIT, 1), MAX_RANK_LIMIT);

	let query = client.from('coffee_catalog').select(RANK_COLUMNS);
	if (stockedOnly) query = query.eq('stocked', true);
	if (input.supplier) query = query.ilike('source', `%${sanitizeFilterValue(input.supplier)}%`);
	if (input.country) query = query.ilike('country', `%${sanitizeFilterValue(input.country)}%`);
	if (input.process) query = query.ilike('processing', `%${sanitizeFilterValue(input.process)}%`);
	if (input.max_price != null && input.max_price > 0) {
		query = query.lte('price_per_lb', input.max_price);
	}
	if (input.min_purveyor_score != null && input.min_purveyor_score > 0) {
		query = query.gte('purveyor_score', input.min_purveyor_score);
	}

	const { data, error } = await query.limit(RANK_CANDIDATE_POOL);
	if (error) throw new Error(`coffee_catalog query failed: ${error.message}`);

	let pool = data ?? [];
	if (input.non_wholesale_only) {
		pool = pool.filter((row) => row.wholesale !== true);
	}

	const caveats: string[] = [
		'Ranking is deterministic and based on quality signals (Purveyor Score and its factor breakdown), not a guarantee of cup quality. Reference the factors, not absolute claims.'
	];
	if (pool.length >= RANK_CANDIDATE_POOL) {
		caveats.push(
			`Candidate pool capped at ${RANK_CANDIDATE_POOL} listings; add filters for exhaustive coverage.`
		);
	}

	const byScoreDesc = (a: Record<string, unknown>, b: Record<string, unknown>) =>
		(asNumber(b.purveyor_score) ?? -1) - (asNumber(a.purveyor_score) ?? -1) ||
		(asNumber(b.score_value) ?? -1) - (asNumber(a.score_value) ?? -1) ||
		String(b.stocked_date ?? '').localeCompare(String(a.stocked_date ?? ''));

	let ranked: Array<{ row: Record<string, unknown>; basis: string }>;

	switch (input.objective) {
		case 'premium': {
			ranked = [...pool].sort(byScoreDesc).map((row) => ({ row, basis: scoreLabel(row) }));
			break;
		}
		case 'value': {
			const scored = pool
				.map((row) => {
					const score = asNumber(row.purveyor_score);
					const price = asNumber(row.price_per_lb);
					if (score === null || price === null || price <= 0) return null;
					return { row, ratio: score / price };
				})
				.filter((entry): entry is { row: Record<string, unknown>; ratio: number } => entry !== null)
				.sort((a, b) => b.ratio - a.ratio || byScoreDesc(a.row, b.row));
			ranked = scored.map(({ row, ratio }) => ({
				row,
				basis: `${scoreLabel(row)} at $${asNumber(row.price_per_lb)}/lb (${round(ratio, 1)} score points per dollar)`
			}));
			caveats.push(
				'Value objective is score-per-dollar: a simple deterministic ratio of Purveyor Score to price per pound. Lots without a score or price are excluded.'
			);
			break;
		}
		case 'fresh_arrival': {
			ranked = [...pool]
				.sort(
					(a, b) =>
						String(b.stocked_date ?? '').localeCompare(String(a.stocked_date ?? '')) ||
						byScoreDesc(a, b)
				)
				.map((row) => ({
					row,
					basis: `stocked ${row.stocked_date ?? 'date unknown'} — ${scoreLabel(row)}`
				}));
			break;
		}
		case 'rare_origin': {
			const originCounts = new Map<string, number>();
			for (const row of pool) {
				const rowCountry = typeof row.country === 'string' ? row.country.trim() : '';
				if (rowCountry) originCounts.set(rowCountry, (originCounts.get(rowCountry) ?? 0) + 1);
			}
			const rarity = (row: Record<string, unknown>) => {
				const rowCountry = typeof row.country === 'string' ? row.country.trim() : '';
				return rowCountry
					? (originCounts.get(rowCountry) ?? Number.MAX_SAFE_INTEGER)
					: Number.MAX_SAFE_INTEGER;
			};
			ranked = [...pool]
				.filter((row) => typeof row.country === 'string' && row.country.trim().length > 0)
				.sort((a, b) => rarity(a) - rarity(b) || byScoreDesc(a, b))
				.map((row) => ({
					row,
					basis: `${row.country} has only ${rarity(row)} matching listing(s) — ${scoreLabel(row)}`
				}));
			if (input.country) {
				caveats.push(
					'rare_origin combined with a country filter measures rarity only within that filter — consider dropping the country filter for true origin scarcity.'
				);
			}
			break;
		}
	}

	return {
		objective: input.objective,
		coffees: ranked.slice(0, limit).map(({ row, basis }, index) => ({
			...row,
			rank: index + 1,
			rank_basis: basis
		})),
		candidates_considered: pool.length,
		caveats,
		filters_applied: input
	};
}
