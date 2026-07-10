import { render, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import AnalyticsPage from './+page.svelte';
import type { PageData } from './$types';
import type {
	AnalyticsCharts,
	AnalyticsCoverage,
	AnalyticsMemberData,
	AnalyticsPreview
} from './+page.server';
import { pageChatContext } from '$lib/stores/pageContextStore.svelte';

const {
	goto,
	loadPublicTrendAnalyticsModule,
	loadPublicAnalyticsModules,
	loadMemberAnalyticsModules,
	loadSupplierAnalyticsModules
} = vi.hoisted(() => ({
	goto: vi.fn(),
	loadPublicTrendAnalyticsModule: vi.fn(),
	loadPublicAnalyticsModules: vi.fn(),
	loadMemberAnalyticsModules: vi.fn(),
	loadSupplierAnalyticsModules: vi.fn()
}));

vi.mock('$app/navigation', () => ({ goto }));
vi.mock('./deferredModules', () => ({
	loadPublicTrendAnalyticsModule,
	loadPublicAnalyticsModules,
	loadMemberAnalyticsModules,
	loadSupplierAnalyticsModules
}));

type DeferredPromise<T> = {
	promise: Promise<T>;
	resolve: (value: T) => void;
	reject: (reason?: unknown) => void;
};

function deferred<T>(): DeferredPromise<T> {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

async function loadStubComponent() {
	const module = await import('./__test-fixtures__/AnalyticsStub.svelte');
	return module.default;
}

async function buildPublicModules() {
	const component = await loadStubComponent();
	return {
		OriginLineChartComponent: component,
		OriginBarChartComponent: component,
		ProcessDonutChartComponent: component
	};
}

async function buildPublicTrendModule() {
	const component = await loadStubComponent();
	return {
		OriginLineChartComponent: component
	};
}

async function buildMemberModules() {
	const component = await loadStubComponent();
	return { PriceTierChartComponent: component };
}

async function buildSupplierModules() {
	const component = await loadStubComponent();
	return {
		SupplierComparisonTableComponent: component,
		SupplierHealthTableComponent: component
	};
}

function createBaseline() {
	return {
		stats: {
			totalBeansTracked: 120,
			stockedRetailBeans: 84,
			stockedWholesaleBeans: 18,
			stockedRetailOrigins: 5,
			stockedWholesaleOrigins: 2,
			stockedOrigins: 6,
			stockedRetailSuppliers: 3,
			stockedWholesaleSuppliers: 1,
			stockedSuppliers: 4,
			totalSuppliers: 12,
			originsCount: 7,
			lastUpdated: '2026-04-08'
		},
		snapshots: [
			{
				snapshot_date: '2026-04-08',
				origin: 'Colombia',
				process: 'Washed',
				price_avg: 4.2,
				price_median: 4.1,
				price_min: 3.8,
				price_max: 4.5,
				price_p25: 4,
				price_p75: 4.3,
				price_stdev: 0.2,
				supplier_count: 4,
				sample_size: 9,
				wholesale_only: false,
				aggregation_tier: 1
			},
			{
				snapshot_date: '2026-04-08',
				origin: 'Colombia',
				process: 'Washed',
				price_avg: 3.6,
				price_median: 3.5,
				price_min: 3.3,
				price_max: 3.9,
				price_p25: 3.4,
				price_p75: 3.7,
				price_stdev: 0.15,
				supplier_count: 3,
				sample_size: 7,
				wholesale_only: true,
				aggregation_tier: 1
			}
		],
		processDistribution: [{ name: 'Washed', count: 9, wholesale: false }],
		originRangeData: [
			{
				origin: 'Colombia',
				market_scope: 'retail',
				price_min: 3.8,
				price_max: 4.5,
				price_avg: 4.2,
				price_median: 4.1,
				price_q1: 4,
				price_q3: 4.3,
				sample_size: 9
			}
		],
		movementCounts: {
			available: true,
			arrivals: {
				sevenDay: { retail: 1, wholesale: 0 },
				thirtyDay: { retail: 2, wholesale: 0 }
			},
			delistings: {
				sevenDay: { retail: 1, wholesale: 0 },
				thirtyDay: { retail: 2, wholesale: 0 }
			}
		},
		recentArrivals: [
			{
				name: 'Fresh Ethiopia',
				country: 'Ethiopia',
				processing: 'Natural',
				price_per_lb: 4.8,
				source: 'Cafe Imports',
				stocked_date: '2026-04-07',
				wholesale: false
			},
			{
				name: 'Older Arrival',
				country: 'Kenya',
				processing: 'Washed',
				price_per_lb: 5.1,
				source: 'Royal Coffee',
				stocked_date: '2026-03-15',
				wholesale: false
			}
		],
		recentDelistings: [
			{
				name: 'Recently Gone',
				country: 'Guatemala',
				processing: 'Washed',
				price_per_lb: 4.2,
				source: 'Atlas',
				unstocked_date: '2026-04-06',
				wholesale: false
			},
			{
				name: 'Older Gone',
				country: 'Brazil',
				processing: 'Natural',
				price_per_lb: 3.9,
				source: 'Red Fox',
				unstocked_date: '2026-03-12',
				wholesale: false
			}
		],
		comparisonBeans: [
			{
				name: 'Colombia Huila',
				country: 'Colombia',
				processing: 'Washed',
				price_per_lb: 4.25,
				source: 'Atlas',
				wholesale: false,
				bag_size: null
			}
		],
		supplierPriceRanges: [
			{
				source: 'Atlas',
				market: 'retail',
				count: 1,
				min: 4.25,
				median: 4.25,
				max: 4.25
			}
		],
		supplierHealth: [
			{
				source: 'Atlas Coffee',
				stockedCount: 15,
				origins: 6,
				avgCostLb: 4.15,
				minCostLb: 3.75,
				maxCostLb: 4.8,
				wholesaleCount: 4,
				retailCount: 11
			}
		],
		trackedLots: [],
		marketInsights: {
			valueSignals: null,
			signalsSummary: null,
			signalsAsOf: null,
			moveStats: null,
			metadataProcessSeries: null,
			metadataDisclosureSeries: null,
			metadataPurveyorScoreSeries: null,
			metadataPurveyorScoreConfidenceSeries: null,
			metadataPurveyorScoreTierSeries: null
		}
	};
}

function createData(overrides: Record<string, unknown> = {}): PageData {
	const {
		session = null,
		isParchmentIntelligence = false,
		role = 'viewer',
		analyticsPreview,
		analyticsCoverage,
		analyticsCharts,
		analyticsMember,
		...flatOverrides
	} = overrides as {
		session?: unknown;
		isParchmentIntelligence?: boolean;
		role?: string;
		analyticsPreview?: AnalyticsPreview;
		analyticsCoverage?: Promise<AnalyticsCoverage>;
		analyticsCharts?: Promise<AnalyticsCharts>;
		analyticsMember?: Promise<AnalyticsMemberData>;
	} & Record<string, unknown>;

	const base = { ...createBaseline(), ...flatOverrides } as ReturnType<typeof createBaseline>;

	const preview: AnalyticsPreview = analyticsPreview ?? {
		stats: base.stats,
		marketSummary: {
			retail_median_7d_change: null,
			retail_median_30d_change: null,
			supply_7d_change: null,
			supply_30d_change: null
		}
	};

	return {
		session,
		role,
		isParchmentIntelligence,
		analyticsPreview: preview,
		analyticsCoverage:
			analyticsCoverage ??
			Promise.resolve({
				stats: base.stats,
				movementCounts: base.movementCounts
			} as AnalyticsCoverage),
		analyticsCharts:
			analyticsCharts ??
			Promise.resolve({
				snapshots: base.snapshots,
				processDistribution: base.processDistribution,
				originRangeData: base.originRangeData,
				marketInsights: base.marketInsights
			} as AnalyticsCharts),
		analyticsMember:
			analyticsMember ??
			Promise.resolve({
				recentArrivals: base.recentArrivals,
				recentDelistings: base.recentDelistings,
				comparisonBeans: base.comparisonBeans,
				supplierPriceRanges: base.supplierPriceRanges,
				supplierHealth: base.supplierHealth,
				trackedLots: base.trackedLots
			} as AnalyticsMemberData)
	} as unknown as PageData;
}

function createSession() {
	return { user: { id: 'user-1' } } as NonNullable<PageData['session']>;
}

function expectPromptLine(prompt: string | null, line: string) {
	expect(prompt).toContain(line);
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-04-09T12:00:00.000Z').getTime());
	loadPublicTrendAnalyticsModule.mockImplementation(buildPublicTrendModule);
	loadPublicAnalyticsModules.mockImplementation(buildPublicModules);
	loadMemberAnalyticsModules.mockImplementation(buildMemberModules);
	loadSupplierAnalyticsModules.mockImplementation(buildSupplierModules);
});

afterEach(() => {
	pageChatContext.clear();
	vi.restoreAllMocks();
});

describe('analytics page loading experience', () => {
	it('renders the preview market read while streamed datasets are still pending', async () => {
		const coverage = deferred<AnalyticsCoverage>();
		const charts = deferred<AnalyticsCharts>();
		const member = deferred<AnalyticsMemberData>();
		const baseline = createBaseline();

		const { container } = render(AnalyticsPage, {
			data: createData({
				analyticsCoverage: coverage.promise,
				analyticsCharts: charts.promise,
				analyticsMember: member.promise
			})
		});

		// Preview-backed hero renders immediately with loading-aware phrasing —
		// never "unavailable" claims for data that is still streaming.
		await waitFor(() => {
			expect(screen.getByText(/movement and coverage counts are streaming in/i)).toBeTruthy();
		});
		expect(
			screen.getByText(/price movement is loading with the comparable snapshot layer/i)
		).toBeTruthy();
		expect(screen.queryByText(/movement data is unavailable/i)).toBeNull();
		expect(screen.getByLabelText('Loading market signals')).toBeTruthy();
		expect(screen.queryByLabelText('Market KPI strip')).toBeNull();
		expect(container.querySelector('[aria-label="Loading Market Index"]')).toBeTruthy();
		expect(screen.queryByText('Unlock the full market map.')).toBeNull();
		expect(pageChatContext.current).toBeNull();

		coverage.resolve({ stats: baseline.stats, movementCounts: baseline.movementCounts });
		charts.resolve({
			snapshots: baseline.snapshots,
			processDistribution: baseline.processDistribution,
			originRangeData: baseline.originRangeData,
			marketInsights: baseline.marketInsights
		} as AnalyticsCharts);
		member.resolve({
			recentArrivals: [],
			recentDelistings: [],
			comparisonBeans: [],
			supplierPriceRanges: [],
			supplierHealth: [],
			trackedLots: []
		});

		await waitFor(() => {
			expect(screen.getByLabelText('Market KPI strip')).toBeTruthy();
		});
		expect(screen.getByText('Unlock the full market map.')).toBeTruthy();
		expect(screen.queryByLabelText('Loading market signals')).toBeNull();
		expect(container.querySelector('[aria-label="Loading Market Index"]')).toBeNull();
		expect(pageChatContext.current?.summary).toContain('84 stocked listings');
	});

	it('withholds the stability call while chart evidence is still streaming', async () => {
		const charts = deferred<AnalyticsCharts>();
		const baseline = createBaseline();

		render(AnalyticsPage, { data: createData({ analyticsCharts: charts.promise }) });

		// Coverage resolves with balanced movement, but no price evidence has
		// arrived yet — the headline must not fall through to a stability claim.
		await waitFor(() => {
			expect(screen.getByText(/movement and coverage signals are streaming next/i)).toBeTruthy();
		});
		expect(screen.queryByText(/market read is stable/i)).toBeNull();

		charts.resolve({
			snapshots: baseline.snapshots,
			processDistribution: baseline.processDistribution,
			originRangeData: baseline.originRangeData,
			marketInsights: baseline.marketInsights
		} as AnalyticsCharts);

		await waitFor(() => {
			expect(screen.getByText(/market read is stable/i)).toBeTruthy();
		});
	});

	it('renders chart sections without waiting for the member stream', async () => {
		const member = deferred<AnalyticsMemberData>();
		const baseline = createBaseline();

		render(AnalyticsPage, {
			data: createData({
				session: createSession(),
				isParchmentIntelligence: true,
				analyticsMember: member.promise
			})
		});

		// Chart-backed sections render as soon as the charts stream settles...
		await waitFor(() => {
			expect(screen.getAllByText('Origin price trends').length).toBeGreaterThan(0);
		});
		// ...while member-backed panels wait on their own loading state instead
		// of showing misleading empty supplier/movement evidence.
		expect(screen.getByLabelText('Loading member market evidence')).toBeTruthy();
		expect(screen.queryByText('Fresh Ethiopia')).toBeNull();

		member.resolve({
			recentArrivals: baseline.recentArrivals,
			recentDelistings: baseline.recentDelistings,
			comparisonBeans: baseline.comparisonBeans,
			supplierPriceRanges: baseline.supplierPriceRanges,
			supplierHealth: baseline.supplierHealth,
			trackedLots: []
		} as AnalyticsMemberData);

		await waitFor(() => {
			expect(screen.queryByLabelText('Loading member market evidence')).toBeNull();
		});
		await waitFor(() => {
			expect(screen.getByText('Fresh Ethiopia')).toBeTruthy();
		});
	});

	it('replaces skeletons with an error notice when a streamed dataset rejects', async () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		const { container } = render(AnalyticsPage, {
			data: createData({
				analyticsCharts: Promise.reject(new Error('snapshot stream failed'))
			})
		});

		await waitFor(() => {
			expect(screen.getByText('Some market data did not load.')).toBeTruthy();
		});
		expect(screen.getByText(/price history and chart evidence/i)).toBeTruthy();
		// Settled-with-error stops the skeletons instead of pulsing forever.
		await waitFor(() => {
			expect(container.querySelector('[aria-label="Loading Market Index"]')).toBeNull();
		});
		expect(screen.queryByLabelText('Loading market signals')).toBeNull();
		// Balanced movement plus a failed price layer must not read as stability.
		expect(screen.getByText(/makes no stability call/i)).toBeTruthy();
		expect(screen.queryByText(/market read is stable/i)).toBeNull();
		// Chat never grounds itself in partially failed data.
		expect(pageChatContext.current).toBeNull();
		consoleError.mockRestore();
	});

	it('shows immediate loading feedback before deferred analytics modules mount', async () => {
		const trendModule = deferred<Awaited<ReturnType<typeof buildPublicTrendModule>>>();
		loadPublicTrendAnalyticsModule.mockReturnValueOnce(trendModule.promise);

		render(AnalyticsPage, { data: createData() });

		await waitFor(() => {
			expect(screen.getByText('Loading market visuals')).toBeTruthy();
		});
		expect(
			screen.getByText(/the overview is ready first\. charts are loading next\./i)
		).toBeTruthy();
		expect(screen.getAllByTestId('analytics-loading-panel').length).toBeGreaterThanOrEqual(1);

		trendModule.resolve(await buildPublicTrendModule());

		await waitFor(() => {
			expect(screen.queryByText('Loading market visuals')).toBeNull();
		});

		expect(screen.getAllByTestId('analytics-stub')).toHaveLength(1);
	});

	it('keeps logged-out viewers on a compact public analytics surface', async () => {
		const view = render(AnalyticsPage, { data: createData() });

		await waitFor(() => {
			expect(screen.getAllByTestId('analytics-stub')).toHaveLength(1);
		});

		expect(loadPublicTrendAnalyticsModule).toHaveBeenCalledTimes(1);
		expect(loadPublicAnalyticsModules).not.toHaveBeenCalled();
		expect(screen.getByText('Unlock the full market map.')).toBeTruthy();
		expect(screen.queryByText('The supplier layer runs deeper.')).toBeNull();
		expect(screen.queryByText('Processing mix')).toBeNull();

		await view.rerender({ data: createData({ session: createSession() }) });

		await waitFor(() => {
			expect(screen.getAllByTestId('analytics-stub')).toHaveLength(3);
		});

		expect(loadPublicAnalyticsModules).toHaveBeenCalledTimes(1);
		expect(loadMemberAnalyticsModules).not.toHaveBeenCalled();
		expect(screen.getByText('The supplier layer runs deeper.')).toBeTruthy();
	});

	it('does not block anonymous trend chart rendering on hidden public chart chunks', async () => {
		loadPublicTrendAnalyticsModule.mockResolvedValueOnce(await buildPublicTrendModule());
		loadPublicAnalyticsModules.mockRejectedValueOnce(new Error('hidden chunk failed'));

		render(AnalyticsPage, { data: createData() });

		await waitFor(() => {
			expect(screen.getAllByTestId('analytics-stub')).toHaveLength(1);
		});

		expect(loadPublicTrendAnalyticsModule).toHaveBeenCalledTimes(1);
		expect(loadPublicAnalyticsModules).not.toHaveBeenCalled();
		expect(
			screen.queryByText("We couldn't load the overview charts right now. Please retry.")
		).toBeNull();
	});

	it('loads the Parchment Intelligence chart when a viewer upgrades on the same route', async () => {
		const view = render(AnalyticsPage, {
			data: createData({ session: createSession(), isParchmentIntelligence: false })
		});

		await waitFor(() => {
			expect(screen.getAllByTestId('analytics-stub')).toHaveLength(3);
		});
		expect(loadMemberAnalyticsModules).not.toHaveBeenCalled();

		await view.rerender({
			data: createData({ session: createSession(), isParchmentIntelligence: true })
		});

		await waitFor(() => {
			expect(loadMemberAnalyticsModules).toHaveBeenCalledTimes(1);
			expect(loadSupplierAnalyticsModules).toHaveBeenCalledTimes(1);
			expect(screen.getAllByTestId('analytics-stub')).toHaveLength(6);
		});
	});

	it('shows an actionable error state when deferred imports fail', async () => {
		loadPublicTrendAnalyticsModule.mockRejectedValueOnce(new Error('chunk load failed'));

		render(AnalyticsPage, { data: createData() });

		await waitFor(() => {
			expect(
				screen.getAllByText("We couldn't load the overview charts right now. Please retry.")
			).toHaveLength(1);
		});

		expect(screen.queryByTestId('analytics-loading-panel')).toBeNull();
		expect(screen.getAllByTestId('analytics-error-panel').length).toBeGreaterThanOrEqual(1);
		expect(screen.getAllByRole('button', { name: 'Retry loading' }).length).toBeGreaterThanOrEqual(
			1
		);
	});
});

