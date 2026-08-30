import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { components, ParchmentClient } from '@purveyors/sdk';
import type { RequestPrincipal } from '$lib/server/principal';
import { anonymousPrincipal, cookieSessionPrincipal } from '$lib/server/principal.test-utils';
import type {
	AnalyticsCharts,
	AnalyticsCoverage,
	AnalyticsMemberData,
	AnalyticsWatchlistData,
	AnalyticsPreview,
	PriceSnapshot
} from './+page.server';

const { mockCreateParchmentServerClient, mockGetTrackedLotSummaries } = vi.hoisted(() => ({
	mockCreateParchmentServerClient: vi.fn(),
	mockGetTrackedLotSummaries: vi.fn()
}));

vi.mock('$lib/seo/meta', () => ({
	buildPublicMeta: vi.fn((value) => value),
	resolvePublicPageSocialImage: vi.fn(() => '/og/analytics.jpg')
}));

vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: mockCreateParchmentServerClient
}));

vi.mock('$lib/server/trackedLots', () => ({
	getTrackedLotSummaries: mockGetTrackedLotSummaries
}));

vi.mock('$lib/services/schemaService', () => ({
	createSchemaService: vi.fn(() => ({
		generateOrganizationSchema: vi.fn(() => ({ '@type': 'Organization' })),
		generateDatasetSchema: vi.fn((dataset) => ({
			'@type': 'Dataset',
			...Object.fromEntries(
				Object.entries(dataset as Record<string, unknown>).filter(
					([, value]) => value !== undefined
				)
			)
		})),
		generateSchemaGraph: vi.fn((schemas) => ({ '@graph': schemas }))
	}))
}));

import { _loadPriceSnapshotsPaginated, load } from './+page.server';

type HistoryRow = components['schemas']['PriceIndexHistoryItem'];
type MarketOverviewData = components['schemas']['MarketOverviewResponse']['data'];
type MarketEvidenceData = components['schemas']['MarketEvidenceResponse']['data'];

interface StreamedLoadResult {
	analyticsPreview: AnalyticsPreview;
	analyticsCoverage: Promise<AnalyticsCoverage>;
	analyticsCharts: Promise<AnalyticsCharts>;
	analyticsWatchlist: Promise<AnalyticsWatchlistData>;
	analyticsMember: Promise<AnalyticsMemberData>;
	meta: Record<string, unknown>;
}

const overviewFixture: MarketOverviewData = {
	daily: {
		asOf: '2026-04-08',
		totalStocked: 120,
		totalSuppliers: 39,
		totalOrigins: 18,
		retailMedian: 4.2,
		changes: { retailMedian7d: 1.5, retailMedian30d: 3.25, supply7d: -2, supply30d: 4 }
	},
	coverage: {
		totalListings: 150,
		stockedListings: { total: 53, retail: 42, wholesale: 11 },
		stockedOrigins: { total: 3, retail: 2, wholesale: 2 },
		stockedSuppliers: { total: 4, retail: 2, wholesale: 2 }
	},
	movement: {
		referenceDate: '2026-04-08',
		arrivals: {
			sevenDay: { retail: 5, wholesale: 2 },
			thirtyDay: { retail: 14, wholesale: 7 }
		},
		delistings: {
			sevenDay: { retail: 3, wholesale: 1 },
			thirtyDay: { retail: 10, wholesale: 4 }
		}
	},
	processDistribution: [
		{ process: 'Washed', total: 30, retail: 20, wholesale: 10 },
		{ process: 'Natural', total: 29, retail: 4, wholesale: 25 },
		{ process: 'Honey', total: 0, retail: 0, wholesale: 0 }
	],
	originPriceDistribution: [
		{
			origin: 'Colombia',
			market: 'all',
			price: { min: 2, max: 6, average: 4, median: 4, p25: 3, p75: 5 },
			sampleSize: 6,
			supplierCount: 3
		},
		{
			origin: 'Colombia',
			market: 'retail',
			price: { min: 4, max: 6, average: 5, median: 5, p25: 4.5, p75: 5.5 },
			sampleSize: 3,
			supplierCount: 2
		},
		{
			origin: 'Colombia',
			market: 'wholesale',
			price: { min: 2, max: 4, average: 3, median: 3, p25: 2.5, p75: 3.5 },
			sampleSize: 3,
			supplierCount: 1
		}
	]
};

