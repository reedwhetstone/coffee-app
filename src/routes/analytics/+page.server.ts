import type { PageServerLoad } from './$types';
import { buildPublicMeta, resolvePublicPageSocialImage } from '$lib/seo/meta';
import type { RequestPrincipal } from '$lib/server/principal';
import { getPageAuthState } from '$lib/server/pageAuth';
import { loadMarketIndexInsights } from '$lib/server/marketIndex';
import { createSchemaService } from '$lib/services/schemaService';
import { getTrackedLotSummaries, type TrackedLotSummary } from '$lib/server/trackedLots';
import {
	createParchmentServerClient,
	resolveCatalogCredentialMode
} from '$lib/server/parchmentClient';
import type { MarketIndexInsights } from '$lib/types/marketIndex.types';
import type { ParchmentClient, components } from '@purveyors/sdk';

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

export interface AnalyticsStats {
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
}

export interface MarketChangeSummary {
	retail_median_7d_change: number | null;
	retail_median_30d_change: number | null;
	supply_7d_change: number | null;
	supply_30d_change: number | null;
}

/**
 * Rendered in the initial SSR response from Parchment's aggregate overview so
 * the first byte never waits on price history or entitled evidence.
 */
export interface AnalyticsPreview {
	stats: AnalyticsStats;
	marketSummary: MarketChangeSummary;
}

/** Streamed: exact catalog counts, coverage breadth, and movement velocity. */
export interface AnalyticsCoverage {
	stats: AnalyticsStats;
	movementCounts: MovementCounts;
}

/** Streamed: snapshot history, distribution evidence, and market insights. */
export interface AnalyticsCharts {
	snapshots: PriceSnapshot[];
	processDistribution: ProcessBucket[];
	originRangeData: OriginRangeRow[];
	marketInsights: MarketIndexInsights;
}

/** Streamed: entitlement-gated datasets. Resolves empty (and issues no
 * queries) for visitors who never render them. */
export interface AnalyticsMemberData {
	recentArrivals: ArrivalBean[];
	recentDelistings: DelistingBean[];
	comparisonBeans: ComparisonBean[];
	supplierPriceRanges: SupplierPriceRange[];
	supplierHealth: SupplierHealthRow[];
	trackedLots: TrackedLotSummary[];
}

/** Streamed independently so a member-evidence outage cannot hide a healthy watchlist. */
export interface AnalyticsWatchlistData {
	trackedLots: TrackedLotSummary[];
}

type AnalyticsLoadEvent = Parameters<PageServerLoad>[0];

const SNAPSHOT_PAGE_SIZE = 1000;

type PriceIndexHistoryItem = components['schemas']['PriceIndexHistoryItem'];
type MarketOverviewData = components['schemas']['MarketOverviewResponse']['data'];
type MarketEvidenceData = components['schemas']['MarketEvidenceResponse']['data'];

function formatParchmentError(error: unknown): string {
	if (
		typeof error === 'object' &&
		error !== null &&
		'error' in error &&
		typeof error.error === 'object' &&
		error.error !== null &&
		'message' in error.error &&
		typeof error.error.message === 'string'
	) {
		return error.error.message;
	}
	return 'unknown Parchment error';
}

function mapPriceIndexHistoryItem(row: PriceIndexHistoryItem): PriceSnapshot {
	return {
		snapshot_date: row.date,
		origin: row.origin,
		process: row.process,
		price_avg: row.price.avg,
		price_median: row.price.median,
		price_min: row.price.min,
		price_max: row.price.max,
		price_p25: row.price.p25,
		price_p75: row.price.p75,
		price_stdev: row.price.stdev,
		supplier_count: row.sample.suppliers,
		sample_size: row.sample.listings,
		wholesale_only: row.wholesale,
		aggregation_tier: row.sample.aggregationTier
	};
}

export async function _loadPriceSnapshotsPaginated({
	client,
	windowDays
}: {
	client: ParchmentClient;
	windowDays: 90 | 365;
}): Promise<PriceSnapshot[]> {
	const snapshots: PriceSnapshot[] = [];

	for (let page = 1; ; page += 1) {
		const { data, error } = await client.priceIndex.history({
			windowDays,
			page,
			limit: SNAPSHOT_PAGE_SIZE,
			order: 'asc'
		});

		if (error) {
			throw new Error(
				`Failed to load analytics price snapshots page ${page}: ${formatParchmentError(error)}`,
				{ cause: error }
			);
		}

		const pageRows = data?.data ?? [];
		snapshots.push(...pageRows.map(mapPriceIndexHistoryItem));

		if (!data?.pagination.hasNext) break;
		if (pageRows.length === 0) {
			throw new Error(
				`Failed to load analytics price snapshots page ${page}: upstream returned an empty page with hasNext=true`
			);
		}
	}

	return snapshots;
}

