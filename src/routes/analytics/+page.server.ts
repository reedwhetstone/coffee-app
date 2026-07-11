import type { PageServerLoad } from './$types';
import { buildPublicMeta, resolvePublicPageSocialImage } from '$lib/seo/meta';
import { resolvePrincipal } from '$lib/server/principal';
import { loadMarketIndexInsights } from '$lib/server/marketIndex';
import { createAdminClient } from '$lib/supabase-admin';
import { createSchemaService } from '$lib/services/schemaService';
import { getTrackedLotSummaries, type TrackedLotSummary } from '$lib/server/trackedLots';
import type { MarketIndexInsights } from '$lib/types/marketIndex.types';

export type { TrackedLotSummary } from '$lib/server/trackedLots';

export interface ArrivalBean {
	name: string;
	country: string | null;
	processing: string | null;
	price_per_lb: number | null;
	source: string | null;
	stocked_date: string | null;
	wholesale: boolean;
}

export interface DelistingBean {
	name: string;
	country: string | null;
	processing: string | null;
	price_per_lb: number | null;
	source: string | null;
	unstocked_date: string | null;
	wholesale: boolean;
}

export interface ComparisonBean {
	name: string;
	country: string;
	processing: string | null;
	price_per_lb: number;
	source: string;
	wholesale: boolean;
	bag_size: string | null;
}

const UNDISCLOSED_SUPPLIER = 'Supplier undisclosed';

function normalizeSupplierSource(source: string | null): string {
	const trimmed = source?.trim();
	return trimmed ? trimmed : UNDISCLOSED_SUPPLIER;
}

function getPerLbPrice(row: {
	price_per_lb?: number | null;
	cost_lb?: number | null;
}): number | null {
	return row.price_per_lb ?? row.cost_lb ?? null;
}

export interface SupplierHealthRow {
	source: string;
	stockedCount: number;
	origins: number;
	avgCostLb: number;
	minCostLb: number;
	maxCostLb: number;
	wholesaleCount: number;
	retailCount: number;
}

export interface SupplierPriceRange {
	source: string;
	market: 'retail' | 'wholesale' | 'all';
	count: number;
	min: number;
	median: number;
	max: number;
}

export interface PriceSnapshot {
	snapshot_date: string;
	origin: string;
	process: string | null;
	price_avg: number | null;
	price_median: number | null;
	price_min: number | null;
	price_max: number | null;
	price_p25: number | null;
	price_p75: number | null;
	price_stdev: number | null;
	supplier_count: number;
	sample_size: number;
	wholesale_only: boolean;
	aggregation_tier: number;
}

export interface ProcessBucket {
	name: string;
	count: number;
	wholesale: boolean;
}

interface CatalogPriceRow {
	country: string | null;
	price_per_lb: number | null;
	wholesale: boolean;
}

interface CatalogCoverageRow {
	country: string | null;
	source: string | null;
	wholesale: boolean;
}

type AnalyticsSummary = Pick<AnalyticsPayload, 'stats' | 'marketSummary' | 'movementCounts'>;

export type AnalyticsPayloadResult =
	| { status: 'resolved'; data: AnalyticsPayload }
	| { status: 'failed'; message: string };

export interface MovementWindowCounts {
	retail: number;
	wholesale: number;
}

export interface MovementCounts {
	available: boolean;
	arrivals: {
		sevenDay: MovementWindowCounts;
		thirtyDay: MovementWindowCounts;
	};
	delistings: {
		sevenDay: MovementWindowCounts;
		thirtyDay: MovementWindowCounts;
	};
}

type OriginRangeScope = 'all' | 'retail' | 'wholesale';

export interface OriginRangeRow {
	origin: string;
	market_scope: OriginRangeScope;
	price_min: number;
	price_max: number;
	price_avg: number;
	price_median: number;
	price_q1: number;
	price_q3: number;
	sample_size: number;
}

export interface AnalyticsPayload {
	stats: {
		totalBeansTracked: number;
		stockedRetailBeans: number;
		stockedWholesaleBeans: number;
		stockedRetailOrigins: number;
		stockedWholesaleOrigins: number;
		stockedOrigins: number;
		stockedRetailSuppliers: number;
		stockedWholesaleSuppliers: number;
		stockedSuppliers: number;
		totalSuppliers: number;
		originsCount: number;
		lastUpdated: string | null;
	};
	marketSummary: {
		total_stocked: number | null;
		retail_median: number | null;
		retail_median_7d_change: number | null;
		retail_median_30d_change: number | null;
		supply_7d_change: number | null;
		supply_30d_change: number | null;
	};
	snapshots: PriceSnapshot[];
	processDistribution: ProcessBucket[];
	originRangeData: OriginRangeRow[];
	movementCounts: MovementCounts;
	recentArrivals: ArrivalBean[];
	recentDelistings: DelistingBean[];
	comparisonBeans: ComparisonBean[];
	supplierPriceRanges: SupplierPriceRange[];
	marketInsights: Awaited<ReturnType<typeof loadMarketIndexInsights>>;
	supplierHealth: SupplierHealthRow[];
	trackedLots: TrackedLotSummary[];
}

