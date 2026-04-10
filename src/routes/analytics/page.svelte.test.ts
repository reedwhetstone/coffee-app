import { render, screen, waitFor } from '@testing-library/svelte';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import AnalyticsPage from './+page.svelte';
import type { PageData } from './$types';

const {
	goto,
	loadPublicAnalyticsModules,
	loadSupplierAnalyticsModules,
	loadMemberAnalyticsModules
} = vi.hoisted(() => ({
	goto: vi.fn(),
	loadPublicAnalyticsModules: vi.fn(),
	loadSupplierAnalyticsModules: vi.fn(),
	loadMemberAnalyticsModules: vi.fn()
}));

vi.mock('$app/navigation', () => ({
	goto
}));

vi.mock('./deferredModules', () => ({
	loadPublicAnalyticsModules,
	loadSupplierAnalyticsModules,
	loadMemberAnalyticsModules
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

async function buildSupplierModules() {
	const component = await loadStubComponent();
	return {
		SupplierComparisonTableComponent: component,
		SupplierHealthTableComponent: component
	};
}

async function buildMemberModules() {
	const component = await loadStubComponent();
	return {
		PriceTierChartComponent: component
	};
}

function createData(overrides: Partial<PageData> = {}): PageData {
	return {
		session: null,
		isPpiMember: false,
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
		recentArrivals: [],
		recentDelistings: [],
		comparisonBeans: [],
		supplierHealth: [{ supplier: 'Atlas Coffee' }],
		...overrides
	} as unknown as PageData;
}

function createSession() {
	return { user: { id: 'user-1' } } as NonNullable<PageData['session']>;
}

beforeEach(async () => {
	vi.clearAllMocks();
	loadPublicAnalyticsModules.mockImplementation(buildPublicModules);
	loadSupplierAnalyticsModules.mockImplementation(buildSupplierModules);
	loadMemberAnalyticsModules.mockImplementation(buildMemberModules);
});

describe('analytics page loading experience', () => {
	it('shows immediate loading feedback before deferred analytics modules mount', async () => {
		const publicModules = deferred<Awaited<ReturnType<typeof buildPublicModules>>>();
		loadPublicAnalyticsModules.mockReturnValueOnce(publicModules.promise);

		render(AnalyticsPage, { data: createData() });

		expect(screen.getByText('Loading live market visuals')).toBeInTheDocument();
		expect(screen.getAllByTestId('analytics-loading-panel').length).toBeGreaterThanOrEqual(3);

		publicModules.resolve(await buildPublicModules());

		await waitFor(() => {
			expect(screen.queryByText('Loading live market visuals')).not.toBeInTheDocument();
		});

		expect(screen.getAllByTestId('analytics-stub')).toHaveLength(3);
	});

	it('loads supplier tables when an anonymous viewer becomes a signed-in member on the same route', async () => {
		const view = render(AnalyticsPage, { data: createData() });

		await waitFor(() => {
			expect(screen.getAllByTestId('analytics-stub')).toHaveLength(3);
		});
		expect(loadSupplierAnalyticsModules).not.toHaveBeenCalled();

		await view.rerender({ data: createData({ session: createSession() }) });

		await waitFor(() => {
			expect(loadSupplierAnalyticsModules).toHaveBeenCalledTimes(1);
			expect(screen.getAllByTestId('analytics-stub')).toHaveLength(5);
		});
	});

	it('loads the PPI chart when a signed-in member upgrades on the same route', async () => {
		const view = render(AnalyticsPage, {
			data: createData({ session: createSession(), isPpiMember: false })
		});

		await waitFor(() => {
			expect(screen.getAllByTestId('analytics-stub')).toHaveLength(5);
		});
		expect(loadMemberAnalyticsModules).not.toHaveBeenCalled();

		await view.rerender({ data: createData({ session: createSession(), isPpiMember: true }) });

		await waitFor(() => {
			expect(loadMemberAnalyticsModules).toHaveBeenCalledTimes(1);
			expect(screen.getAllByTestId('analytics-stub')).toHaveLength(6);
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

		expect(screen.queryByTestId('analytics-loading-panel')).not.toBeInTheDocument();
		expect(screen.getAllByTestId('analytics-error-panel').length).toBeGreaterThanOrEqual(3);
		expect(screen.getAllByRole('button', { name: 'Retry loading' }).length).toBeGreaterThanOrEqual(
			3
		);
	});
});