interface MarketOverviewResult {
	data: MarketOverviewData | null;
	error: Error | null;
}

async function loadMarketOverview(event: AnalyticsLoadEvent): Promise<MarketOverviewResult> {
	try {
		const client = await createParchmentServerClient(event, {
			// The aggregate overview is a public-only slice, but its Parchment
			// contract still requires a bearer credential. Logged-out page loads use
			// the server-held public-demo key; authenticated callers forward their
			// canonical session/API-key credential.
			mode: resolveCatalogCredentialMode(event.locals)
		});
		const response = await client.market.overview();

		if (response.error) {
			return {
				data: null,
				error: new Error(
					`Failed to load analytics market overview: ${formatParchmentError(response.error)}`
				)
			};
		}
		if (!response.data?.data) {
			return {
				data: null,
				error: new Error('Failed to load analytics market overview: upstream returned no data')
			};
		}

		return { data: response.data.data, error: null };
	} catch (error) {
		return {
			data: null,
			error:
				error instanceof Error
					? error
					: new Error('Failed to load analytics market overview', { cause: error })
		};
	}
}

function buildAnalyticsPreview(overview: MarketOverviewData | null): AnalyticsPreview {
	const daily = overview?.daily;
	return {
		stats: {
			totalBeansTracked: 0,
			stockedRetailBeans: 0,
			stockedWholesaleBeans: 0,
			stockedRetailOrigins: 0,
			stockedWholesaleOrigins: 0,
			stockedOrigins: daily?.totalOrigins ?? 0,
			stockedRetailSuppliers: 0,
			stockedWholesaleSuppliers: 0,
			stockedSuppliers: daily?.totalSuppliers ?? 0,
			totalSuppliers: daily?.totalSuppliers ?? 0,
			originsCount: daily?.totalOrigins ?? 0,
			lastUpdated: daily?.asOf ?? null
		},
		marketSummary: {
			retail_median_7d_change: daily?.changes.retailMedian7d ?? null,
			retail_median_30d_change: daily?.changes.retailMedian30d ?? null,
			supply_7d_change: daily?.changes.supply7d ?? null,
			supply_30d_change: daily?.changes.supply30d ?? null
		}
	};
}

function buildAnalyticsCoverage(overview: MarketOverviewData): AnalyticsCoverage {
	const { coverage, daily, movement } = overview;
	return {
		stats: {
			totalBeansTracked: coverage.totalListings,
			stockedRetailBeans: coverage.stockedListings.retail,
			stockedWholesaleBeans: coverage.stockedListings.wholesale,
			stockedRetailOrigins: coverage.stockedOrigins.retail,
			stockedWholesaleOrigins: coverage.stockedOrigins.wholesale,
			stockedOrigins: coverage.stockedOrigins.total,
			stockedRetailSuppliers: coverage.stockedSuppliers.retail,
			stockedWholesaleSuppliers: coverage.stockedSuppliers.wholesale,
			stockedSuppliers: coverage.stockedSuppliers.total,
			totalSuppliers: daily.totalSuppliers,
			originsCount: daily.totalOrigins,
			lastUpdated: daily.asOf
		},
		movementCounts: {
			available: true,
			arrivals: {
				sevenDay: movement.arrivals.sevenDay,
				thirtyDay: movement.arrivals.thirtyDay
			},
			delistings: {
				sevenDay: movement.delistings.sevenDay,
				thirtyDay: movement.delistings.thirtyDay
			}
		}
	};
}