const evidenceFixture: MarketEvidenceData = {
	referenceDate: '2026-04-08',
	recentArrivals: [
		{
			catalogId: 101,
			name: 'Wholesale member lot',
			origin: 'Brazil',
			process: 'Natural',
			pricePerLb: 3.5,
			supplier: 'Royal',
			market: 'wholesale',
			bagSize: '60kg',
			stockedDate: '2026-04-07',
			unstockedDate: null
		},
		{
			catalogId: 104,
			name: null,
			origin: null,
			process: null,
			pricePerLb: null,
			supplier: 'Supplier undisclosed',
			market: 'retail',
			bagSize: null,
			stockedDate: null,
			unstockedDate: null
		}
	],
	recentDelistings: [
		{
			catalogId: 102,
			name: 'Departed lot',
			origin: 'Colombia',
			process: 'Washed',
			pricePerLb: 5.25,
			supplier: 'Atlas',
			market: 'retail',
			bagSize: '1lb',
			stockedDate: null,
			unstockedDate: '2026-04-06'
		},
		{
			catalogId: 105,
			name: null,
			origin: null,
			process: null,
			pricePerLb: null,
			supplier: 'Supplier undisclosed',
			market: 'wholesale',
			bagSize: null,
			stockedDate: null,
			unstockedDate: null
		}
	],
	comparisonLots: [
		{
			catalogId: 103,
			name: 'Comparison lot',
			origin: 'Ethiopia',
			process: 'Natural',
			pricePerLb: 7.5,
			supplier: 'Supplier undisclosed',
			market: 'retail',
			bagSize: '2lb',
			stockedDate: '2026-04-01',
			unstockedDate: null
		},
		{
			catalogId: 106,
			name: 'Missing origin',
			origin: null,
			process: 'Washed',
			pricePerLb: 8,
			supplier: 'Atlas',
			market: 'retail',
			bagSize: '1lb',
			stockedDate: null,
			unstockedDate: null
		},
		{
			catalogId: 107,
			name: 'Missing price',
			origin: 'Kenya',
			process: 'Washed',
			pricePerLb: null,
			supplier: 'Atlas',
			market: 'retail',
			bagSize: '1lb',
			stockedDate: null,
			unstockedDate: null
		}
	],
	supplierHealth: [
		{
			supplier: 'Atlas',
			stockedCount: 18,
			originsCount: 6,
			retailAverage: 6.25,
			retailMin: 4,
			retailMax: 12,
			wholesaleCount: 2,
			retailCount: 16
		},
		{
			supplier: 'Royal',
			stockedCount: 3,
			originsCount: 2,
			retailAverage: null,
			retailMin: null,
			retailMax: null,
			wholesaleCount: 3,
			retailCount: 0
		}
	],
	supplierPriceRanges: [
		{
			supplier: 'Atlas',
			market: 'retail',
			lotCount: 18,
			priceMin: 4,
			priceMedian: 6.5,
			priceMax: 12
		},
		{
			supplier: 'Royal',
			market: 'wholesale',
			lotCount: 3,
			priceMin: 2.1,
			priceMedian: 3.2,
			priceMax: 4.3
		}
	]
};

function makeHistoryRow(index: number): HistoryRow {
	return {
		date: `2026-01-${String((index % 28) + 1).padStart(2, '0')}`,
		origin: `Origin ${String(index).padStart(4, '0')}`,
		process: index % 2 === 0 ? 'Washed' : 'Natural',
		grade: null,
		wholesale: index % 3 === 0,
		price: {
			avg: 3 + index / 100,
			median: 3 + index / 100,
			min: 2 + index / 100,
			max: 4 + index / 100,
			p25: 2.5 + index / 100,
			p75: 3.5 + index / 100,
			stdev: 0.25
		},
		sample: { suppliers: 10, listings: 25, aggregationTier: 1 },
		provenance: { synthetic: index % 5 === 0 }
	};
}

