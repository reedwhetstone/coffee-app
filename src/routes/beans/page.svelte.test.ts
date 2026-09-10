import { filterStore } from '$lib/stores/filterStore';
import { legacyPortfolioPage } from '$lib/server/portfolioPage';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BeansPage from './+page.svelte';
const { page } = vi.hoisted(() => ({
	page: { url: new URL('https://purveyors.io/beans'), data: {} }
}));
vi.mock('$app/state', () => ({ page }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
const auth = {
	isSignedIn: true,
	user: { id: 'owner', email: null },
	role: 'member' as const,
	ppiAccess: true
};
beforeEach(() => {
	page.url = new URL('https://purveyors.io/beans');
	vi.stubGlobal(
		'fetch',
		vi.fn().mockResolvedValue(new Response(JSON.stringify({ trackedLots: [], trackedCatalog: [] })))
	);
});
afterEach(() => vi.unstubAllGlobals());
describe('portfolio streamed purchases and lazy bookmarks', () => {
	it('uses streamed purchases without another browser inventory request and loads bookmarks only on demand', async () => {
		render(BeansPage, { data: { auth, purchases: Promise.resolve({ data: [], error: null }) } });
		await screen.findByRole('tab', { name: 'Bookmarked' });
		expect(fetch).not.toHaveBeenCalled();
		await fireEvent.click(screen.getByRole('tab', { name: 'Bookmarked' }));
		await screen.findByText('No Bookmarked Lots Yet');
		expect(fetch).toHaveBeenCalledWith('/api/beans/watchlist');
		await fireEvent.click(screen.getByRole('tab', { name: 'Purchased' }));
		await fireEvent.click(screen.getByRole('tab', { name: 'Bookmarked (0)' }));
		expect(fetch).toHaveBeenCalledTimes(1);
	});
	it('loads bookmarked deep links without waiting for purchased data', async () => {
		page.url = new URL('https://purveyors.io/beans?tab=bookmarked');
		render(BeansPage, {
			data: { auth, purchases: new Promise<{ data: unknown[]; error: string | null }>(() => {}) }
		});
		await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/beans/watchlist'));
		await screen.findByText('No Bookmarked Lots Yet');
	});
	it('shows a recoverable watchlist failure instead of an empty state', async () => {
		vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 502 }));
		page.url = new URL('https://purveyors.io/beans?tab=bookmarked');
		render(BeansPage, { data: { auth, purchases: Promise.resolve({ data: [], error: null }) } });
		await screen.findByText('Unable to load bookmarked lots. Please try again.');
		expect(screen.queryByText('No Bookmarked Lots Yet')).toBeNull();
		await fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
		await screen.findByText('No Bookmarked Lots Yet');
	});
});

describe('bounded Portfolio navigation', () => {
	const inventory = Array.from({ length: 105 }, (_, id) => ({
		id: id + 1,
		stocked: true,
		purchased_qty_lbs: 10,
		bean_cost: 50,
		tax_ship_cost: 5,
		purchase_date: '2026-01-01',
		coffee_catalog: {
			id: id + 1,
			name: `Portfolio lot ${id + 1}`,
			source: 'Supplier A',
			country: 'Ethiopia'
		},
		roast_profiles: []
	}));
	const query = {
		filters: { stocked: 'TRUE' },
		sortField: 'purchase_date',
		sortDirection: 'desc' as const,
		limit: 50,
		offset: 0
	};
	it('keeps global metrics while paging and sends filter changes back to the first page', async () => {
		const first = legacyPortfolioPage(inventory, query);
		const second = legacyPortfolioPage(inventory, { ...query, offset: 50 });
		vi.mocked(fetch)
			.mockResolvedValueOnce(new Response(JSON.stringify(second)))
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify(
						legacyPortfolioPage(inventory, {
							...query,
							filters: { stocked: 'TRUE', country: 'Kenya' }
						})
					)
				)
			);
		render(BeansPage, { data: { auth, purchases: Promise.resolve({ ...first, error: null }) } });
		await screen.findByText('Page 1 of 3');
		expect(screen.getByText('105 selected coffees')).toBeTruthy();
		expect(fetch).not.toHaveBeenCalled();
		await fireEvent.click(screen.getByRole('button', { name: 'Next' }));
		await screen.findByText('Page 2 of 3');
		expect(
			new URL(String(vi.mocked(fetch).mock.calls[0][0]), 'https://purveyors.io').searchParams.get(
				'offset'
			)
		).toBe('50');
		expect(screen.getByText('105 selected coffees')).toBeTruthy();
		filterStore.setFilter('country', 'Kenya');
		await screen.findByText('No Coffees Match Your Filters');
		const requested = new URL(String(vi.mocked(fetch).mock.calls[1][0]), 'https://purveyors.io');
		expect(requested.searchParams.get('offset')).toBe('0');
		expect(JSON.parse(requested.searchParams.get('filters')!)).toEqual({
			stocked: 'TRUE',
			country: 'Kenya'
		});
		expect(screen.queryByText('No Coffee Beans Yet')).toBeNull();
	});
});
