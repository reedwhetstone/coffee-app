import { render, screen, waitFor } from '@testing-library/svelte';
import { describe, expect, it, beforeEach, vi } from 'vitest';
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
				price_min: 3.8,
				price_max: 4.5,
				price_avg: 4.2,
				price_median: 4.1,
				price_q1: 4,
				price_q3: 4.3,
				sample_size: 9
			}
		],
		recentArrivals: [
			{
				name: 'Fresh Ethiopia',
				country: 'Ethiopia',
				processing: 'Natural',
				price_per_lb: 4.8,
				source: 'Cafe Imports',
				stocked_date: '2026-04-07'
			},
			{
				name: 'Older Arrival',
				country: 'Kenya',
				processing: 'Washed',
				price_per_lb: 5.1,
				source: 'Royal Coffee',
				stocked_date: '2026-03-15'
			}
		],
		recentDelistings: [
			{
				name: 'Recently Gone',
				country: 'Guatemala',
				processing: 'Washed',
				price_per_lb: 4.2,
				source: 'Atlas',
				unstocked_date: '2026-04-06'
			},
			{
				name: 'Older Gone',
				country: 'Brazil',
				processing: 'Natural',
				price_per_lb: 3.9,
				source: 'Red Fox',
				unstocked_date: '2026-03-12'
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
		...overrides
	} as unknown as PageData;
}

function createSession() {
	return { user: { id: 'user-1' } } as NonNullable<PageData['session']>;
}

beforeEach(() => {
	vi.clearAllMocks();
	loadPublicAnalyticsModules.mockImplementation(buildPublicModules);
	loadMemberAnalyticsModules.mockImplementation(buildMemberModules);
	loadSupplierAnalyticsModules.mockImplementation(buildSupplierModules);
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

		expect(screen.getByText('Go deeper with Parchment Intelligence')).toBeTruthy();

		await view.rerender({ data: createData({ session: createSession() }) });

		await waitFor(() => {
			expect(screen.getAllByTestId('analytics-stub')).toHaveLength(3);
		});

		expect(loadMemberAnalyticsModules).not.toHaveBeenCalled();
		expect(screen.getByText('Go deeper with Parchment Intelligence')).toBeTruthy();
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

describe('analytics premium boundary copy', () => {
	it('keeps arrivals and delistings behind the Parchment Intelligence boundary on the baseline surface', async () => {
		render(AnalyticsPage, { data: createData() });

		await waitFor(() => {
			expect(screen.getAllByTestId('analytics-stub')).toHaveLength(3);
		});

		expect(screen.queryByRole('button', { name: 'Spread' })).toBeNull();
		expect(screen.getByText('Go deeper with Parchment Intelligence')).toBeTruthy();
		expect(screen.getByText(/the public view gives you the core market picture first\./i)).toBeTruthy();
		expect(
			screen.getByText(
				/upgrade when you need supplier comparisons, supplier health, arrivals, delistings, origin benchmarks, and longer-term trends/i
			)
		).toBeTruthy();
		expect(screen.getByRole('button', { name: 'See plans' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Browse full catalog first' })).toBeTruthy();
		expect(screen.queryByText('Fresh Ethiopia')).toBeNull();
		expect(screen.queryByText('Recently Gone')).toBeNull();
		expect(screen.getAllByText('Parchment Intelligence').length).toBeGreaterThan(1);
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

		expect(screen.queryByText('Fresh Ethiopia')).toBeNull();
		expect(screen.queryByText('Older Arrival')).toBeNull();
		expect(screen.queryByText('Older Gone')).toBeNull();

		const thirtyDayButtons = screen.getAllByRole('button', { name: '30d' });
		await thirtyDayButtons[0].click();

		await waitFor(() => {
			expect(screen.getByText('Fresh Ethiopia')).toBeTruthy();
		});
	});
});