describe('analytics command center hierarchy', () => {
	it('places market read, controls, KPI strip, and insight cards before chart evidence', async () => {
		const { container } = render(AnalyticsPage, { data: createData() });

		await waitFor(() => {
			expect(screen.getAllByTestId('analytics-stub')).toHaveLength(1);
		});

		expect(screen.getByRole('heading', { name: 'Parchment Market Index' })).toBeTruthy();
		expect(screen.getByText('Market read')).toBeTruthy();
		expect(screen.getByText('Scope controls')).toBeTruthy();
		expect(screen.getByText('Price movement')).toBeTruthy();
		expect(screen.getByText('Availability read')).toBeTruthy();

		const marketRead = container.querySelector('[aria-labelledby="market-read-heading"]');
		const scopeControls = container.querySelector('[aria-label="Scope controls"]');
		const sectionNav = container.querySelector('[aria-label="Market Index sections"]');
		const kpiStrip = container.querySelector('[aria-label="Market KPI strip"]');
		const insightCards = container.querySelector('[aria-label="Market insight cards"]');
		const evidenceCharts = container.querySelector('[aria-label="Evidence charts"]');

		expect(marketRead).toBeTruthy();
		expect(scopeControls).toBeTruthy();
		expect(sectionNav).toBeTruthy();
		expect(kpiStrip).toBeTruthy();
		expect(insightCards).toBeTruthy();
		expect(evidenceCharts).toBeTruthy();
		expect(screen.getByRole('link', { name: 'Read' })).toHaveAttribute('href', '#market-read');
		expect(screen.getByRole('link', { name: 'Signals' })).toHaveAttribute('href', '#today-signals');
		expect(screen.getByRole('link', { name: 'Market Index' })).toHaveAttribute(
			'href',
			'#market-index'
		);
		expect(screen.queryByRole('link', { name: 'Disclosure Index' })).toBeNull();

		const sectionLinks = within(sectionNav as HTMLElement)
			.getAllByRole('link')
			.map((link) => link.getAttribute('href'))
			.filter((href): href is string => Boolean(href?.startsWith('#')));
		for (const href of sectionLinks) {
			expect(container.querySelector(href)).toBeTruthy();
		}

		expect(
			marketRead!.compareDocumentPosition(scopeControls!) & Node.DOCUMENT_POSITION_FOLLOWING
		).toBeTruthy();
		expect(
			scopeControls!.compareDocumentPosition(sectionNav!) & Node.DOCUMENT_POSITION_FOLLOWING
		).toBeTruthy();
		expect(
			sectionNav!.compareDocumentPosition(kpiStrip!) & Node.DOCUMENT_POSITION_FOLLOWING
		).toBeTruthy();
		expect(
			kpiStrip!.compareDocumentPosition(insightCards!) & Node.DOCUMENT_POSITION_FOLLOWING
		).toBeTruthy();
		expect(
			insightCards!.compareDocumentPosition(evidenceCharts!) & Node.DOCUMENT_POSITION_FOLLOWING
		).toBeTruthy();
		expect(
			evidenceCharts!.compareDocumentPosition(screen.getByText('Unlock the full market map.')) &
				Node.DOCUMENT_POSITION_FOLLOWING
		).toBeTruthy();
	});

	it('labels all-scope price posture as combined retail and wholesale', async () => {
		render(AnalyticsPage, { data: createData() });

		await waitFor(() => {
			expect(screen.getAllByTestId('analytics-stub')).toHaveLength(1);
		});

		await screen.getByRole('button', { name: 'All' }).click();

		expect(screen.getByText(/The latest combined retail \+ wholesale average is/i)).toBeTruthy();
	});

	it('labels public value-signal counts as all-market in every scope', async () => {
		render(AnalyticsPage, {
			data: createData({
				marketInsights: {
					valueSignals: null,
					signalsSummary: {
						total: 5,
						byType: { price_drop: 2, below_market: 3, value_quality: 0 },
						asOf: '2026-07-06',
						market: 'all'
					},
					signalsAsOf: '2026-07-06',
					moveStats: null,
					metadataProcessSeries: null,
					metadataDisclosureSeries: null,
					metadataPurveyorScoreSeries: null,
					metadataPurveyorScoreConfidenceSeries: null,
					metadataPurveyorScoreTierSeries: null
				}
			})
		});

		await waitFor(() => {
			expect(screen.getAllByTestId('analytics-stub')).toHaveLength(1);
		});

		await screen.getByRole('button', { name: 'Wholesale' }).click();

		// The public summary is the unfiltered (retail + wholesale) count slice, so
		// it must never present itself as retail data.
		expect(screen.getByText(/5 all-market buy signals are active/i)).toBeTruthy();
		expect(
			screen.getByText(/All-market count shown while the wholesale scope is selected/i)
		).toBeTruthy();
	});

	it('hides selected-lot actions when the selected scope has no value signals', async () => {
		render(AnalyticsPage, {
			data: createData({
				session: createSession(),
				isParchmentIntelligence: true,
				marketInsights: {
					valueSignals: [
						{
							signalType: 'below_market',
							signalWindow: '7d',
							catalogId: 11,
							name: 'Ethiopia Test Lot',
							source: 'Atlas',
							market: 'retail',
							origin: 'Ethiopia',
							process: 'Natural',
							currentPriceLb: 4.25,
							catalogUrl: 'https://example.com/catalog?id=11',
							scoreValue: null,
							evidence: {
								segment: { origin: 'Ethiopia', process: 'Natural', market: 'retail' },
								discount_vs_median_pct: -12.2,
								segment_median: 4.85,
								price_percentile_in_segment: 18
							}
						}
					],
					signalsSummary: null,
					signalsAsOf: '2026-07-06',
					moveStats: null,
					metadataProcessSeries: null,
					metadataDisclosureSeries: null,
					metadataPurveyorScoreSeries: null,
					metadataPurveyorScoreConfidenceSeries: null,
					metadataPurveyorScoreTierSeries: null
				}
			})
		});

		await waitFor(() => {
			expect(screen.getAllByTestId('analytics-stub')).toHaveLength(6);
		});

		expect(screen.getByRole('link', { name: /View in the catalog/ })).toHaveAttribute(
			'href',
			'/catalog?coffee=11'
		);

		await screen.getByRole('button', { name: 'Wholesale' }).click();

		expect(screen.getByText(/No strong wholesale buy signals this morning/i)).toBeTruthy();
		expect(screen.queryByText('View the selected coffee in the catalog.')).toBeNull();
	});

	it('opens value-signal lot details in the local CoffeeCard drawer when catalog data is attached', async () => {
		render(AnalyticsPage, {
			data: createData({
				session: createSession(),
				isParchmentIntelligence: true,
				marketInsights: {
					valueSignals: [
						{
							signalType: 'below_market',
							signalWindow: '7d',
							catalogId: 11,
							name: 'Ethiopia Test Lot',
							source: 'Atlas',
							market: 'retail',
							origin: 'Ethiopia',
							process: 'Natural',
							currentPriceLb: 4.25,
							catalogUrl: 'https://example.com/catalog?id=11',
							scoreValue: null,
							coffee: {
								id: 11,
								name: 'Ethiopia Test Lot',
								source: 'Atlas',
								country: 'Ethiopia',
								continent: 'Africa',
								region: 'Guji',
								processing: 'Natural',
								stocked: true,
								stocked_date: '2026-07-06',
								arrival_date: null,
								last_updated: '2026-07-06',
								wholesale: false,
								cost_lb: 4.25,
								price_per_lb: 4.25,
								price_tiers: null,
								ai_tasting_notes: null,
								ai_description: null,
								link: 'https://supplier.example/coffee/11',
								purveyor_score: 82,
								purveyor_score_confidence: 0.76,
								purveyor_score_tier: 'Strong',
								purveyor_score_factors: null,
								purveyor_score_version: 'purveyor-score-v1'
							},
							evidence: {
								segment: { origin: 'Ethiopia', process: 'Natural', market: 'retail' },
								discount_vs_median_pct: -12.2,
								segment_median: 4.85,
								price_percentile_in_segment: 18
							}
						}
					],
					signalsSummary: null,
					signalsAsOf: '2026-07-06',
					moveStats: null,
					metadataProcessSeries: null,
					metadataDisclosureSeries: null,
					metadataPurveyorScoreSeries: null,
					metadataPurveyorScoreConfidenceSeries: null,
					metadataPurveyorScoreTierSeries: null
				}
			})
		});

		await waitFor(() => {
			expect(screen.getAllByTestId('analytics-stub')).toHaveLength(6);
		});

		expect(screen.queryByRole('link', { name: /View in the catalog/ })).toBeNull();
		await screen.getByRole('button', { name: 'View details for Ethiopia Test Lot' }).click();

		expect(screen.getByRole('heading', { level: 2, name: 'Ethiopia Test Lot' })).toBeTruthy();
		expect(screen.getAllByText(/Below market:/).length).toBeGreaterThanOrEqual(2);
	});

	it('scopes coverage supplier-evidence reads with the selected market', async () => {
		const baseSnapshot = createBaseline().snapshots[0];
		render(AnalyticsPage, {
			data: createData({
				session: createSession(),
				snapshots: [
					baseSnapshot,
					{
						...baseSnapshot,
						origin: 'Ethiopia',
						supplier_count: 2,
						sample_size: 3
					},
					{ ...createBaseline().snapshots[1] }
				]
			})
		});

		await waitFor(() => {
			expect(screen.getAllByTestId('analytics-stub')).toHaveLength(3);
		});

		// Retail scope: Ethiopia rests on 2 suppliers, so coverage flags it as thin evidence.
		expect(screen.getByText(/1 of 2 retail origins rest on fewer than 3 suppliers/i)).toBeTruthy();
		expect(screen.getByText(/Treat medians for Ethiopia/i)).toBeTruthy();

		await screen.getByRole('button', { name: 'Wholesale' }).click();

		// Wholesale scope: only Colombia (3 suppliers) is indexed, so coverage is comparison-grade.
		expect(screen.getByText(/All 1 wholesale origins have 3\+ supplier coverage/i)).toBeTruthy();
		expect(screen.queryByText(/Treat medians for Ethiopia/i)).toBeNull();
	});

	it('surfaces watchlist signals scoped to the selected market', async () => {
		render(AnalyticsPage, {
			data: createData({
				session: createSession(),
				trackedLots: [
					{
						catalogId: 1,
						trackedAt: '2026-04-01T00:00:00Z',
						priceAtTracking: 4.0,
						name: 'Tracked Retail Lot',
						source: 'Cafe Imports',
						country: 'Colombia',
						region: null,
						processing: 'Washed',
						stocked: false,
						wholesale: false,
						unstockedDate: '2026-04-05',
						currentPrice: 4.5,
						priceDelta: 0.5
					},
					{
						catalogId: 2,
						trackedAt: '2026-04-02T00:00:00Z',
						priceAtTracking: null,
						name: 'Tracked Wholesale Lot',
						source: 'Crown Jewels',
						country: 'Ethiopia',
						region: null,
						processing: 'Natural',
						stocked: true,
						wholesale: true,
						unstockedDate: null,
						currentPrice: 3.9,
						priceDelta: null
					}
				]
			})
		});

		await waitFor(() => {
			expect(screen.getAllByTestId('analytics-stub')).toHaveLength(3);
		});

		// Retail scope shows only the retail tracked lot, including its delisting alert.
		expect(screen.getByLabelText('Watchlist signals')).toBeTruthy();
		expect(screen.getByText(/1 tracked retail lot · 1 delisted since tracking/i)).toBeTruthy();
		expect(screen.getByText('Tracked Retail Lot')).toBeTruthy();
		expect(screen.queryByText('Tracked Wholesale Lot')).toBeNull();

		await screen.getByRole('button', { name: 'Wholesale' }).click();

		expect(screen.getByText('Tracked Wholesale Lot')).toBeTruthy();
		expect(screen.queryByText('Tracked Retail Lot')).toBeNull();
	});
});