const EMPTY_MARKET_INSIGHTS: MarketIndexInsights = {
	valueSignals: null,
	signalsSummary: null,
	signalsAsOf: null,
	moveStats: null,
	metadataProcessSeries: null,
	metadataDisclosureSeries: null,
	metadataPurveyorScoreSeries: null,
	metadataPurveyorScoreConfidenceSeries: null,
	metadataPurveyorScoreTierSeries: null
};

const SNAPSHOT_PAGE_SIZE = 1000;
const CATALOG_COVERAGE_PAGE_SIZE = 1000;
const SNAPSHOT_SELECT =
	'snapshot_date, origin, process, price_avg, price_median, price_min, price_max, price_p25, price_p75, price_stdev, supplier_count, sample_size, wholesale_only, aggregation_tier';
// Keep synthetic backfill rows in the analytics history for now. Because real and
// synthetic rows can coexist for the same segment/date, pagination must use a
// total order that includes the schema differentiators plus a unique tiebreaker.
const SNAPSHOT_ORDER_COLUMNS = [
	'snapshot_date',
	'origin',
	'process',
	'grade',
	'wholesale_only',
	'synthetic',
	'id'
] as const;

function relativeDateString(referenceDate: string | null, daysAgo: number): string {
	const reference = referenceDate ? new Date(`${referenceDate}T00:00:00.000Z`) : new Date();
	reference.setUTCDate(reference.getUTCDate() - daysAgo);
	return reference.toISOString().split('T')[0];
}

function movementCountQuery({
	supabase,
	dateColumn,
	stocked,
	wholesale,
	fromDate
}: {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	supabase: any;
	dateColumn: 'stocked_date' | 'unstocked_date';
	stocked: boolean;
	wholesale: boolean;
	fromDate: string;
}) {
	return supabase
		.from('coffee_catalog')
		.select('*', { count: 'exact', head: true })
		.eq('stocked', stocked)
		.eq('wholesale', wholesale)
		.gte(dateColumn, fromDate);
}

async function loadActiveCatalogCoverageRowsPaginated({
	supabase,
	wholesale
}: {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	supabase: any;
	wholesale: boolean;
}): Promise<CatalogCoverageRow[]> {
	const rows: CatalogCoverageRow[] = [];

	for (let page = 0; ; page += 1) {
		const start = page * CATALOG_COVERAGE_PAGE_SIZE;
		const end = start + CATALOG_COVERAGE_PAGE_SIZE - 1;
		const { data, error } = await supabase
			.from('coffee_catalog')
			.select('country, source, wholesale')
			.eq('stocked', true)
			.eq('wholesale', wholesale)
			.order('id', { ascending: true })
			.range(start, end);

		if (error) {
			throw new Error(
				`Failed to load active ${wholesale ? 'wholesale' : 'retail'} catalog coverage page ${page + 1}: ${error.message}`
			);
		}

		const pageRows = (data ?? []) as CatalogCoverageRow[];
		rows.push(...pageRows);

		if (pageRows.length < CATALOG_COVERAGE_PAGE_SIZE) break;
	}

	return rows;
}

function normalizeProcess(raw: string | null | undefined): string {
	if (!raw) return 'Unknown';
	const s = raw.toLowerCase().trim();
	if (s.includes('natural') || s.includes('dry')) return 'Natural';
	if (s.includes('honey') || s.includes('pulped')) return 'Honey';
	if (s.includes('anaerob')) return 'Anaerobic';
	if (s.includes('wet hull') || s.includes('giling')) return 'Wet Hulled';
	if (s.includes('washed') || s.includes('wet') || s.includes('fully')) return 'Washed';
	return 'Other';
}

export async function _loadPriceSnapshotsPaginated({
	supabase,
	fromDate
}: {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	supabase: any;
	fromDate: string;
}): Promise<PriceSnapshot[]> {
	const snapshots: PriceSnapshot[] = [];

	for (let start = 0; ; start += SNAPSHOT_PAGE_SIZE) {
		const end = start + SNAPSHOT_PAGE_SIZE - 1;
		let query = supabase
			.from('price_index_snapshots')
			.select(SNAPSHOT_SELECT)
			.gte('snapshot_date', fromDate)
			.eq('aggregation_tier', 1);

		for (const column of SNAPSHOT_ORDER_COLUMNS) {
			query = query.order(column, { ascending: true });
		}

		const { data, error } = await query.range(start, end);

		if (error) {
			const pageNumber = Math.floor(start / SNAPSHOT_PAGE_SIZE) + 1;
			throw new Error(
				`Failed to load analytics price snapshots page ${pageNumber}: ${error.message}`,
				{ cause: error }
			);
		}

		const page = (data ?? []) as PriceSnapshot[];

		if (page.length === 0) break;

		snapshots.push(...page);

		if (page.length < SNAPSHOT_PAGE_SIZE) break;
	}

	return snapshots;
}