async function loadAnalyticsCharts(
	event: AnalyticsLoadEvent,
	{
		isParchmentIntelligence,
		isAnonymous,
		marketOverviewPromise
	}: {
		isParchmentIntelligence: boolean;
		isAnonymous: boolean;
		marketOverviewPromise: Promise<MarketOverviewResult>;
	}
): Promise<AnalyticsCharts> {
	// ADR-015 decision-surface reads (value signals, movement stats, metadata index).
	// These remain independent SDK resources and resolve in parallel with history.
	const marketInsightsPromise = loadMarketIndexInsights(event, { isParchmentIntelligence });
	const snapshotWindowDays = isParchmentIntelligence ? 365 : 90;
	const priceIndexClientPromise = createParchmentServerClient(event, { mode: 'session' });

	const snapshotsPromise = priceIndexClientPromise.then((client) =>
		// Parchment owns entitlement and returns synthetic and observed tier-one rows
		// in deterministic ascending order: 90 days anonymously, 365 for PPI sessions.
		_loadPriceSnapshotsPaginated({
			client,
			windowDays: snapshotWindowDays
		})
	);
	const [{ data: overview }, snapshotsRaw, marketInsights] = await Promise.all([
		marketOverviewPromise,
		snapshotsPromise,
		marketInsightsPromise
	]);

	// Anonymous visitors render only the trend chart. Authenticated viewers receive
	// Parchment's canonical process and percentile projections without local scans.
	const processDistribution: ProcessBucket[] =
		isAnonymous || !overview
			? []
			: overview.processDistribution
					.flatMap((row) => [
						row.retail > 0
							? { name: row.process, count: row.retail, wholesale: false as const }
							: null,
						row.wholesale > 0
							? { name: row.process, count: row.wholesale, wholesale: true as const }
							: null
					])
					.filter((row): row is ProcessBucket => row !== null)
					.sort((a, b) => b.count - a.count);

	const originRangeData: OriginRangeRow[] =
		isAnonymous || !overview
			? []
			: overview.originPriceDistribution.map((row) => ({
					origin: row.origin,
					market_scope: row.market,
					price_min: row.price.min,
					price_max: row.price.max,
					price_avg: row.price.average,
					price_median: row.price.median,
					price_q1: row.price.p25,
					price_q3: row.price.p75,
					sample_size: row.sampleSize
				}));

	return {
		snapshots: snapshotsRaw ?? [],
		processDistribution,
		originRangeData,
		marketInsights
	};
}

async function loadAnalyticsWatchlistData({
	principal,
	isParchmentIntelligence,
	sessionClientPromise
}: {
	principal: RequestPrincipal;
	isParchmentIntelligence: boolean;
	sessionClientPromise: Promise<ParchmentClient> | null;
}): Promise<AnalyticsWatchlistData> {
	// Watchlist context: members and Parchment Intelligence users see their tracked
	// lots read against the live index scope.
	const isSourcingMember =
		principal.primaryAppRole === 'member' || principal.primaryAppRole === 'admin';
	if (!sessionClientPromise || (!isParchmentIntelligence && !isSourcingMember)) {
		return { trackedLots: [] };
	}

	try {
		return {
			trackedLots: await sessionClientPromise.then((client) => getTrackedLotSummaries(client, 25))
		};
	} catch (error) {
		console.error('Error loading analytics watchlist context:', error);
		return { trackedLots: [] };
	}
}

async function loadAnalyticsMemberData({
	isParchmentIntelligence,
	sessionClientPromise,
	watchlistPromise
}: {
	isParchmentIntelligence: boolean;
	sessionClientPromise: Promise<ParchmentClient> | null;
	watchlistPromise: Promise<AnalyticsWatchlistData>;
}): Promise<AnalyticsMemberData> {
	if (!isParchmentIntelligence) {
		// Anonymous and non-Intelligence viewers never call the entitled evidence resource.
		return {
			recentArrivals: [],
			recentDelistings: [],
			comparisonBeans: [],
			supplierPriceRanges: [],
			supplierHealth: [],
			trackedLots: (await watchlistPromise).trackedLots
		};
	}

	// Start the independent evidence request as soon as the session client is
	// available. It must not wait for the watchlist round trip to settle.
	const evidencePromise =
		sessionClientPromise?.then((client) => client.market.evidence()) ?? Promise.resolve(null);
	const [client, { trackedLots }, response] = await Promise.all([
		sessionClientPromise ?? Promise.resolve(null),
		watchlistPromise,
		evidencePromise
	]);
	if (!client) {
		throw new Error('Failed to load analytics market evidence: authenticated session required');
	}

	// The watchlist promise is deliberately separate from this rejection. The
	// page can still render tracked lots while its evidence section reports the
	// upstream failure.
	if (!response) {
		throw new Error('Failed to load analytics market evidence: upstream returned no response');
	}
	if (response.error) {
		throw new Error(
			`Failed to load analytics market evidence: ${formatParchmentError(response.error)}`,
			{ cause: response.error }
		);
	}
	if (!response.data?.data) {
		throw new Error('Failed to load analytics market evidence: upstream returned no data');
	}

	const evidence: MarketEvidenceData = response.data.data;
	const mapMovementLot = (row: MarketEvidenceData['recentArrivals'][number]): ArrivalBean => ({
		name: row.name ?? 'Unknown coffee',
		country: row.origin,
		processing: row.process,
		price_per_lb: row.pricePerLb,
		source: row.supplier,
		stocked_date: row.stockedDate,
		wholesale: row.market === 'wholesale'
	});
	const mapDelistingLot = (row: MarketEvidenceData['recentDelistings'][number]): DelistingBean => ({
		name: row.name ?? 'Unknown coffee',
		country: row.origin,
		processing: row.process,
		price_per_lb: row.pricePerLb,
		source: row.supplier,
		unstocked_date: row.unstockedDate,
		wholesale: row.market === 'wholesale'
	});

	const comparisonBeans: ComparisonBean[] = evidence.comparisonLots.flatMap((row) =>
		row.origin && row.pricePerLb !== null
			? [
					{
						name: row.name ?? 'Unknown coffee',
						country: row.origin,
						processing: row.process,
						price_per_lb: row.pricePerLb,
						source: row.supplier,
						wholesale: row.market === 'wholesale',
						bag_size: row.bagSize
					}
				]
			: []
	);

	return {
		recentArrivals: evidence.recentArrivals.map(mapMovementLot),
		recentDelistings: evidence.recentDelistings.map(mapDelistingLot),
		comparisonBeans,
		supplierPriceRanges: evidence.supplierPriceRanges.map((row) => ({
			source: row.supplier,
			market: row.market,
			count: row.lotCount,
			min: row.priceMin,
			median: row.priceMedian,
			max: row.priceMax
		})),
		supplierHealth: evidence.supplierHealth.map((row) => ({
			source: row.supplier,
			stockedCount: row.stockedCount,
			origins: row.originsCount,
			avgCostLb: row.retailAverage ?? 0,
			minCostLb: row.retailMin ?? 0,
			maxCostLb: row.retailMax ?? 0,
			wholesaleCount: row.wholesaleCount,
			retailCount: row.retailCount
		})),
		trackedLots
	};
}