describe('analytics section navigator', () => {
	it('keeps section jumps and chat passthrough compact in the sticky navigator', async () => {
		render(AnalyticsPage, { data: createData() });

		await waitFor(() => {
			expect(screen.getAllByTestId('analytics-stub')).toHaveLength(1);
		});

		expect(screen.getByRole('navigation', { name: 'Market Index sections' })).toBeTruthy();
		expect(screen.getByRole('link', { name: 'Sign in to ask' })).toHaveAttribute('href', '/auth');
		expect(screen.queryByText(/opens with your current scope and movement window/i)).toBeNull();
		expect(screen.queryByText('Open catalog evidence')).toBeNull();
		expect(screen.queryByText('Compare supplier evidence')).toBeNull();
		expect(screen.queryByText('Review machine access')).toBeNull();
		expect(screen.queryByText('Watch this scope')).toBeNull();
		expect(screen.queryByRole('link', { name: 'Open catalog' })).toBeNull();
		expect(screen.queryByRole('link', { name: 'Review API plans' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Watchlists not live' })).toBeNull();
	});

	it('includes bounded analytics context in the chat CTA prompt for entitled users', async () => {
		render(AnalyticsPage, {
			data: createData({ session: createSession(), role: 'viewer', isParchmentIntelligence: true })
		});

		await waitFor(() => {
			expect(screen.getAllByTestId('analytics-stub')).toHaveLength(6);
		});

		const chatLink = screen.getByRole('link', { name: 'Ask with this context' });
		const url = new URL(chatLink.getAttribute('href') ?? '', 'https://example.com');
		const prompt = url.searchParams.get('prompt');

		expect(url.pathname).toBe('/chat');
		expect(url.searchParams.get('source')).toBe('analytics');
		expect(url.searchParams.has('analyticsContext')).toBe(false);
		expect(prompt).not.toContain('Context JSON:');
		expect(prompt).not.toContain('Entitlement:');
		expect(prompt).toContain('Do not claim that anything has been saved');
		expectPromptLine(prompt, 'Scope: retail');
		expectPromptLine(prompt, 'Movement window: 7d');
		expectPromptLine(prompt, 'Origin: not selected');
		expectPromptLine(prompt, 'Process: not selected');
		expectPromptLine(prompt, 'Supplier: not selected');
		expectPromptLine(prompt, 'Latest index date: 2026-04-08');
		expectPromptLine(prompt, 'Stocked listings: 84');
		expectPromptLine(prompt, 'Suppliers in scope: 3');
		expectPromptLine(prompt, 'Origins in scope: 5');
		expectPromptLine(prompt, 'Access level: Parchment Intelligence');
		expectPromptLine(prompt, 'Visible evidence:');
		expect(prompt).toContain('supplier-comparison');
		expect(screen.queryByRole('link', { name: 'Jump to supplier comparison' })).toBeNull();
	});

	it('allows roasting-only members to ask with analytics context without unlocking supplier comparison', async () => {
		render(AnalyticsPage, {
			data: createData({ session: createSession(), role: 'member', isParchmentIntelligence: false })
		});

		await waitFor(() => {
			expect(screen.getAllByTestId('analytics-stub')).toHaveLength(3);
		});

		const chatLink = screen.getByRole('link', { name: 'Ask with this context' });
		const url = new URL(chatLink.getAttribute('href') ?? '', 'https://example.com');
		const prompt = url.searchParams.get('prompt');

		expect(url.pathname).toBe('/chat');
		expectPromptLine(prompt, 'Access level: Mallard Studio');
		expect(screen.queryByRole('link', { name: 'Upgrade to compare' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Watchlists not live' })).toBeNull();
	});

	it('marks users with both Intelligence and Roasting access as both in chat context', async () => {
		render(AnalyticsPage, {
			data: createData({ session: createSession(), role: 'member', isParchmentIntelligence: true })
		});

		await waitFor(() => {
			expect(screen.getAllByTestId('analytics-stub')).toHaveLength(6);
		});

		const chatLink = screen.getByRole('link', { name: 'Ask with this context' });
		const url = new URL(chatLink.getAttribute('href') ?? '', 'https://example.com');
		const prompt = url.searchParams.get('prompt');

		expectPromptLine(prompt, 'Access level: Parchment Intelligence and Mallard Studio');
		expect(prompt).toContain('supplier-comparison');
	});

	it('uses upgrade language instead of chat context for signed-in viewers without intelligence access', async () => {
		render(AnalyticsPage, { data: createData({ session: createSession(), role: 'viewer' }) });

		await waitFor(() => {
			expect(screen.getAllByTestId('analytics-stub')).toHaveLength(3);
		});

		expect(screen.getByRole('link', { name: 'Upgrade to ask' })).toHaveAttribute(
			'href',
			'/subscription?plan=intelligence-monthly&intent=checkout'
		);
		expect(
			screen.getByRole('link', { name: 'Upgrade to ask from Market Index summary' })
		).toHaveAttribute('href', '/subscription?plan=intelligence-monthly&intent=checkout');
		expect(screen.getAllByText(/Parchment Intelligence/).length).toBeGreaterThanOrEqual(1);
		expect(screen.queryByRole('link', { name: 'Ask with this context' })).toBeNull();
	});
});

describe('analytics premium boundary copy', () => {
	it('keeps arrivals and delistings behind the Parchment Intelligence boundary on the baseline surface', async () => {
		render(AnalyticsPage, { data: createData() });

		await waitFor(() => {
			expect(screen.getAllByTestId('analytics-stub')).toHaveLength(1);
		});

		expect(screen.queryByRole('button', { name: 'Spread' })).toBeNull();
		expect(screen.getByText('Unlock the full market map.')).toBeTruthy();
		expect(screen.getByText(/Supplier price ranges and lot-level previews/i)).toBeTruthy();
		expect(screen.getByText(/Arrivals, delistings, and movement by origin/i)).toBeTruthy();
		expect(screen.queryByText('The supplier layer runs deeper.')).toBeNull();
		expect(screen.queryByRole('link', { name: 'Start Intelligence' })).toBeNull();
		expect(screen.getByRole('link', { name: 'See plans' })).toBeTruthy();
		expect(screen.queryByText('Fresh Ethiopia')).toBeNull();
		expect(screen.queryByText('Recently Gone')).toBeNull();
	});

	it('keeps supplier and movement summaries inside chart descriptions instead of side read panels', async () => {
		render(AnalyticsPage, {
			data: createData({ session: createSession(), isParchmentIntelligence: true })
		});

		await waitFor(() => {
			expect(screen.getAllByTestId('analytics-stub')).toHaveLength(6);
		});

		expect(
			screen.getAllByText((_content, element) =>
				Boolean(
					element?.textContent?.match(
						/Each supplier's price range across public stocked lots in this scope:\s*1 supplier across 1 preview lot/i
					)
				)
			).length
		).toBeGreaterThan(0);
		expect(screen.queryByText('Supplier read')).toBeNull();
		expect(screen.queryByText('Window summary')).toBeNull();
	});

	it('adds Purveyor Score metadata trends to the Disclosure Index for Intelligence users', async () => {
		render(AnalyticsPage, {
			data: createData({
				session: createSession(),
				isParchmentIntelligence: true,
				marketInsights: {
					valueSignals: null,
					signalsSummary: null,
					signalsAsOf: null,
					moveStats: null,
					metadataProcessSeries: null,
					metadataDisclosureSeries: [
						{
							period: '2026-06-01',
							lotCount: 20,
							supplierCount: 4,
							buckets: [{ key: 'structured', share: 0.55, count: 11, supplierCount: 4 }]
						}
					],
					metadataPurveyorScoreSeries: [
						{
							period: '2026-06-01',
							lotCount: 20,
							supplierCount: 4,
							buckets: [
								{ key: 'p25', value: 66, count: 20, supplierCount: 4 },
								{ key: 'p50', value: 78, count: 20, supplierCount: 4 },
								{ key: 'p75', value: 88, count: 20, supplierCount: 4 }
							]
						}
					],
					metadataPurveyorScoreConfidenceSeries: [
						{
							period: '2026-06-01',
							lotCount: 18,
							supplierCount: 4,
							buckets: [
								{ key: 'p25', value: 0.62, count: 18, supplierCount: 4 },
								{ key: 'p50', value: 0.74, count: 18, supplierCount: 4 },
								{ key: 'p75', value: 0.91, count: 18, supplierCount: 4 }
							]
						}
					],
					metadataPurveyorScoreTierSeries: [
						{
							period: '2026-06-01',
							lotCount: 20,
							supplierCount: 4,
							buckets: [
								{ key: 'Strong', share: 0.4, count: 8, supplierCount: 4 },
								{ key: 'Solid', share: 0.35, count: 7, supplierCount: 3 },
								{ key: 'Unscored', share: 0.25, count: 5, supplierCount: 2 }
							]
						}
					]
				}
			})
		});

		await waitFor(() => {
			expect(screen.getAllByTestId('analytics-stub')).toHaveLength(6);
		});

		expect(screen.getByText('Purveyor Score over time')).toBeTruthy();
		expect(screen.getByText('Purveyor Score confidence over time')).toBeTruthy();
		expect(screen.getByText('How is listing quality distributed?')).toBeTruthy();
		expect(screen.getAllByText('Latest median')).toHaveLength(2);
		expect(screen.getByText('78')).toBeTruthy();
		expect(screen.getByText('74%')).toBeTruthy();
	});

	it('restores premium supplier analytics modules instead of static fallback tables', async () => {
		render(AnalyticsPage, {
			data: createData({ session: createSession(), isParchmentIntelligence: true })
		});

		await waitFor(() => {
			expect(loadMemberAnalyticsModules).toHaveBeenCalledTimes(1);
			expect(loadSupplierAnalyticsModules).toHaveBeenCalledTimes(1);
			expect(screen.getAllByTestId('analytics-stub')).toHaveLength(6);
		});
	});

	it('defaults arrivals and delistings to a 7-day window and allows switching back to 30 days', async () => {
		render(AnalyticsPage, {
			data: createData({ session: createSession(), isParchmentIntelligence: true })
		});

		await waitFor(() => {
			expect(screen.getAllByTestId('analytics-stub')).toHaveLength(6);
		});

		expect(screen.getByText('Fresh Ethiopia')).toBeTruthy();
		expect(screen.getByText('Recently Gone')).toBeTruthy();
		expect(screen.queryByText('Older Arrival')).toBeNull();
		expect(screen.queryByText('Older Gone')).toBeNull();

		const thirtyDayButtons = screen.getAllByRole('button', { name: '30d' });
		await thirtyDayButtons[0].click();

		await waitFor(() => {
			expect(screen.getByText('Older Arrival')).toBeTruthy();
			expect(screen.getByText('Older Gone')).toBeTruthy();
		});
	});

	it('uses loaded movement rows instead of exact zero counts when movement counts are unavailable', async () => {
		render(AnalyticsPage, {
			data: createData({
				session: createSession(),
				isParchmentIntelligence: true,
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
				}
			})
		});

		await waitFor(() => {
			expect(screen.getAllByTestId('analytics-stub')).toHaveLength(6);
		});

		expect(screen.getByText('Fresh Ethiopia')).toBeTruthy();
		expect(screen.getByText('Recently Gone')).toBeTruthy();
		// Without reliable window counts the panel opens the loaded rows and makes
		// no "all"/freshness claim.
		expect(
			screen.getAllByRole('button', { name: /Open 2 loaded rows/ }).length
		).toBeGreaterThanOrEqual(1);
		expect(screen.queryByRole('button', { name: /View all [02]/ })).toBeNull();
		expect(screen.getByText(/movement counts are currently unavailable/i)).toBeTruthy();
	});
});