type MarketSummaryRow = {
	snapshot_date: string;
	total_stocked: number;
	total_suppliers: number;
	total_origins: number;
	retail_median: number | null;
	retail_median_7d_change: number | null;
	retail_median_30d_change: number | null;
	supply_7d_change?: number | null;
	supply_30d_change?: number | null;
};

function buildEmptyAnalyticsPayload(overrides: Partial<AnalyticsPayload> = {}): AnalyticsPayload {
	return {
		stats: {
			totalBeansTracked: 0,
			stockedRetailBeans: 0,
			stockedWholesaleBeans: 0,
			stockedRetailOrigins: 0,
			stockedWholesaleOrigins: 0,
			stockedOrigins: 0,
			stockedRetailSuppliers: 0,
			stockedWholesaleSuppliers: 0,
			stockedSuppliers: 0,
			totalSuppliers: 0,
			originsCount: 0,
			lastUpdated: null
		},
		marketSummary: {
			total_stocked: null,
			retail_median: null,
			retail_median_7d_change: null,
			retail_median_30d_change: null,
			supply_7d_change: null,
			supply_30d_change: null
		},
		snapshots: [],
		processDistribution: [],
		originRangeData: [],
		movementCounts: {
			available: false,
			arrivals: {
				sevenDay: { retail: 0, wholesale: 0 },
				thirtyDay: { retail: 0, wholesale: 0 }
			},
			delistings: {
				sevenDay: { retail: 0, wholesale: 0 },
				thirtyDay: { retail: 0, wholesale: 0 }
			}
		},
		recentArrivals: [],
		recentDelistings: [],
		comparisonBeans: [],
		supplierPriceRanges: [],
		marketInsights: EMPTY_MARKET_INSIGHTS,
		supplierHealth: [],
		trackedLots: [],
		...overrides
	};
}

async function loadLatestMarketSummary(
	event: Parameters<PageServerLoad>[0]
): Promise<MarketSummaryRow | null> {
	const today = new Date().toISOString().split('T')[0];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const sb = event.locals.supabase as any;
	const { data: marketSummaryRaw, error } = await sb
		.from('market_daily_summary')
		.select(
			'snapshot_date, total_stocked, total_suppliers, total_origins, retail_median, retail_median_7d_change, retail_median_30d_change, supply_7d_change, supply_30d_change'
		)
		.lte('snapshot_date', today)
		.order('snapshot_date', { ascending: false })
		.limit(1)
		.maybeSingle();
	if (error) throw new Error(`Failed to load latest market summary: ${error.message}`);

	return marketSummaryRaw as MarketSummaryRow | null;
}

function buildAnalyticsPreview(marketSummary: MarketSummaryRow | null): AnalyticsPayload {
	return buildEmptyAnalyticsPayload({
		stats: {
			totalBeansTracked: 0,
			stockedRetailBeans: 0,
			stockedWholesaleBeans: 0,
			stockedRetailOrigins: 0,
			stockedWholesaleOrigins: 0,
			stockedOrigins: marketSummary?.total_origins ?? 0,
			stockedRetailSuppliers: 0,
			stockedWholesaleSuppliers: 0,
			stockedSuppliers: marketSummary?.total_suppliers ?? 0,
			totalSuppliers: marketSummary?.total_suppliers ?? 0,
			originsCount: marketSummary?.total_origins ?? 0,
			lastUpdated: marketSummary?.snapshot_date ?? null
		},
		marketSummary: {
			total_stocked: marketSummary?.total_stocked ?? null,
			retail_median: marketSummary?.retail_median ?? null,
			retail_median_7d_change: marketSummary?.retail_median_7d_change ?? null,
			retail_median_30d_change: marketSummary?.retail_median_30d_change ?? null,
			supply_7d_change: marketSummary?.supply_7d_change ?? null,
			supply_30d_change: marketSummary?.supply_30d_change ?? null
		}
	});
}