export const load: PageServerLoad = async (event) => {
	// Resolve principal to get explicit Parchment Intelligence access.
	// Logged-out visitors and logged-in viewers intentionally share the same core analytics view.
	const principal = event.locals.principal;
	const isParchmentIntelligence = principal.isAuthenticated ? principal.ppiAccess : false;
	const { session } = getPageAuthState(principal);
	const isAnonymous = !session;

	// Start independent streamed resources before waiting for the aggregate preview.
	// They keep their own section-level failure boundaries while the initial SSR
	// response waits only for the overview needed to render its synchronous shell.
	const marketOverviewPromise = loadMarketOverview(event);
	const analyticsCharts = loadAnalyticsCharts(event, {
		isParchmentIntelligence,
		isAnonymous,
		marketOverviewPromise
	});
	const isSourcingMember =
		principal.primaryAppRole === 'member' || principal.primaryAppRole === 'admin';
	const sessionClientPromise =
		principal.isAuthenticated && (isParchmentIntelligence || isSourcingMember)
			? createParchmentServerClient(event, { mode: 'session' })
			: null;
	const analyticsWatchlist = loadAnalyticsWatchlistData({
		principal,
		isParchmentIntelligence,
		sessionClientPromise
	});
	const analyticsMember = loadAnalyticsMemberData({
		isParchmentIntelligence,
		sessionClientPromise,
		watchlistPromise: analyticsWatchlist
	});

	// The only awaited product-data read before the first byte is the canonical
	// aggregate overview. Every durable market projection remains Parchment-owned.
	const marketOverview = await marketOverviewPromise;
	const analyticsPreview = buildAnalyticsPreview(marketOverview.data);
	const lastUpdated = analyticsPreview.stats.lastUpdated;

	// Coverage, charts, and entitlement-gated datasets stream independently, so a
	// failure in one envelope does not discard the other sections.
	const analyticsCoverage = marketOverview.data
		? Promise.resolve(buildAnalyticsCoverage(marketOverview.data))
		: Promise.reject(marketOverview.error ?? new Error('Failed to load analytics market overview'));

	// Mark server-side rejections as handled; the rejection still streams to the
	// client, which renders a section-level error state for it.
	analyticsCoverage.catch(() => {});
	analyticsCharts.catch(() => {});
	analyticsWatchlist.catch(() => {});
	analyticsMember.catch(() => {});

	const baseUrl = `${event.url.protocol}//${event.url.host}`;
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
			dateModified: lastUpdated ?? undefined,
			variableMeasured: [
				'Price per pound (USD)',
				'Origin country',
				'Processing method',
				'Supplier count',
				'Sample size'
			]
		})
	]);

	return {
		isParchmentIntelligence,
		analyticsPreview,
		analyticsCoverage,
		analyticsCharts,
		analyticsWatchlist,
		analyticsMember,
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
