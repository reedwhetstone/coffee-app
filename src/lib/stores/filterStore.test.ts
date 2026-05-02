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

	it('serializes public process transparency filters with canonical v1 query params', async () => {
		const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
			const url = input.toString();

			if (url.startsWith('/v1/catalog?')) {
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
		filterStore.initializeForRoute('/catalog', [
			{ id: 1, stocked_date: '2026-04-05', wholesale: false }
		]);

		await vi.runOnlyPendingTimersAsync();
		fetchSpy.mockClear();

		filterStore.setFilter('processing_base_method', 'natural');
		filterStore.setFilter('fermentation_type', 'anaerobic');
		filterStore.setFilter('process_additive', 'fruit');
		filterStore.setFilter('has_additives', true);
		filterStore.setFilter('processing_disclosure_level', 'high_detail');
		filterStore.setFilter('processing_confidence_min', '0.8');

		await vi.runOnlyPendingTimersAsync();

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		const requestUrl = fetchSpy.mock.calls[0][0].toString();
		expect(requestUrl).toContain('/v1/catalog?');
		expect(requestUrl).toContain('processing_base_method=natural');
		expect(requestUrl).toContain('fermentation_type=anaerobic');
		expect(requestUrl).toContain('process_additive=fruit');
		expect(requestUrl).toContain('has_additives=true');
		expect(requestUrl).toContain('processing_disclosure_level=high_detail');
		expect(requestUrl).toContain('processing_confidence_min=0.8');
	});

	it('clears process transparency filters without dropping simple catalog filters', async () => {
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
		filterStore.initializeForRoute('/catalog', [], {
			catalogUrlState: {
				filters: {
					country: ['Ethiopia'],
					processing: 'Washed',
					processing_base_method: 'natural',
					fermentation_type: 'anaerobic',
					process_additive: 'fruit',
					has_additives: false,
					processing_disclosure_level: 'high_detail',
					processing_confidence_min: 0.8
				},
				sortField: null,
				sortDirection: null,
				showWholesale: false,
				pagination: { page: 2, limit: 15 }
			},
			serverData: [],
			pagination: {
				page: 2,
				limit: 15,
				total: 20,
				totalPages: 2,
				hasNext: false,
				hasPrev: true
			}
		});

		await vi.runOnlyPendingTimersAsync();
		fetchSpy.mockClear();

		filterStore.clearFiltersByKeys([
			'processing_base_method',
			'fermentation_type',
			'process_additive',
			'has_additives',
			'processing_disclosure_level',
			'processing_confidence_min'
		]);
		await vi.runOnlyPendingTimersAsync();

		const state = get(filterStore);
		expect(state.filters).toEqual({ country: ['Ethiopia'], processing: 'Washed' });
		expect(state.pagination.page).toBe(1);
		const requestUrl = fetchSpy.mock.calls.at(-1)?.[0].toString() ?? '';
		expect(requestUrl).toContain('country=Ethiopia');
		expect(requestUrl).toContain('processing=Washed');
		expect(requestUrl).not.toContain('processing_base_method');
		expect(requestUrl).not.toContain('has_additives');
		expect(requestUrl).not.toContain('processing_confidence_min');
	});

	it('clears process transparency filters without dropping unrelated catalog filters', async () => {
		const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
			const url = input.toString();

			if (url.startsWith('/v1/catalog?')) {
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
					filters: {
						country: ['Ethiopia'],
						processing_base_method: 'natural',
						fermentation_type: 'anaerobic',
						has_additives: true,
						processing_confidence_min: 0.8
					},
					sortField: null,
					sortDirection: null,
					showWholesale: false,
					pagination: { page: 2, limit: 15 }
				},
				serverData: [{ id: 1, stocked_date: '2026-04-05', wholesale: false }]
			}
		);

		await vi.runOnlyPendingTimersAsync();
		fetchSpy.mockClear();

		filterStore.clearFiltersByKeys([
			'processing_base_method',
			'fermentation_type',
			'has_additives',
			'processing_confidence_min'
		]);
		await vi.runOnlyPendingTimersAsync();

		const state = get(filterStore);
		expect(state.filters).toEqual({ country: ['Ethiopia'] });
		expect(state.pagination.page).toBe(1);
		expect(fetchSpy).toHaveBeenNthCalledWith(1, '/v1/catalog?page=1&limit=15&country=Ethiopia');
	});

	it('serializes stocked_date and stocked_days as distinct catalog query params', async () => {
		const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
			const url = input.toString();

			if (url.startsWith('/v1/catalog?')) {
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
		filterStore.initializeForRoute('/catalog', [
			{ id: 1, stocked_date: '2026-04-05', wholesale: false }
		]);

		await vi.runOnlyPendingTimersAsync();
		fetchSpy.mockClear();

		filterStore.setFilter('stocked_date', '2026-03-01');
		filterStore.setFilter('stocked_days', '30');

		await vi.runOnlyPendingTimersAsync();

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		const requestUrl = fetchSpy.mock.calls[0][0].toString();
		expect(requestUrl).toContain('/v1/catalog?');
		expect(requestUrl).toContain('stocked_date=2026-03-01');
		expect(requestUrl).toContain('stocked_days=30');
	});

	it('treats stocked_date as an absolute lower-bound filter in client-side store mode', async () => {
		const { filterStore } = await loadFilterStore();

		filterStore.initializeForRoute('/inventory', [
			{ id: 1, stocked_date: '2026-04-05', wholesale: false },
			{ id: 2, stocked_date: '2026-02-28', wholesale: false },
			{ id: 3, stocked_date: null, wholesale: false }
		]);
		filterStore.setFilter('stocked_date', '2026-03-01');
		await vi.runOnlyPendingTimersAsync();

		expect(get(filterStore).filteredData.map((item) => item.id)).toEqual([1]);
	});

	it('keeps relative last-N-days filtering behind stocked_days in client-side store mode', async () => {
		const { filterStore } = await loadFilterStore();

		filterStore.initializeForRoute('/inventory', [
			{ id: 1, stocked_date: '2026-04-05', wholesale: false },
			{ id: 2, stocked_date: '2026-03-05', wholesale: false },
			{ id: 3, stocked_date: null, wholesale: false }
		]);
		filterStore.setFilter('stocked_days', '30');
		await vi.runOnlyPendingTimersAsync();

		expect(get(filterStore).filteredData.map((item) => item.id)).toEqual([1]);
	});
});