async function loadAnalyticsSummary(
	event: Parameters<PageServerLoad>[0],
	marketSummary: MarketSummaryRow | null
): Promise<AnalyticsSummary> {
	const supabase = event.locals.supabase;
	const lastUpdated = marketSummary?.snapshot_date ?? null;
	const sevenDaysAgoStr = relativeDateString(lastUpdated, 7);
	const thirtyDaysAgoStr = relativeDateString(lastUpdated, 30);

	const [
		{ count: totalBeansTracked, error: totalBeansError },
		{ count: stockedRetailBeans, error: stockedRetailError },
		{ count: stockedWholesaleBeans, error: stockedWholesaleError },
		retailCoverageRows,
		wholesaleCoverageRows,
		{ count: arrivals7dRetail, error: arrivals7dRetailError },
		{ count: arrivals7dWholesale, error: arrivals7dWholesaleError },
		{ count: arrivals30dRetail, error: arrivals30dRetailError },
		{ count: arrivals30dWholesale, error: arrivals30dWholesaleError },
		{ count: delistings7dRetail, error: delistings7dRetailError },
		{ count: delistings7dWholesale, error: delistings7dWholesaleError },
		{ count: delistings30dRetail, error: delistings30dRetailError },
		{ count: delistings30dWholesale, error: delistings30dWholesaleError }
	] = await Promise.all([
		supabase.from('coffee_catalog').select('*', { count: 'exact', head: true }),
		supabase
			.from('coffee_catalog')
			.select('*', { count: 'exact', head: true })
			.eq('stocked', true)
			.eq('wholesale', false),
		supabase
			.from('coffee_catalog')
			.select('*', { count: 'exact', head: true })
			.eq('stocked', true)
			.eq('wholesale', true),
		loadActiveCatalogCoverageRowsPaginated({ supabase, wholesale: false }),
		loadActiveCatalogCoverageRowsPaginated({ supabase, wholesale: true }),
		movementCountQuery({
			supabase,
			dateColumn: 'stocked_date',
			stocked: true,
			wholesale: false,
			fromDate: sevenDaysAgoStr
		}),
		movementCountQuery({
			supabase,
			dateColumn: 'stocked_date',
			stocked: true,
			wholesale: true,
			fromDate: sevenDaysAgoStr
		}),
		movementCountQuery({
			supabase,
			dateColumn: 'stocked_date',
			stocked: true,
			wholesale: false,
			fromDate: thirtyDaysAgoStr
		}),
		movementCountQuery({
			supabase,
			dateColumn: 'stocked_date',
			stocked: true,
			wholesale: true,
			fromDate: thirtyDaysAgoStr
		}),
		movementCountQuery({
			supabase,
			dateColumn: 'unstocked_date',
			stocked: false,
			wholesale: false,
			fromDate: sevenDaysAgoStr
		}),
		movementCountQuery({
			supabase,
			dateColumn: 'unstocked_date',
			stocked: false,
			wholesale: true,
			fromDate: sevenDaysAgoStr
		}),
		movementCountQuery({
			supabase,
			dateColumn: 'unstocked_date',
			stocked: false,
			wholesale: false,
			fromDate: thirtyDaysAgoStr
		}),
		movementCountQuery({
			supabase,
			dateColumn: 'unstocked_date',
			stocked: false,
			wholesale: true,
			fromDate: thirtyDaysAgoStr
		})
	]);
	const requiredCountError = totalBeansError ?? stockedRetailError ?? stockedWholesaleError;
	if (requiredCountError) {
		throw new Error(
			`Failed to load required analytics catalog counts: ${requiredCountError.message}`
		);
	}

	const retailActiveCoverageRows = retailCoverageRows ?? [];
	const wholesaleActiveCoverageRows = wholesaleCoverageRows ?? [];
	const retailActiveOriginSet = new Set(
		retailActiveCoverageRows
			.map((row) => row.country)
			.filter((country): country is string => Boolean(country))
	);
	const wholesaleActiveOriginSet = new Set(
		wholesaleActiveCoverageRows
			.map((row) => row.country)
			.filter((country): country is string => Boolean(country))
	);
	const retailActiveSupplierSet = new Set(
		retailActiveCoverageRows
			.map((row) => row.source)
			.filter((source): source is string => Boolean(source))
	);
	const wholesaleActiveSupplierSet = new Set(
		wholesaleActiveCoverageRows
			.map((row) => row.source)
			.filter((source): source is string => Boolean(source))
	);
	const activeOriginSet = new Set([...retailActiveOriginSet, ...wholesaleActiveOriginSet]);
	const activeSupplierSet = new Set([...retailActiveSupplierSet, ...wholesaleActiveSupplierSet]);
	const movementCountsAvailable = ![
		arrivals7dRetailError,
		arrivals7dWholesaleError,
		arrivals30dRetailError,
		arrivals30dWholesaleError,
		delistings7dRetailError,
		delistings7dWholesaleError,
		delistings30dRetailError,
		delistings30dWholesaleError
	].some(Boolean);

	return {
		stats: {
			totalBeansTracked: totalBeansTracked ?? 0,
			stockedRetailBeans: stockedRetailBeans ?? 0,
			stockedWholesaleBeans: stockedWholesaleBeans ?? 0,
			stockedRetailOrigins: retailActiveOriginSet.size,
			stockedWholesaleOrigins: wholesaleActiveOriginSet.size,
			stockedOrigins: activeOriginSet.size || (marketSummary?.total_origins ?? 0),
			stockedRetailSuppliers: retailActiveSupplierSet.size,
			stockedWholesaleSuppliers: wholesaleActiveSupplierSet.size,
			stockedSuppliers: activeSupplierSet.size || (marketSummary?.total_suppliers ?? 0),
			totalSuppliers: marketSummary?.total_suppliers ?? 0,
			originsCount: marketSummary?.total_origins ?? 0,
			lastUpdated
		},
		marketSummary: {
			total_stocked: marketSummary?.total_stocked ?? null,
			retail_median: marketSummary?.retail_median ?? null,
			retail_median_7d_change: marketSummary?.retail_median_7d_change ?? null,
			retail_median_30d_change: marketSummary?.retail_median_30d_change ?? null,
			supply_7d_change: marketSummary?.supply_7d_change ?? null,
			supply_30d_change: marketSummary?.supply_30d_change ?? null
		},
		movementCounts: {
			available: movementCountsAvailable,
			arrivals: {
				sevenDay: { retail: arrivals7dRetail ?? 0, wholesale: arrivals7dWholesale ?? 0 },
				thirtyDay: { retail: arrivals30dRetail ?? 0, wholesale: arrivals30dWholesale ?? 0 }
			},
			delistings: {
				sevenDay: { retail: delistings7dRetail ?? 0, wholesale: delistings7dWholesale ?? 0 },
				thirtyDay: { retail: delistings30dRetail ?? 0, wholesale: delistings30dWholesale ?? 0 }
			}
		}
	};
}

