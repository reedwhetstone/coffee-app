import { render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import AnalyticsPage from './+page.svelte';
import type { PageData } from './$types';

const {
	goto,
	loadPublicAnalyticsModules,
	loadMemberAnalyticsModules,
	loadSupplierAnalyticsModules
} = vi.hoisted(() => ({
	goto: vi.fn(),
	loadPublicAnalyticsModules: vi.fn(),
	loadMemberAnalyticsModules: vi.fn(),
	loadSupplierAnalyticsModules: vi.fn()
}));

vi.mock('$app/navigation', () => ({ goto }));
vi.mock('./deferredModules', () => ({
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

function createData(overrides: Partial<PageData> = {}): PageData {
	return {
		session: null,
		isParchmentIntelligence: false,
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
		role: 'viewer',
		...overrides
	} as unknown as PageData;
}

function createSession() {
	return { user: { id: 'user-1' } } as NonNullable<PageData['session']>;
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-04-09T12:00:00.000Z').getTime());
	loadPublicAnalyticsModules.mockImplementation(buildPublicModules);
	loadMemberAnalyticsModules.mockImplementation(buildMemberModules);
	loadSupplierAnalyticsModules.mockImplementation(buildSupplierModules);
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('analytics page loading experience', () => {
	it('shows immediate loading feedback before deferred analytics modules mount', async () => {
		const publicModules = deferred<Awaited<ReturnType<typeof buildPublicModules>>>();
		loadPublicAnalyticsModules.mockReturnValueOnce(publicModules.promise);

		render(AnalyticsPage, { data: createData() });

		expect(screen.getByText('Loading market visuals')).toBeTruthy();
		expect(
			screen.getByText(/the overview is ready first\. charts are loading next\./i)
		).toBeTruthy();
		expect(screen.getAllByTestId('analytics-loading-panel').length).toBeGreaterThanOrEqual(3);

		publicModules.resolve(await buildPublicModules());

		await waitFor(() => {
			expect(screen.queryByText('Loading market visuals')).toBeNull();
		});

		expect(screen.getAllByTestId('analytics-stub')).toHaveLength(3);
	});

	it('keeps logged-out and signed-in viewers on the same baseline analytics surface', async () => {
		const view = render(AnalyticsPage, { data: createData() });

		await waitFor(() => {
			expect(screen.getAllByTestId('analytics-stub')).toHaveLength(3);
		});

		expect(screen.getByText('Source with the full market in view.')).toBeTruthy();

		await view.rerender({ data: createData({ session: createSession() }) });

		await waitFor(() => {
			expect(screen.getAllByTestId('analytics-stub')).toHaveLength(3);
		});

		expect(loadMemberAnalyticsModules).not.toHaveBeenCalled();
		expect(screen.getByText('Source with the full market in view.')).toBeTruthy();
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
			expect(screen.getAllByTestId('analytics-stub')).toHaveLength(7);
		});
	});

	it('shows an actionable error state when deferred imports fail', async () => {
		loadPublicAnalyticsModules.mockRejectedValueOnce(new Error('chunk load failed'));

		render(AnalyticsPage, { data: createData() });

		await waitFor(() => {
			expect(
				screen.getAllByText("We couldn't load the overview charts right now. Please retry.")
			).toHaveLength(3);
		});

		expect(screen.queryByTestId('analytics-loading-panel')).toBeNull();
		expect(screen.getAllByTestId('analytics-error-panel').length).toBeGreaterThanOrEqual(3);
		expect(screen.getAllByRole('button', { name: 'Retry loading' }).length).toBeGreaterThanOrEqual(
			3
		);
	});
});

describe('analytics command center hierarchy', () => {
	it('places market read, controls, KPI strip, and insight cards before chart evidence', async () => {
		const { container } = render(AnalyticsPage, { data: createData() });

		await waitFor(() => {
			expect(screen.getAllByTestId('analytics-stub')).toHaveLength(3);
		});

		expect(screen.getByRole('heading', { name: 'Parchment Market Index' })).toBeTruthy();
		expect(screen.getByText('Market read')).toBeTruthy();
		expect(screen.getByText('Scope controls')).toBeTruthy();
		expect(screen.getByText('Price movement')).toBeTruthy();
		expect(screen.getByText('Availability read')).toBeTruthy();
		expect(screen.getByText('Next investigation')).toBeTruthy();

		const marketRead = container.querySelector('[aria-labelledby="market-read-heading"]');
		const scopeControls = container.querySelector('[aria-label="Scope controls"]');
		const kpiStrip = container.querySelector('[aria-label="Market KPI strip"]');
		const insightCards = container.querySelector('[aria-label="Market insight cards"]');
		const evidenceCharts = container.querySelector('[aria-label="Evidence charts"]');
		const actionRail = container.querySelector('[aria-label="Action rail"]');

		expect(marketRead).toBeTruthy();
		expect(scopeControls).toBeTruthy();
		expect(kpiStrip).toBeTruthy();
		expect(insightCards).toBeTruthy();
		expect(evidenceCharts).toBeTruthy();
		expect(actionRail).toBeTruthy();

		expect(
			marketRead!.compareDocumentPosition(scopeControls!) & Node.DOCUMENT_POSITION_FOLLOWING
		).toBeTruthy();
		expect(
			scopeControls!.compareDocumentPosition(kpiStrip!) & Node.DOCUMENT_POSITION_FOLLOWING
		).toBeTruthy();
		expect(
			kpiStrip!.compareDocumentPosition(insightCards!) & Node.DOCUMENT_POSITION_FOLLOWING
		).toBeTruthy();
		expect(
			insightCards!.compareDocumentPosition(evidenceCharts!) & Node.DOCUMENT_POSITION_FOLLOWING
		).toBeTruthy();
		expect(
			evidenceCharts!.compareDocumentPosition(actionRail!) & Node.DOCUMENT_POSITION_FOLLOWING
		).toBeTruthy();
		expect(
			actionRail!.compareDocumentPosition(screen.getByText('Supplier Price Comparison')) &
				Node.DOCUMENT_POSITION_FOLLOWING
		).toBeTruthy();
	});

	it('labels all-scope price posture as combined retail and wholesale', async () => {
		render(AnalyticsPage, { data: createData() });

		await waitFor(() => {
			expect(screen.getAllByTestId('analytics-stub')).toHaveLength(3);
		});

		await screen.getByRole('button', { name: 'All' }).click();

		expect(screen.getByText(/The latest combined retail \+ wholesale average is/i)).toBeTruthy();
	});

	it('scopes coverage origin counts with the selected market', async () => {
		render(AnalyticsPage, {
			data: createData({
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
					originsCount: 99,
					lastUpdated: '2026-04-08'
				}
			})
		});

		await waitFor(() => {
			expect(screen.getAllByTestId('analytics-stub')).toHaveLength(3);
		});

		expect(screen.getByText(/84 active retail listings span 5 origins/i)).toBeTruthy();
		expect(screen.getByText(/Evidence: 3 retail suppliers/i)).toBeTruthy();
		expect(screen.queryByText(/span 99 origins/i)).toBeNull();

		await screen.getByRole('button', { name: 'Wholesale' }).click();

		expect(screen.getByText(/18 active wholesale listings span 2 origins/i)).toBeTruthy();
		expect(screen.getByText(/Evidence: 1 wholesale suppliers/i)).toBeTruthy();
		expect(screen.queryByText(/span 99 origins/i)).toBeNull();
	});
});

describe('analytics action CTA rail', () => {
	it('keeps anonymous actions on existing login/API surfaces and disables future watch state', async () => {
		render(AnalyticsPage, { data: createData() });

		await waitFor(() => {
			expect(screen.getAllByTestId('analytics-stub')).toHaveLength(3);
		});

		expect(screen.getByText('Ask about this market read')).toBeTruthy();
		expect(screen.getByRole('link', { name: 'Sign in to ask' })).toHaveAttribute('href', '/auth');
		expect(screen.getByRole('link', { name: 'Sign in to compare' })).toHaveAttribute(
			'href',
			'/auth'
		);
		expect(screen.getByRole('link', { name: 'Open catalog' })).toHaveAttribute('href', '/catalog');
		expect(screen.getByRole('link', { name: 'Review API plans' })).toHaveAttribute('href', '/api');
		expect(screen.getByRole('button', { name: 'Watchlists not live' })).toBeDisabled();
		expect(
			screen.getByText('Preview only. No saved state, alerts, or watch confirmations are created.')
		).toBeTruthy();
	});

	it('serializes bounded analytics context into the chat CTA for entitled users', async () => {
		render(AnalyticsPage, {
			data: createData({ session: createSession(), role: 'viewer', isParchmentIntelligence: true })
		});

		await waitFor(() => {
			expect(screen.getAllByTestId('analytics-stub')).toHaveLength(7);
		});

		const chatLink = screen.getByRole('link', { name: 'Ask with this context' });
		const url = new URL(chatLink.getAttribute('href') ?? '', 'https://example.com');
		const context = JSON.parse(url.searchParams.get('analyticsContext') ?? '{}');

		expect(url.pathname).toBe('/chat');
		expect(url.searchParams.get('source')).toBe('analytics');
		expect(url.searchParams.get('prompt')).toContain('Do not claim that anything has been saved');
		expect(context).toMatchObject({
			origin: null,
			process: null,
			supplier: null,
			viewMode: 'retail',
			timeWindow: '7d',
			entitlement: 'intelligence'
		});
		expect(context.visibleModules).toContain('supplier-comparison');
		expect(screen.getByRole('link', { name: 'Jump to supplier comparison' })).toHaveAttribute(
			'href',
			'#supplier-comparison'
		);
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
		expect(screen.getByText('Intelligence required')).toBeTruthy();
		expect(screen.queryByRole('link', { name: 'Ask with this context' })).toBeNull();
	});
});

describe('analytics premium boundary copy', () => {
	it('keeps arrivals and delistings behind the Parchment Intelligence boundary on the baseline surface', async () => {
		render(AnalyticsPage, { data: createData() });

		await waitFor(() => {
			expect(screen.getAllByTestId('analytics-stub')).toHaveLength(3);
		});

		expect(screen.queryByRole('button', { name: 'Spread' })).toBeNull();
		expect(screen.getByText('Source with the full market in view.')).toBeTruthy();
		expect(
			screen.getByText(
				/supplier comparisons, arrival and delisting feeds, origin benchmarks, and the weekly procurement brief/i
			)
		).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Start Intelligence' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'See free market view' })).toBeTruthy();
		expect(screen.queryByText('Fresh Ethiopia')).toBeNull();
		expect(screen.queryByText('Recently Gone')).toBeNull();
		expect(screen.getAllByText('Parchment Intelligence').length).toBeGreaterThanOrEqual(1);
	});

	it('restores premium supplier analytics modules instead of static fallback tables', async () => {
		render(AnalyticsPage, {
			data: createData({ session: createSession(), isParchmentIntelligence: true })
		});

		await waitFor(() => {
			expect(loadMemberAnalyticsModules).toHaveBeenCalledTimes(1);
			expect(loadSupplierAnalyticsModules).toHaveBeenCalledTimes(1);
			expect(screen.getAllByTestId('analytics-stub')).toHaveLength(7);
		});
	});

	it('defaults arrivals and delistings to a 7-day window and allows switching back to 30 days', async () => {
		render(AnalyticsPage, {
			data: createData({ session: createSession(), isParchmentIntelligence: true })
		});

		await waitFor(() => {
			expect(screen.getAllByTestId('analytics-stub')).toHaveLength(7);
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
			expect(screen.getAllByTestId('analytics-stub')).toHaveLength(7);
		});

		expect(screen.getByText('Fresh Ethiopia')).toBeTruthy();
		expect(screen.getByText('Recently Gone')).toBeTruthy();
		expect(screen.getAllByRole('button', { name: /Open 1 loaded row/ })).toHaveLength(2);
		expect(screen.queryByRole('button', { name: /View all 0/ })).toBeNull();
	});
});