function mapExpectedSnapshot(row: HistoryRow): PriceSnapshot {
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

function createAnalyticsClient(
	options: {
		overview?: MarketOverviewData | null;
		overviewError?: unknown;
		evidence?: MarketEvidenceData | null;
		evidenceError?: unknown;
		historyPages?: Array<{ data: HistoryRow[] | null; error?: unknown }>;
	} = {}
) {
	const historyCalls: unknown[] = [];
	const pages = options.historyPages ?? [{ data: [] }];
	const history = vi.fn(async (query) => {
		historyCalls.push(query);
		const page = pages[historyCalls.length - 1] ?? { data: [] };
		return page.error
			? { error: page.error }
			: {
					data: {
						data: page.data ?? [],
						pagination: { hasNext: (page.data?.length ?? 0) === 1000 }
					}
				};
	});
	const overview = vi
		.fn()
		.mockResolvedValue(
			options.overviewError
				? { error: options.overviewError }
				: options.overview === null
					? { data: {} }
					: { data: { data: options.overview ?? overviewFixture } }
		);
	const evidence = vi
		.fn()
		.mockResolvedValue(
			options.evidenceError
				? { error: options.evidenceError }
				: options.evidence === null
					? { data: {} }
					: { data: { data: options.evidence ?? evidenceFixture } }
		);
	const client = {
		market: {
			overview,
			evidence,
			signals: vi.fn().mockResolvedValue({ error: { error: { message: 'unavailable' } } }),
			metadataIndex: vi.fn().mockResolvedValue({ error: { error: { message: 'unavailable' } } })
		},
		priceIndex: {
			history,
			stats: vi.fn().mockResolvedValue({ error: { error: { message: 'unavailable' } } })
		}
	} as unknown as ParchmentClient;
	return { client, overview, evidence, historyCalls };
}

function createEvent(principal: RequestPrincipal = anonymousPrincipal()) {
	return {
		url: new URL('https://example.com/analytics'),
		request: new Request('https://example.com/analytics'),
		locals: { principal }
	} as never;
}

async function runLoad(
	principal: RequestPrincipal = anonymousPrincipal()
): Promise<StreamedLoadResult> {
	return (await load(createEvent(principal))) as unknown as StreamedLoadResult;
}

beforeEach(() => {
	vi.clearAllMocks();
	mockGetTrackedLotSummaries.mockResolvedValue([]);
});

describe('loadPriceSnapshotsPaginated', () => {
	it('loads every history page in ascending order and maps the SDK response shape', async () => {
		const setup = createAnalyticsClient({
			historyPages: [
				{ data: Array.from({ length: 1000 }, (_, index) => makeHistoryRow(index)) },
				{ data: Array.from({ length: 25 }, (_, index) => makeHistoryRow(index + 1000)) }
			]
		});

		const snapshots = await _loadPriceSnapshotsPaginated({ client: setup.client, windowDays: 365 });

		expect(snapshots).toHaveLength(1025);
		expect(snapshots[0]).toEqual(mapExpectedSnapshot(makeHistoryRow(0)));
		expect(snapshots.at(-1)).toEqual(mapExpectedSnapshot(makeHistoryRow(1024)));
		expect(setup.historyCalls).toEqual([
			{ windowDays: 365, page: 1, limit: 1000, order: 'asc' },
			{ windowDays: 365, page: 2, limit: 1000, order: 'asc' }
		]);
	});

	it('throws when an intermediate page fails instead of returning partial data', async () => {
		const setup = createAnalyticsClient({
			historyPages: [
				{ data: Array.from({ length: 1000 }, (_, index) => makeHistoryRow(index)) },
				{ data: null, error: { error: { message: 'API blew up' } } }
			]
		});

		await expect(
			_loadPriceSnapshotsPaginated({ client: setup.client, windowDays: 90 })
		).rejects.toThrow('Failed to load analytics price snapshots page 2: API blew up');
	});
});

describe('analytics load', () => {
	it('starts independent streamed reads before the overview response settles', async () => {
		const setup = createAnalyticsClient();
		let releaseOverview!: () => void;
		setup.overview.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					releaseOverview = () => resolve({ data: { data: overviewFixture } });
				})
		);
		mockCreateParchmentServerClient.mockResolvedValue(setup.client);

		const loadPromise = runLoad(cookieSessionPrincipal('member', { ppiAccess: true }));

		await vi.waitFor(() => {
			expect(setup.historyCalls).toHaveLength(1);
			expect(setup.evidence).toHaveBeenCalledOnce();
		});
		releaseOverview();

		const result = await loadPromise;
		await expect(result.analyticsCharts).resolves.toBeTruthy();
		await expect(result.analyticsMember).resolves.toBeTruthy();
	});

	it('maps the anonymous overview into preview and streamed coverage without a demo credential', async () => {
		const setup = createAnalyticsClient();
		mockCreateParchmentServerClient.mockResolvedValue(setup.client);

		const result = await runLoad();
		const coverage = await result.analyticsCoverage;
		const charts = await result.analyticsCharts;
		const member = await result.analyticsMember;

		expect(setup.overview).toHaveBeenCalledOnce();
		expect(mockCreateParchmentServerClient).toHaveBeenCalledWith(expect.anything(), {
			mode: 'anonymous'
		});
		expect(result.analyticsPreview).toEqual({
			stats: {
				totalBeansTracked: 0,
				stockedRetailBeans: 0,
				stockedWholesaleBeans: 0,
				stockedRetailOrigins: 0,
				stockedWholesaleOrigins: 0,
				stockedOrigins: 18,
				stockedRetailSuppliers: 0,
				stockedWholesaleSuppliers: 0,
				stockedSuppliers: 39,
				totalSuppliers: 39,
				originsCount: 18,
				lastUpdated: '2026-04-08'
			},
			marketSummary: {
				retail_median_7d_change: 1.5,
				retail_median_30d_change: 3.25,
				supply_7d_change: -2,
				supply_30d_change: 4
			}
		});
		expect(coverage).toEqual({
			stats: {
				totalBeansTracked: 150,
				stockedRetailBeans: 42,
				stockedWholesaleBeans: 11,
				stockedRetailOrigins: 2,
				stockedWholesaleOrigins: 2,
				stockedOrigins: 3,
				stockedRetailSuppliers: 2,
				stockedWholesaleSuppliers: 2,
				stockedSuppliers: 4,
				totalSuppliers: 39,
				originsCount: 18,
				lastUpdated: '2026-04-08'
			},
			movementCounts: {
				available: true,
				arrivals: {
					sevenDay: { retail: 5, wholesale: 2 },
					thirtyDay: { retail: 14, wholesale: 7 }
				},
				delistings: {
					sevenDay: { retail: 3, wholesale: 1 },
					thirtyDay: { retail: 10, wholesale: 4 }
				}
			}
		});
		expect(charts.processDistribution).toEqual([]);
		expect(charts.originRangeData).toEqual([]);
		expect(member).toEqual({
			recentArrivals: [],
			recentDelistings: [],
			comparisonBeans: [],
			supplierPriceRanges: [],
			supplierHealth: [],
			trackedLots: []
		});
		expect(setup.evidence).not.toHaveBeenCalled();
		expect(result.meta.schemaData).toMatchObject({
			'@graph': expect.arrayContaining([
				expect.objectContaining({ '@type': 'Dataset', dateModified: '2026-04-08' })
			])
		});
	});

	it('maps canonical process and origin distributions for authenticated viewers', async () => {
		const setup = createAnalyticsClient();
		mockCreateParchmentServerClient.mockResolvedValue(setup.client);
		const principal = cookieSessionPrincipal('viewer');

		const result = await runLoad(principal);
		const charts = await result.analyticsCharts;

		expect(mockCreateParchmentServerClient).toHaveBeenCalledWith(expect.anything(), {
			mode: 'session'
		});
		expect(charts.processDistribution).toEqual([
			{ name: 'Natural', count: 25, wholesale: true },
			{ name: 'Washed', count: 20, wholesale: false },
			{ name: 'Washed', count: 10, wholesale: true },
			{ name: 'Natural', count: 4, wholesale: false }
		]);
		expect(charts.originRangeData).toEqual([
			{
				origin: 'Colombia',
				market_scope: 'all',
				price_min: 2,
				price_max: 6,
				price_avg: 4,
				price_median: 4,
				price_q1: 3,
				price_q3: 5,
				sample_size: 6
			},
			{
				origin: 'Colombia',
				market_scope: 'retail',
				price_min: 4,
				price_max: 6,
				price_avg: 5,
				price_median: 5,
				price_q1: 4.5,
				price_q3: 5.5,
				sample_size: 3
			},
			{
				origin: 'Colombia',
				market_scope: 'wholesale',
				price_min: 2,
				price_max: 4,
				price_avg: 3,
				price_median: 3,
				price_q1: 2.5,
				price_q3: 3.5,
				sample_size: 3
			}
		]);
		expect(setup.historyCalls).toEqual([{ windowDays: 90, page: 1, limit: 1000, order: 'asc' }]);
		expect(setup.evidence).not.toHaveBeenCalled();
	});

	it('maps entitled market evidence and tracked lots through the session client', async () => {
		const setup = createAnalyticsClient();
		mockCreateParchmentServerClient.mockResolvedValue(setup.client);
		mockGetTrackedLotSummaries.mockResolvedValue([{ id: 'tracked-1' }]);
		const principal = cookieSessionPrincipal('member', { ppiAccess: true });

		const result = await runLoad(principal);
		const member = await result.analyticsMember;
		await result.analyticsCharts;

		expect(setup.evidence).toHaveBeenCalledOnce();
		expect(mockGetTrackedLotSummaries).toHaveBeenCalledWith(setup.client, 25);
		expect(member).toEqual({
			recentArrivals: [
				{
					name: 'Wholesale member lot',
					country: 'Brazil',
					processing: 'Natural',
					price_per_lb: 3.5,
					source: 'Royal',
					stocked_date: '2026-04-07',
					wholesale: true
				},
				{
					name: 'Unknown coffee',
					country: null,
					processing: null,
					price_per_lb: null,
					source: 'Supplier undisclosed',
					stocked_date: null,
					wholesale: false
				}
			],
			recentDelistings: [
				{
					name: 'Departed lot',
					country: 'Colombia',
					processing: 'Washed',
					price_per_lb: 5.25,
					source: 'Atlas',
					unstocked_date: '2026-04-06',
					wholesale: false
				},
				{
					name: 'Unknown coffee',
					country: null,
					processing: null,
					price_per_lb: null,
					source: 'Supplier undisclosed',
					unstocked_date: null,
					wholesale: true
				}
			],
			comparisonBeans: [
				{
					name: 'Comparison lot',
					country: 'Ethiopia',
					processing: 'Natural',
					price_per_lb: 7.5,
					source: 'Supplier undisclosed',
					wholesale: false,
					bag_size: '2lb'
				}
			],
			supplierPriceRanges: [
				{
					source: 'Atlas',
					market: 'retail',
					count: 18,
					min: 4,
					median: 6.5,
					max: 12
				},
				{
					source: 'Royal',
					market: 'wholesale',
					count: 3,
					min: 2.1,
					median: 3.2,
					max: 4.3
				}
			],
			supplierHealth: [
				{
					source: 'Atlas',
					stockedCount: 18,
					origins: 6,
					avgCostLb: 6.25,
					minCostLb: 4,
					maxCostLb: 12,
					wholesaleCount: 2,
					retailCount: 16
				},
				{
					source: 'Royal',
					stockedCount: 3,
					origins: 2,
					avgCostLb: 0,
					minCostLb: 0,
					maxCostLb: 0,
					wholesaleCount: 3,
					retailCount: 0
				}
			],
			trackedLots: [{ id: 'tracked-1' }]
		});
		expect(setup.historyCalls).toEqual([{ windowDays: 365, page: 1, limit: 1000, order: 'asc' }]);
	});

	it('starts market evidence without awaiting the independent watchlist read', async () => {
		const setup = createAnalyticsClient();
		let releaseWatchlist!: (lots: []) => void;
		mockGetTrackedLotSummaries.mockImplementationOnce(
			() => new Promise((resolve) => (releaseWatchlist = resolve))
		);
		mockCreateParchmentServerClient.mockResolvedValue(setup.client);

		const result = await runLoad(cookieSessionPrincipal('member', { ppiAccess: true }));

		await vi.waitFor(() => {
			expect(setup.evidence).toHaveBeenCalledOnce();
		});
		releaseWatchlist([]);
		await expect(result.analyticsMember).resolves.toBeTruthy();
	});

	it('keeps overview failure section-scoped while preserving history and member envelopes', async () => {
		const setup = createAnalyticsClient({
			overviewError: { error: { message: 'overview unavailable' } }
		});
		mockCreateParchmentServerClient.mockResolvedValue(setup.client);

		const result = await runLoad();

		expect(result.analyticsPreview.stats.lastUpdated).toBeNull();
		await expect(result.analyticsCoverage).rejects.toThrow('overview unavailable');
		await expect(result.analyticsCharts).resolves.toMatchObject({
			processDistribution: [],
			originRangeData: []
		});
		await expect(result.analyticsMember).resolves.toMatchObject({ recentArrivals: [] });
	});

	it('rejects only the entitled member payload when market evidence fails', async () => {
		const setup = createAnalyticsClient({
			evidenceError: { error: { message: 'evidence unavailable' } }
		});
		mockCreateParchmentServerClient.mockResolvedValue(setup.client);
		const principal = cookieSessionPrincipal('member', { ppiAccess: true });

		const result = await runLoad(principal);

		await expect(result.analyticsCoverage).resolves.toBeTruthy();
		await expect(result.analyticsCharts).resolves.toBeTruthy();
		await expect(result.analyticsMember).rejects.toThrow('evidence unavailable');
		await expect(result.analyticsWatchlist).resolves.toEqual({ trackedLots: [] });
	});

	it('keeps a healthy watchlist deliverable when market evidence fails', async () => {
		const setup = createAnalyticsClient({
			evidenceError: { error: { message: 'evidence unavailable' } }
		});
		mockCreateParchmentServerClient.mockResolvedValue(setup.client);
		mockGetTrackedLotSummaries.mockResolvedValue([{ id: 'tracked-1' }]);

		const result = await runLoad(cookieSessionPrincipal('member', { ppiAccess: true }));

		await expect(result.analyticsMember).rejects.toThrow('evidence unavailable');
		await expect(result.analyticsWatchlist).resolves.toEqual({
			trackedLots: [{ id: 'tracked-1' }]
		});
	});
});