async function loadAnalyticsPayload(
	event: Parameters<PageServerLoad>[0],
	principal: Awaited<ReturnType<typeof resolvePrincipal>>,
	isParchmentIntelligence: boolean,
	marketSummaryPromise: Promise<MarketSummaryRow | null>
): Promise<AnalyticsPayload> {
	// ADR-008 decision-surface reads (value signals, movement stats, metadata index).
	// Kicked off first; resolves in parallel with the Supabase queries below.
	const marketInsightsPromise = loadMarketIndexInsights(event, {
		isAuthenticated: principal.isAuthenticated,
		isParchmentIntelligence
	});

	const today = new Date().toISOString().split('T')[0];
	const supabase = event.locals.supabase;
	const marketSummary = await marketSummaryPromise;
	const analyticsSummaryPromise = loadAnalyticsSummary(event, marketSummary);
	const lastUpdated = marketSummary?.snapshot_date ?? null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const sb = supabase as any;
	// price_index_snapshots is entitlement-sensitive. Public analytics still exposes a
	// bounded server-rendered slice, but direct anon/auth table access is revoked.
	const priceIndexSupabase = createAdminClient();
	const supplierRangeRpcClient = priceIndexSupabase as unknown as {
		rpc(name: 'get_supplier_price_ranges'): PromiseLike<{ data: unknown; error: unknown }>;
	};

	// ─── PUBLIC QUERIES (run for all visitors, in parallel) ─────────────────────
	const thirtyDaysAgoStr = relativeDateString(lastUpdated, 30);
	const fromDate = relativeDateString(null, 90);

	// Parchment Intelligence users get up to 365 days of snapshot data for extended trend views.
	const snapshotFromDate = isParchmentIntelligence
		? (() => {
				const d = new Date();
				d.setDate(d.getDate() - 365);
				return d.toISOString().split('T')[0];
			})()
		: fromDate;
	const emptyRows = Promise.resolve({ data: [] as unknown[], error: null });
	const processingRowsPromise = principal.isAuthenticated
		? supabase
				.from('coffee_catalog')
				.select('processing, wholesale')
				.eq('stocked', true)
				.not('processing', 'is', null)
				.limit(5000)
		: emptyRows;
	const retailOriginPricesPromise = principal.isAuthenticated
		? supabase
				.from('coffee_catalog')
				.select('country, price_per_lb, wholesale')
				.eq('stocked', true)
				.eq('wholesale', false)
				.not('country', 'is', null)
				.not('price_per_lb', 'is', null)
				.gt('price_per_lb', 0)
				.limit(5000)
		: emptyRows;
	const wholesaleOriginPricesPromise = principal.isAuthenticated
		? supabase
				.from('coffee_catalog')
				.select('country, price_per_lb, wholesale')
				.eq('stocked', true)
				.eq('wholesale', true)
				.not('country', 'is', null)
				.not('price_per_lb', 'is', null)
				.gt('price_per_lb', 0)
				.limit(5000)
		: emptyRows;
	const recentRetailArrivalsPromise = isParchmentIntelligence
		? supabase
				.from('coffee_catalog')
				.select('name, country, processing, price_per_lb, source, stocked_date, wholesale')
				.eq('stocked', true)
				.eq('wholesale', false)
				.gte('stocked_date', thirtyDaysAgoStr)
				.order('stocked_date', { ascending: false })
				.limit(50)
		: emptyRows;
	const recentWholesaleArrivalsPromise = isParchmentIntelligence
		? supabase
				.from('coffee_catalog')
				.select('name, country, processing, price_per_lb, source, stocked_date, wholesale')
				.eq('stocked', true)
				.eq('wholesale', true)
				.gte('stocked_date', thirtyDaysAgoStr)
				.order('stocked_date', { ascending: false })
				.limit(50)
		: emptyRows;
	const recentRetailDelistingsPromise = isParchmentIntelligence
		? supabase
				.from('coffee_catalog')
				.select('name, country, processing, price_per_lb, source, unstocked_date, wholesale')
				.eq('stocked', false)
				.eq('wholesale', false)
				.gte('unstocked_date', thirtyDaysAgoStr)
				.order('unstocked_date', { ascending: false })
				.limit(50)
		: emptyRows;
	const recentWholesaleDelistingsPromise = isParchmentIntelligence
		? supabase
				.from('coffee_catalog')
				.select('name, country, processing, price_per_lb, source, unstocked_date, wholesale')
				.eq('stocked', false)
				.eq('wholesale', true)
				.gte('unstocked_date', thirtyDaysAgoStr)
				.order('unstocked_date', { ascending: false })
				.limit(50)
		: emptyRows;
	const intelligenceQueriesPromise = isParchmentIntelligence
		? Promise.all([
				supabase
					.from('coffee_catalog')
					.select('name, country, processing, price_per_lb, source, wholesale, bag_size')
					.eq('stocked', true)
					.not('price_per_lb', 'is', null)
					.not('country', 'is', null)
					.order('price_per_lb', { ascending: true })
					.limit(2000),
				sb
					.from('supplier_daily_stats')
					.select('*')
					.lte('snapshot_date', today)
					.order('snapshot_date', { ascending: false })
					.order('stocked_count', { ascending: false })
					.limit(200),
				supplierRangeRpcClient.rpc('get_supplier_price_ranges')
			])
		: null;
	const isSourcingMember = event.locals.role === 'member' || event.locals.role === 'admin';
	const trackedLotsPromise: Promise<TrackedLotSummary[]> =
		principal.isAuthenticated && (isParchmentIntelligence || isSourcingMember)
			? getTrackedLotSummaries(supabase, principal.userId, 25).catch((error) => {
					console.error('Error loading analytics watchlist context:', error);
					return [] as TrackedLotSummary[];
				})
			: Promise.resolve([]);

	const [
		analyticsSummary,
		{ data: processingRows, error: processingRowsError },
		{ data: retailCatalogPriceRows, error: retailCatalogPriceRowsError },
		{ data: wholesaleCatalogPriceRows, error: wholesaleCatalogPriceRowsError },
		{ data: recentRetailArrivals30, error: recentRetailArrivalsError },
		{ data: recentWholesaleArrivals30, error: recentWholesaleArrivalsError },
		{ data: recentRetailDelistings30, error: recentRetailDelistingsError },
		{ data: recentWholesaleDelistings30, error: recentWholesaleDelistingsError },
		snapshotsRaw
	] = await Promise.all([
		analyticsSummaryPromise,
		processingRowsPromise,
		retailOriginPricesPromise,
		wholesaleOriginPricesPromise,
		recentRetailArrivalsPromise,
		recentWholesaleArrivalsPromise,
		recentRetailDelistingsPromise,
		recentWholesaleDelistingsPromise,
		// Price index snapshots — 90 days public, 365 days for Parchment Intelligence users
		_loadPriceSnapshotsPaginated({
			supabase: priceIndexSupabase,
			fromDate: snapshotFromDate
		})
	]);
	const requiredEvidenceError =
		processingRowsError ??
		retailCatalogPriceRowsError ??
		wholesaleCatalogPriceRowsError ??
		recentRetailArrivalsError ??
		recentWholesaleArrivalsError ??
		recentRetailDelistingsError ??
		recentWholesaleDelistingsError;
	if (requiredEvidenceError) {
		throw new Error(`Failed to load required analytics evidence: ${requiredEvidenceError.message}`);
	}

	// Process distribution
	const processDistribution: ProcessBucket[] = (() => {
		const retailDist: Record<string, number> = {};
		const wholesaleDist: Record<string, number> = {};
		for (const row of (processingRows ?? []) as Array<{
			processing: string | null;
			wholesale: boolean;
		}>) {
			const key = normalizeProcess(row.processing);
			if (row.wholesale) {
				wholesaleDist[key] = (wholesaleDist[key] ?? 0) + 1;
			} else {
				retailDist[key] = (retailDist[key] ?? 0) + 1;
			}
		}
		const entries: ProcessBucket[] = [];
		const allKeys = new Set([...Object.keys(retailDist), ...Object.keys(wholesaleDist)]);
		for (const name of allKeys) {
			if (retailDist[name]) entries.push({ name, count: retailDist[name], wholesale: false });
			if (wholesaleDist[name]) entries.push({ name, count: wholesaleDist[name], wholesale: true });
		}
		return entries.sort((a, b) => b.count - a.count);
	})();

	const retailOriginPriceRows = (retailCatalogPriceRows ?? []) as CatalogPriceRow[];
	const wholesaleOriginPriceRows = (wholesaleCatalogPriceRows ?? []) as CatalogPriceRow[];
	const allOriginPriceRows = [...retailOriginPriceRows, ...wholesaleOriginPriceRows];

	const buildOriginRangeRows = (
		scope: OriginRangeScope,
		catalogPriceRows: CatalogPriceRow[]
	): OriginRangeRow[] => {
		if (catalogPriceRows.length === 0) return [];

		const byCountry = new Map<string, number[]>();
		for (const row of catalogPriceRows) {
			if (scope === 'retail' && row.wholesale) continue;
			if (scope === 'wholesale' && !row.wholesale) continue;
			const price = getPerLbPrice(row);
			if (!row.country || price == null) continue;
			const prices = byCountry.get(row.country) ?? [];
			prices.push(price);
			byCountry.set(row.country, prices);
		}

		function percentile(sorted: number[], p: number): number {
			if (sorted.length === 0) return 0;
			if (sorted.length === 1) return sorted[0];
			const idx = p * (sorted.length - 1);
			const lo = Math.floor(idx);
			const hi = Math.ceil(idx);
			return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
		}

		const result: OriginRangeRow[] = [];
		for (const [origin, prices] of byCountry) {
			if (prices.length < 3) continue;
			const sorted = [...prices].sort((a, b) => a - b);
			const avg = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
			result.push({
				origin,
				market_scope: scope,
				price_min: sorted[0],
				price_max: sorted[sorted.length - 1],
				price_avg: avg,
				price_median: percentile(sorted, 0.5),
				price_q1: percentile(sorted, 0.25),
				price_q3: percentile(sorted, 0.75),
				sample_size: sorted.length
			});
		}

		return result.sort((a, b) => b.sample_size - a.sample_size).slice(0, 50);
	};

	// Origin range data includes all, retail, and wholesale scopes so the command-center
	// read never explains a scoped price average with all-market range evidence.
	const originRangeData: OriginRangeRow[] = [
		...buildOriginRangeRows('all', allOriginPriceRows),
		...buildOriginRangeRows('retail', retailOriginPriceRows),
		...buildOriginRangeRows('wholesale', wholesaleOriginPriceRows)
	];

	const recentArrivals = isParchmentIntelligence
		? [
				...((recentRetailArrivals30 ?? []) as ArrivalBean[]),
				...((recentWholesaleArrivals30 ?? []) as ArrivalBean[])
			]
				.sort((a, b) => (b.stocked_date ?? '').localeCompare(a.stocked_date ?? ''))
				.slice(0, 100)
		: [];
	const recentDelistings = isParchmentIntelligence
		? [
				...((recentRetailDelistings30 ?? []) as DelistingBean[]),
				...((recentWholesaleDelistings30 ?? []) as DelistingBean[])
			]
				.sort((a, b) => (b.unstocked_date ?? '').localeCompare(a.unstocked_date ?? ''))
				.slice(0, 100)
		: [];

	// ─── PARCHMENT INTELLIGENCE QUERIES (only run for entitled users) ───────────
	const snapshots: PriceSnapshot[] = snapshotsRaw ?? [];
	let comparisonBeans: ComparisonBean[] = [];
	let supplierHealth: SupplierHealthRow[] = [];
	let supplierPriceRanges: SupplierPriceRange[] = [];

	if (isParchmentIntelligence) {
		const [
			{ data: comparisonBeansRaw, error: comparisonBeansError },
			{ data: supplierStatsRaw, error: supplierStatsError },
			{ data: supplierRangesRaw, error: supplierRangesError }
		] = await intelligenceQueriesPromise!;

		const requiredIntelligenceError =
			comparisonBeansError ?? supplierStatsError ?? supplierRangesError;
		if (requiredIntelligenceError) {
			throw new Error(
				`Failed to load required Parchment Intelligence evidence: ${requiredIntelligenceError.message}`
			);
		}

		comparisonBeans = (comparisonBeansRaw ?? []).map((row) => ({
			...row,
			source: normalizeSupplierSource(row.source)
		})) as ComparisonBean[];

		interface SupplierRangeRpcRow {
			source: string | null;
			market: 'retail' | 'wholesale' | 'all';
			lot_count: number | string | null;
			price_min: number | string | null;
			price_median: number | string | null;
			price_max: number | string | null;
		}

		supplierPriceRanges = ((supplierRangesRaw as SupplierRangeRpcRow[] | null) ?? [])
			.map((row) => ({
				source: normalizeSupplierSource(row.source),
				market: row.market,
				count: Number(row.lot_count ?? 0),
				min: Number(row.price_min ?? 0),
				median: Number(row.price_median ?? 0),
				max: Number(row.price_max ?? 0)
			}))
			.filter((row) => row.count > 0 && row.min > 0 && row.median > 0 && row.max > 0);

		interface SupplierStatRow {
			snapshot_date: string;
			source: string;
			stocked_count: number;
			origins_count: number;
			retail_avg: number | null;
			retail_min: number | null;
			retail_max: number | null;
			wholesale_count: number;
			retail_count: number;
		}

		const typedSupplierStats: SupplierStatRow[] = supplierStatsRaw ?? [];
		const mostRecentSupplierDate =
			typedSupplierStats.length > 0 ? typedSupplierStats[0].snapshot_date : null;

		supplierHealth = typedSupplierStats
			.filter((row) => row.snapshot_date === mostRecentSupplierDate)
			.map((row) => ({
				source: row.source,
				stockedCount: row.stocked_count ?? 0,
				origins: row.origins_count ?? 0,
				avgCostLb: row.retail_avg ?? 0,
				minCostLb: row.retail_min ?? 0,
				maxCostLb: row.retail_max ?? 0,
				wholesaleCount: row.wholesale_count ?? 0,
				retailCount: row.retail_count ?? 0
			}));
	}

	const trackedLots = await trackedLotsPromise;

	return {
		stats: analyticsSummary.stats,
		marketSummary: analyticsSummary.marketSummary,
		snapshots,
		processDistribution,
		originRangeData,
		movementCounts: analyticsSummary.movementCounts,
		recentArrivals,
		recentDelistings,
		comparisonBeans,
		supplierPriceRanges,
		marketInsights: await marketInsightsPromise,
		supplierHealth,
		trackedLots
	};
}

