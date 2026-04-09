import { render, screen, waitFor } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import AnalyticsPage from './+page.svelte';
import type { PageData } from './$types';

const { goto } = vi.hoisted(() => ({
	goto: vi.fn()
}));

vi.mock('$app/navigation', () => ({
	goto
}));

vi.mock(
	'$lib/components/analytics/OriginLineChart.svelte',
	async () => import('./__test-fixtures__/AnalyticsStub.svelte')
);
vi.mock(
	'$lib/components/analytics/OriginBarChart.svelte',
	async () => import('./__test-fixtures__/AnalyticsStub.svelte')
);
vi.mock(
	'$lib/components/analytics/ProcessDonutChart.svelte',
	async () => import('./__test-fixtures__/AnalyticsStub.svelte')
);
vi.mock(
	'$lib/components/analytics/SupplierComparisonTable.svelte',
	async () => import('./__test-fixtures__/AnalyticsStub.svelte')
);
vi.mock(
	'$lib/components/analytics/SupplierHealthTable.svelte',
	async () => import('./__test-fixtures__/AnalyticsStub.svelte')
);
vi.mock(
	'$lib/components/analytics/PriceTierChart.svelte',
	async () => import('./__test-fixtures__/AnalyticsStub.svelte')
);

describe('analytics page loading experience', () => {
	it('shows immediate loading feedback before deferred analytics modules mount', async () => {
		// The component only reads the analytics payload fields below in this test.
		const data = {
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
					price_p25: 4.0,
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
					price_q1: 4.0,
					price_q3: 4.3,
					sample_size: 9
				}
			],
			recentArrivals: [],
			recentDelistings: [],
			comparisonBeans: [],
			supplierHealth: []
		} as unknown as PageData;

		render(AnalyticsPage, { data });

		expect(screen.getByText('Loading live market visuals')).toBeInTheDocument();
		expect(screen.getAllByTestId('analytics-loading-panel').length).toBeGreaterThanOrEqual(3);

		await waitFor(() => {
			expect(screen.queryByText('Loading live market visuals')).not.toBeInTheDocument();
		});

		expect(screen.getAllByTestId('analytics-stub').length).toBeGreaterThanOrEqual(3);
	});
});
