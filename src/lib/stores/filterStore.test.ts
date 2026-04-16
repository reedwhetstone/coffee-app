import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type FilterStoreModule = typeof import('./filterStore');

async function loadFilterStore(): Promise<FilterStoreModule> {
	vi.resetModules();
	return import('./filterStore');
}

function createCatalogResponse() {
	return new Response(
		JSON.stringify({
			data: [],
			pagination: {
				page: 1,
				limit: 15,
				total: 0,
				totalPages: 0,
				hasNext: false,
				hasPrev: false
			}
		}),
		{
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		}
	);
}

describe('filterStore catalog URL and filter clearing behavior', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-04-10T00:00:00.000Z'));
		vi.restoreAllMocks();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it('preserves sort state when clearing filters on catalog routes', async () => {
		const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
			const url = input.toString();

			if (url.startsWith('/v1/catalog')) {
				return createCatalogResponse();
			}

			if (url.startsWith('/api/catalog/filters?')) {
				return new Response(JSON.stringify({}), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				});
			}

			throw new Error(`Unexpected fetch: ${url}`);
		});
		vi.stubGlobal('fetch', fetchSpy);

		const { filterStore } = await loadFilterStore();
		filterStore.initializeForRoute(
			'/catalog',
			[{ id: 1, stocked_date: '2026-04-05', wholesale: false }],
			{
				catalogUrlState: {
					filters: { country: ['Ethiopia'], processing: 'Washed' },
					sortField: 'score_value',
					sortDirection: 'asc',
					showWholesale: true,
					pagination: { page: 2, limit: 15 }
				},
				serverData: [{ id: 1, stocked_date: '2026-04-05', wholesale: false }],
				pagination: {
					page: 2,
					limit: 15,
					total: 20,
					totalPages: 2,
					hasNext: false,
					hasPrev: true
				}
			}
		);

		await vi.runOnlyPendingTimersAsync();
		fetchSpy.mockClear();

		filterStore.clearFilters();
		await vi.runOnlyPendingTimersAsync();

		const state = get(filterStore);
		expect(state.filters).toEqual({});
		expect(state.showWholesale).toBe(false);
		expect(state.sortField).toBe('score_value');
		expect(state.sortDirection).toBe('asc');
		expect(state.pagination.page).toBe(1);
		expect(fetchSpy).toHaveBeenNthCalledWith(1, '/api/catalog/filters?');
		expect(fetchSpy).toHaveBeenNthCalledWith(
			2,
			'/v1/catalog?page=1&limit=15&sortField=score_value&sortDirection=asc'
		);
	});
});