export const load: PageServerLoad = async (event) => {
	// Resolve principal to get explicit Parchment Intelligence access.
	// Logged-out visitors and logged-in viewers intentionally share the same core analytics view.
	const principalPromise = resolvePrincipal(event);
	const marketSummaryPromise = loadLatestMarketSummary(event);
	const principal = await principalPromise;
	const isParchmentIntelligence = principal.isAuthenticated ? principal.ppiAccess : false;
	const baseUrl = `${event.url.protocol}//${event.url.host}`;
	const analyticsPayload: Promise<AnalyticsPayloadResult> = loadAnalyticsPayload(
		event,
		principal,
		isParchmentIntelligence,
		marketSummaryPromise
	)
		.then((data) => ({ status: 'resolved' as const, data }))
		.catch((error: unknown) => {
			console.error('Failed to load analytics payload:', error);
			return {
				status: 'failed' as const,
				message: 'Market data could not be loaded. Retry the page in a moment.'
			};
		});
	const previewResult = await marketSummaryPromise
		.then((summary) => ({
			available: summary !== null,
			payload: buildAnalyticsPreview(summary)
		}))
		.catch(() => ({ available: false, payload: buildEmptyAnalyticsPayload() }));
	const analyticsPreview = previewResult.payload;
	const schemaService = createSchemaService(baseUrl);
	const schemaData = schemaService.generateSchemaGraph([
		schemaService.generateOrganizationSchema(),
		schemaService.generateDatasetSchema({
			name: 'Parchment Market Index — Green Coffee Market Data',
			description:
				'Daily green coffee pricing from 40+ US importers and roasters, including origin trends, processing mix, and supplier coverage.',
			url: `${baseUrl}/analytics`,
			keywords: [
				'green coffee prices',
				'coffee market data',
				'coffee price index',
				'specialty coffee analytics',
				'coffee origin prices',
				'coffee supplier comparison'
			],
			dateModified: analyticsPreview.stats.lastUpdated ?? undefined,
			variableMeasured: [
				'Price per pound (USD)',
				'Origin country',
				'Processing method',
				'Supplier count',
				'Sample size'
			]
		})
	]);
	const session = event.locals.session ?? null;
	const role = event.locals.role ?? 'viewer';

	return {
		session,
		role,
		isParchmentIntelligence,
		analyticsPreview,
		analyticsPreviewAvailable: previewResult.available,
		analyticsPayload,
		meta: buildPublicMeta({
			baseUrl,
			path: '/analytics',
			title: 'Green Coffee Market Visibility | Parchment Market Index',
			description:
				'Daily green coffee pricing, supplier movement, and origin trends from 40+ US importers. Free market visibility for coffee teams.',
			keywords: [
				'green coffee prices',
				'coffee market data',
				'coffee price index',
				'specialty coffee analytics',
				'coffee origin prices',
				'coffee supplier comparison'
			],
			ogTitle: 'Green Coffee Market Visibility — Parchment Market Index',
			ogDescription:
				'Daily green coffee price trends, processing mix, and supplier movement from 40+ US importers.',
			twitterTitle: 'Green Coffee Market Visibility — Parchment Market Index',
			twitterDescription: 'Daily green coffee pricing and supplier movement from 40+ US importers.',
			image: resolvePublicPageSocialImage({
				baseUrl,
				preferredPath: '/og/analytics.jpg',
				alt: 'Parchment Market Index analytics social preview card'
			}),
			schemaData
		})
	};
};
