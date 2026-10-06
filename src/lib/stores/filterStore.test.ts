import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type FilterStoreModule = typeof import('./filterStore');

async function loadFilterStore(): Promise<FilterStoreModule> {
	vi.resetModules();
	return import('./filterStore');
}

/** The URLs a fetch spy was asked for, limited to one endpoint. */
function requestedUrls(fetchSpy: { mock: { calls: unknown[][] } }, prefix: string): string[] {
	return fetchSpy.mock.calls.map((call) => String(call[0])).filter((url) => url.startsWith(prefix));
}

function createCatalogResponse(meta: Record<string, unknown> = {}) {
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
			},
			meta
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

	it('exposes numeric elevation in the catalog filter set', async () => {
		const { filterStore } = await loadFilterStore();

		expect(filterStore.getFilterableColumns('/catalog')).toContain('elevation_masl');
	});

	it('preserves sort state when clearing filters on catalog routes', async () => {
		const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
			const url = input.toString();

			if (url.startsWith('/api/catalog?')) {
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
					wholesaleOnly: false,
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
		expect(state.showWholesale).toBe(true);
		expect(state.wholesaleOnly).toBe(false);
		expect(state.sortField).toBe('score_value');
		expect(state.sortDirection).toBe('asc');
		expect(state.pagination.page).toBe(1);
		expect(fetchSpy).toHaveBeenCalledWith(
			'/api/catalog?page=1&limit=15&sortField=score_value&sortDirection=asc&projection=summary',
			expect.objectContaining({ signal: expect.any(AbortSignal) })
		);
		expect(requestedUrls(fetchSpy, '/api/catalog/filters?')).toEqual([
			'/api/catalog/filters?counts=1'
		]);
	});

	it('fetches catalog refreshes through the first-party BFF and stores upstream notices', async () => {
		const notices = [{ code: 'filter_stripped', message: 'Process filters require a member plan' }];
		const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
			const url = input.toString();

			if (url.startsWith('/api/catalog/filters?')) {
				return new Response(JSON.stringify({}), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				});
			}

			if (url.startsWith('/api/catalog?')) {
				return createCatalogResponse({ notices });
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
		await vi.runOnlyPendingTimersAsync();

		const state = get(filterStore);
		expect(requestedUrls(fetchSpy, '/api/catalog?')).toHaveLength(1);
		expect(state.catalogResponseMeta).toEqual({ notices });
		expect(state.catalogNotices).toEqual(notices);
	});

	it('serializes public process transparency filters with canonical catalog query params', async () => {
		const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
			const url = input.toString();

			if (url.startsWith('/api/catalog?')) {
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

		const rowRequests = requestedUrls(fetchSpy, '/api/catalog?');
		expect(rowRequests).toHaveLength(1);
		const requestUrl = rowRequests[0];
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

			if (url.startsWith('/api/catalog?')) {
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
				wholesaleOnly: false,
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

			if (url.startsWith('/api/catalog?')) {
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
					wholesaleOnly: false,
					pagination: { page: 2, limit: 15 }
				},
				serverData: [{ id: 1, stocked_date: '2026-04-05', wholesale: false }]
			}
		);

		await vi.runAllTimersAsync();
		expect(requestedUrls(fetchSpy, '/api/catalog/filters?')).toEqual([
			'/api/catalog/filters?showWholesale=false&country=Ethiopia&processing_base_method=natural&fermentation_type=anaerobic&has_additives=true&processing_confidence_min=0.8&counts=1'
		]);
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
		expect(fetchSpy).toHaveBeenCalledWith(
			'/api/catalog?page=1&limit=15&showWholesale=false&country=Ethiopia&projection=summary',
			expect.objectContaining({ signal: expect.any(AbortSignal) })
		);
	});

	it('serializes stocked_date and stocked_days as distinct catalog query params', async () => {
		const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
			const url = input.toString();

			if (url.startsWith('/api/catalog?')) {
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

		const rowRequests = requestedUrls(fetchSpy, '/api/catalog?');
		expect(rowRequests).toHaveLength(1);
		const requestUrl = rowRequests[0];
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

function emptyFiltersResponse() {
	return new Response(JSON.stringify({}), {
		status: 200,
		headers: { 'Content-Type': 'application/json' }
	});
}

function createDeferredResponse() {
	let resolve!: (response: Response) => void;
	const promise = new Promise<Response>((res) => {
		resolve = res;
	});
	return { promise, resolve };
}

function catalogDataResponse(
	ids: number[],
	meta: Record<string, unknown> = {},
	total = ids.length
) {
	return new Response(
		JSON.stringify({
			data: ids.map((id) => ({ id, name: `Lot ${id}`, wholesale: false })),
			pagination: {
				page: 1,
				limit: 15,
				total,
				totalPages: 1,
				hasNext: false,
				hasPrev: false
			},
			meta
		}),
		{ status: 200, headers: { 'Content-Type': 'application/json' } }
	);
}

describe('filterStore stale-while-revalidate catalog interactions', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-07-04T00:00:00.000Z'));
		vi.restoreAllMocks();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	function hydratedInit(filterStore: FilterStoreModule['filterStore']) {
		filterStore.initializeForRoute('/catalog', [{ id: 1, wholesale: false }], {
			catalogUrlState: {
				filters: {},
				sortField: null,
				sortDirection: null,
				showWholesale: false,
				wholesaleOnly: false,
				pagination: { page: 1, limit: 15 }
			},
			serverData: [{ id: 1, wholesale: false }],
			pagination: {
				page: 1,
				limit: 15,
				total: 1,
				totalPages: 1,
				hasNext: false,
				hasPrev: false
			}
		});
	}

	it('marks a hydrated fetch as refetching (not first-load) and keeps stale rows visible', async () => {
		const deferred = createDeferredResponse();
		const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
			const url = input.toString();
			if (url.startsWith('/api/catalog/filters?')) return emptyFiltersResponse();
			if (url.startsWith('/api/catalog?')) return deferred.promise;
			throw new Error(`Unexpected fetch: ${url}`);
		});
		vi.stubGlobal('fetch', fetchSpy);

		const { filterStore } = await loadFilterStore();
		hydratedInit(filterStore);
		await vi.runOnlyPendingTimersAsync();
		expect(get(filterStore).hasLoadedOnce).toBe(true);
		fetchSpy.mockClear();

		filterStore.setFilter('name', 'kenya');
		await vi.advanceTimersByTimeAsync(150);

		const pending = get(filterStore);
		expect(pending.isRefetching).toBe(true);
		expect(pending.isLoading).toBe(false);
		expect(pending.serverData.map((row) => row.id)).toEqual([1]);

		deferred.resolve(catalogDataResponse([2]));
		await vi.runOnlyPendingTimersAsync();

		const settled = get(filterStore);
		expect(settled.isRefetching).toBe(false);
		expect(settled.hasLoadedOnce).toBe(true);
		expect(settled.serverData.map((row) => row.id)).toEqual([2]);
	});

	it('shows the first-mount loading state (not refetching) when no rows have loaded yet', async () => {
		const deferred = createDeferredResponse();
		const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
			const url = input.toString();
			if (url.startsWith('/api/catalog/filters?')) return emptyFiltersResponse();
			if (url.startsWith('/api/catalog?')) return deferred.promise;
			throw new Error(`Unexpected fetch: ${url}`);
		});
		vi.stubGlobal('fetch', fetchSpy);

		const { filterStore } = await loadFilterStore();
		// No serverData and empty data => true first mount triggers a fetch.
		filterStore.initializeForRoute('/catalog', []);
		await vi.advanceTimersByTimeAsync(0);
		await vi.advanceTimersByTimeAsync(150);

		const pending = get(filterStore);
		expect(pending.isLoading).toBe(true);
		expect(pending.isRefetching).toBe(false);
		expect(pending.hasLoadedOnce).toBe(false);

		deferred.resolve(catalogDataResponse([5]));
		await vi.runOnlyPendingTimersAsync();

		const settled = get(filterStore);
		expect(settled.isLoading).toBe(false);
		expect(settled.hasLoadedOnce).toBe(true);
	});

	it('ignores a slower earlier response so it cannot overwrite a newer interaction', async () => {
		const deferred: Array<{ resolve: (response: Response) => void }> = [];
		const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
			const url = input.toString();
			if (url.startsWith('/api/catalog/filters?')) return emptyFiltersResponse();
			if (url.startsWith('/api/catalog?')) {
				return new Promise<Response>((resolve) => {
					deferred.push({ resolve });
				});
			}
			throw new Error(`Unexpected fetch: ${url}`);
		});
		vi.stubGlobal('fetch', fetchSpy);

		const { filterStore } = await loadFilterStore();
		hydratedInit(filterStore);
		await vi.runOnlyPendingTimersAsync();
		fetchSpy.mockClear();
		deferred.length = 0;

		filterStore.setFilter('country', ['Ethiopia']);
		await vi.advanceTimersByTimeAsync(150);
		filterStore.setFilter('country', ['Kenya']);
		await vi.advanceTimersByTimeAsync(150);

		expect(deferred).toHaveLength(2);
		const [earlier, later] = deferred;

		// Newer request lands first, then the slower earlier request resolves.
		later.resolve(catalogDataResponse([2], {}, 2));
		await vi.runOnlyPendingTimersAsync();
		earlier.resolve(catalogDataResponse([1], {}, 1));
		await vi.runOnlyPendingTimersAsync();

		const state = get(filterStore);
		expect(state.serverData.map((row) => row.id)).toEqual([2]);
		expect(state.pagination.total).toBe(2);
	});

	it('drops an in-flight response that resolves during the next debounce window', async () => {
		const deferred: Array<{ resolve: (response: Response) => void }> = [];
		const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
			const url = input.toString();
			if (url.startsWith('/api/catalog/filters?')) return emptyFiltersResponse();
			if (url.startsWith('/api/catalog?')) {
				return new Promise<Response>((resolve) => {
					deferred.push({ resolve });
				});
			}
			throw new Error(`Unexpected fetch: ${url}`);
		});
		vi.stubGlobal('fetch', fetchSpy);

		const { filterStore } = await loadFilterStore();
		hydratedInit(filterStore);
		await vi.runOnlyPendingTimersAsync();
		fetchSpy.mockClear();
		deferred.length = 0;

		// First interaction: let the debounce fire so request A is genuinely in flight.
		filterStore.setFilter('country', ['Ethiopia']);
		await vi.advanceTimersByTimeAsync(150);
		expect(deferred).toHaveLength(1);

		// Second interaction while A is still in flight. Scheduling the newer fetch
		// must invalidate A immediately, before the second debounce fires.
		filterStore.setFilter('country', ['Kenya']);

		// A resolves inside the 150ms debounce window of the second interaction.
		// It must be dropped, not applied against the newer filter state.
		deferred[0].resolve(catalogDataResponse([99], {}, 99));
		await vi.advanceTimersByTimeAsync(0);

		const midflight = get(filterStore);
		expect(midflight.serverData.map((row) => row.id)).toEqual([1]);
		expect(midflight.isRefetching).toBe(true);

		// The newer request B fires after its debounce and is the one that lands.
		await vi.advanceTimersByTimeAsync(150);
		expect(deferred).toHaveLength(2);
		deferred[1].resolve(catalogDataResponse([2], {}, 2));
		await vi.runOnlyPendingTimersAsync();

		const settled = get(filterStore);
		expect(settled.serverData.map((row) => row.id)).toEqual([2]);
		expect(settled.pagination.total).toBe(2);
		expect(settled.isRefetching).toBe(false);
	});

	it('says the rows are waiting on a read from the moment a filter changes until it answers', async () => {
		const deferred: Array<{ resolve: (response: Response) => void }> = [];
		const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
			const url = input.toString();
			if (url.startsWith('/api/catalog/filters?')) return emptyFiltersResponse();
			if (url.startsWith('/api/catalog?')) {
				return new Promise<Response>((resolve) => {
					deferred.push({ resolve });
				});
			}
			throw new Error(`Unexpected fetch: ${url}`);
		});
		vi.stubGlobal('fetch', fetchSpy);

		const { filterStore } = await loadFilterStore();
		hydratedInit(filterStore);
		await vi.runOnlyPendingTimersAsync();
		expect(get(filterStore).resultsStatus).toBe('current');

		// Before the debounce fires, so before any request or refetch flag: the
		// rows already belong to the filters before the change.
		filterStore.setFilter('country', ['Ethiopia']);
		expect(get(filterStore).resultsStatus).toBe('pending');
		expect(get(filterStore).isRefetching).toBe(false);
		expect(deferred).toHaveLength(0);

		await vi.advanceTimersByTimeAsync(150);
		expect(deferred).toHaveLength(1);

		// A newer change takes over; the earlier answer does not settle it.
		filterStore.setFilter('country', ['Kenya']);
		deferred[0].resolve(catalogDataResponse([99], {}, 99));
		await vi.advanceTimersByTimeAsync(0);
		expect(get(filterStore).resultsStatus).toBe('pending');

		await vi.advanceTimersByTimeAsync(150);
		deferred[1].resolve(catalogDataResponse([2], {}, 2));
		await vi.runOnlyPendingTimersAsync();
		expect(get(filterStore).resultsStatus).toBe('current');

		// Sorting and paging ask again for the same filters.
		filterStore.setSort('price_per_lb', 'asc');
		expect(get(filterStore).resultsStatus).toBe('pending');
		await vi.advanceTimersByTimeAsync(150);
		deferred[2].resolve(catalogDataResponse([2], {}, 2));
		await vi.runOnlyPendingTimersAsync();
		expect(get(filterStore).resultsStatus).toBe('current');
	});

	it('waits on the first read when the page arrives without rows', async () => {
		const deferred = createDeferredResponse();
		vi.stubGlobal(
			'fetch',
			vi.fn(async (input: RequestInfo | URL) => {
				const url = input.toString();
				if (url.startsWith('/api/catalog/filters?')) return emptyFiltersResponse();
				if (url.startsWith('/api/catalog?')) return deferred.promise;
				throw new Error(`Unexpected fetch: ${url}`);
			})
		);

		const { filterStore } = await loadFilterStore();
		filterStore.initializeForRoute('/catalog', []);
		expect(get(filterStore).resultsStatus).toBe('pending');

		await vi.advanceTimersByTimeAsync(150);
		expect(get(filterStore).resultsStatus).toBe('pending');
		deferred.resolve(catalogDataResponse([2]));
		await vi.runOnlyPendingTimersAsync();
		expect(get(filterStore).resultsStatus).toBe('current');
	});

	it('keeps stale rows visible and clears pending flags when a refetch fails', async () => {
		const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
			const url = input.toString();
			if (url.startsWith('/api/catalog/filters?')) return emptyFiltersResponse();
			if (url.startsWith('/api/catalog?')) {
				return new Response(JSON.stringify({ error: 'boom' }), {
					status: 500,
					headers: { 'Content-Type': 'application/json' }
				});
			}
			throw new Error(`Unexpected fetch: ${url}`);
		});
		vi.stubGlobal('fetch', fetchSpy);
		vi.spyOn(console, 'error').mockImplementation(() => {});

		const { filterStore } = await loadFilterStore();
		hydratedInit(filterStore);
		await vi.runOnlyPendingTimersAsync();
		fetchSpy.mockClear();

		filterStore.setFilter('name', 'kenya');
		await vi.runOnlyPendingTimersAsync();

		const state = get(filterStore);
		expect(state.isRefetching).toBe(false);
		expect(state.isLoading).toBe(false);
		expect(state.serverData.map((row) => row.id)).toEqual([1]);
		// The rows left on screen are not the answer for the filters now selected.
		expect(state.resultsStatus).toBe('failed');
	});

	it('drops a stripped filter from local state after the API reports it stripped', async () => {
		const notices = [
			{
				code: 'filter_stripped',
				deniedParams: ['processing_base_method'],
				message: 'Structured process filters require a member account.'
			}
		];
		const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
			const url = input.toString();
			if (url.startsWith('/api/catalog/filters?')) return emptyFiltersResponse();
			if (url.startsWith('/api/catalog?')) return catalogDataResponse([1], { notices });
			throw new Error(`Unexpected fetch: ${url}`);
		});
		vi.stubGlobal('fetch', fetchSpy);

		const { filterStore } = await loadFilterStore();
		filterStore.initializeForRoute('/catalog', [{ id: 1, wholesale: false }], {
			catalogUrlState: {
				filters: { country: ['Ethiopia'] },
				sortField: null,
				sortDirection: null,
				showWholesale: false,
				wholesaleOnly: false,
				pagination: { page: 1, limit: 15 }
			},
			serverData: [{ id: 1, wholesale: false }],
			pagination: {
				page: 1,
				limit: 15,
				total: 1,
				totalPages: 1,
				hasNext: false,
				hasPrev: false
			}
		});
		await vi.runOnlyPendingTimersAsync();
		fetchSpy.mockClear();

		filterStore.setFilter('processing_base_method', 'natural');
		await vi.runOnlyPendingTimersAsync();

		const state = get(filterStore);
		expect(state.filters).toEqual({ country: ['Ethiopia'] });
		expect(state.catalogNotices).toEqual(notices);
	});

	it('reconciles canonical Parchment denial names back to app filter keys', async () => {
		const notices = [
			{
				code: 'filter_stripped',
				deniedParams: ['pricePerLbMin', 'pricePerLbMax'],
				message: 'Price filters require a member account.'
			}
		];
		const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
			const url = input.toString();
			if (url.startsWith('/api/catalog/filters?')) return emptyFiltersResponse();
			if (url.startsWith('/api/catalog?')) return catalogDataResponse([1], { notices });
			throw new Error(`Unexpected fetch: ${url}`);
		});
		vi.stubGlobal('fetch', fetchSpy);

		const { filterStore } = await loadFilterStore();
		hydratedInit(filterStore);
		await vi.runOnlyPendingTimersAsync();
		filterStore.setFilter('cost_lb', { min: '7', max: '9' });
		await vi.runOnlyPendingTimersAsync();

		expect(get(filterStore).filters).not.toHaveProperty('cost_lb');
	});

	it('clears a stripped advanced sort from local state and the effective URL', async () => {
		const notices = [
			{
				code: 'entitlement_required',
				deniedParams: ['sort'],
				message: 'Advanced sorting requires a member account.'
			}
		];
		const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
			const url = input.toString();
			if (url.startsWith('/api/catalog/filters?')) return emptyFiltersResponse();
			if (url.startsWith('/api/catalog?')) return catalogDataResponse([1], { notices });
			throw new Error(`Unexpected fetch: ${url}`);
		});
		vi.stubGlobal('fetch', fetchSpy);

		const { filterStore } = await loadFilterStore();
		filterStore.initializeForRoute('/catalog', [{ id: 1, wholesale: false }], {
			catalogUrlState: {
				filters: {},
				sortField: 'purveyor_score',
				sortDirection: 'desc',
				showWholesale: false,
				wholesaleOnly: false,
				pagination: { page: 1, limit: 15 }
			},
			serverData: [{ id: 1, wholesale: false }]
		});
		await vi.runOnlyPendingTimersAsync();
		filterStore.setSortDirection('asc');
		await vi.runOnlyPendingTimersAsync();

		const state = get(filterStore);
		expect(state.sortField).toBeNull();
		expect(state.sortDirection).toBeNull();
	});
});

describe('filterStore cup score order', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-10-05T00:00:00.000Z'));
		vi.restoreAllMocks();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	async function sortedByCupScore(
		filters: Record<string, string | string[]>,
		notices: unknown[] = []
	) {
		const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
			const url = input.toString();
			if (url.startsWith('/api/catalog/filters?')) return emptyFiltersResponse();
			if (url.startsWith('/api/catalog?')) return catalogDataResponse([1], { notices });
			throw new Error(`Unexpected fetch: ${url}`);
		});
		vi.stubGlobal('fetch', fetchSpy);

		const { filterStore } = await loadFilterStore();
		filterStore.initializeForRoute('/catalog', [{ id: 1, wholesale: false }], {
			catalogUrlState: {
				filters,
				sortField: 'score_value',
				sortDirection: 'desc',
				showWholesale: true,
				wholesaleOnly: false,
				pagination: { page: 1, limit: 15 }
			},
			serverData: [{ id: 1, wholesale: false }]
		});
		await vi.runOnlyPendingTimersAsync();
		fetchSpy.mockClear();
		return { filterStore, fetchSpy };
	}

	const underProtocol = { country: ['Kenya'], score_protocol: 'sca_2004' };

	it.each([
		[
			'its chip is removed',
			(store: FilterStoreModule['filterStore']) => store.setFilter('score_protocol', '')
		],
		['every filter is cleared', (store: FilterStoreModule['filterStore']) => store.clearFilters()],
		[
			'it changes to a protocol that is not stated',
			(store: FilterStoreModule['filterStore']) =>
				store.setFilters({ score_protocol: 'supplier_unspecified' })
		],
		[
			'it is cleared with other filters',
			(store: FilterStoreModule['filterStore']) =>
				store.clearFiltersByKeys(['score_protocol', 'country'])
		]
	])('returns to the default order when the protocol is left because %s', async (_, leave) => {
		const { filterStore, fetchSpy } = await sortedByCupScore(underProtocol);

		leave(filterStore);
		await vi.runOnlyPendingTimersAsync();

		const state = get(filterStore);
		expect(state.sortField).toBeNull();
		expect(state.sortDirection).toBeNull();
		const requests = requestedUrls(fetchSpy, '/api/catalog?');
		expect(requests).toHaveLength(1);
		expect(requests[0]).not.toContain('sortField');
	});

	it('returns to the default order when the API reports the protocol filter stripped', async () => {
		const { filterStore } = await sortedByCupScore(underProtocol, [
			{
				code: 'entitlement_required',
				deniedParams: ['scoreProtocol'],
				message: 'Grade, elevation, and other detail filters require a member account.'
			}
		]);

		filterStore.setFilter('country', ['Kenya', 'Ethiopia']);
		await vi.runOnlyPendingTimersAsync();

		const state = get(filterStore);
		expect(state.filters).toEqual({ country: ['Kenya', 'Ethiopia'] });
		expect(state.sortField).toBeNull();
		expect(state.sortDirection).toBeNull();
	});

	it('keeps the order while a stated protocol stays selected', async () => {
		const { filterStore, fetchSpy } = await sortedByCupScore(underProtocol);

		filterStore.setFilter('country', []);
		filterStore.setFilter('score_protocol', 'coe');
		await vi.runOnlyPendingTimersAsync();

		expect(get(filterStore).sortField).toBe('score_value');
		expect(requestedUrls(fetchSpy, '/api/catalog?').at(-1)).toContain(
			'sortField=score_value&sortDirection=desc'
		);
	});
});

describe('filterStore catalog filter options', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		window.history.replaceState({}, '', '/catalog');
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	function json(body: unknown) {
		return new Response(JSON.stringify(body), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	async function initCatalog(optionsResponse: (url: string) => Promise<Response> | Response) {
		const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
			const url = input.toString();
			if (url.startsWith('/api/catalog?')) return createCatalogResponse();
			if (url.startsWith('/api/catalog/filters?')) return optionsResponse(url);
			throw new Error(`Unexpected fetch: ${url}`);
		});
		vi.stubGlobal('fetch', fetchSpy);
		const { filterStore } = await loadFilterStore();
		filterStore.initializeForRoute('/catalog', [], { serverData: [] });
		await vi.runAllTimersAsync();
		return { filterStore, fetchSpy };
	}

	it('asks for counts under the active filters, without paging or sort', async () => {
		const { filterStore, fetchSpy } = await initCatalog(() => json({ values: {}, facets: {} }));
		fetchSpy.mockClear();

		filterStore.setSort('price_per_lb', 'asc');
		filterStore.setFilters({
			country: ['Kenya', 'Ethiopia'],
			variety_code: ['bourbon'],
			cost_lb: { min: '8', max: '12' }
		});
		await vi.runOnlyPendingTimersAsync();

		expect(requestedUrls(fetchSpy, '/api/catalog/filters?')).toEqual([
			'/api/catalog/filters?country=Kenya&country=Ethiopia&variety_code=bourbon&price_per_lb_min=8&price_per_lb_max=12&counts=1'
		]);
	});

	it('stores the options, counts and vocabulary and reports them ready', async () => {
		const vocabulary = {
			varieties: [{ code: 'bourbon', label: 'Bourbon', parent_code: null }],
			species: [],
			drying_methods: []
		};
		const { filterStore } = await initCatalog(() =>
			json({
				values: { countries: ['Kenya'] },
				facets: { countries: [{ value: 'Kenya', count: 85 }] },
				vocabulary,
				unstandardizedVarietyCount: 12
			})
		);

		const state = get(filterStore);
		expect(state.optionsStatus).toBe('ready');
		expect(state.uniqueValues).toEqual({ countries: ['Kenya'] });
		expect(state.facetCounts).toEqual({ countries: [{ value: 'Kenya', count: 85 }] });
		expect(state.vocabulary).toEqual(vocabulary);
		expect(state.unstandardizedVarietyCount).toBe(12);
	});

	it('keeps the last options and reports them unavailable when the read fails', async () => {
		let fail = false;
		const { filterStore } = await initCatalog(() =>
			fail
				? new Response('{}', { status: 500 })
				: json({ values: {}, facets: { countries: [{ value: 'Kenya', count: 85 }] } })
		);
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

		fail = true;
		filterStore.setFilter('name', 'gesha');
		expect(get(filterStore).optionsStatus).toBe('loading');
		await vi.runOnlyPendingTimersAsync();

		const state = get(filterStore);
		expect(state.optionsStatus).toBe('unavailable');
		expect(state.facetCounts.countries).toEqual([{ value: 'Kenya', count: 85 }]);
		consoleError.mockRestore();
	});

	it('ignores a slower earlier options response', async () => {
		const pending: Array<(response: Response) => void> = [];
		const { filterStore } = await initCatalog((url) =>
			url.includes('name=')
				? new Promise<Response>((resolve) => pending.push(resolve))
				: json({ values: {}, facets: {} })
		);

		filterStore.setFilter('name', 'first');
		await vi.runOnlyPendingTimersAsync();
		filterStore.setFilter('name', 'second');
		await vi.runOnlyPendingTimersAsync();
		expect(pending).toHaveLength(2);

		pending[1](json({ values: {}, facets: { countries: [{ value: 'Second', count: 2 }] } }));
		await vi.runOnlyPendingTimersAsync();
		pending[0](json({ values: {}, facets: { countries: [{ value: 'First', count: 1 }] } }));
		await vi.runOnlyPendingTimersAsync();

		expect(get(filterStore).facetCounts.countries).toEqual([{ value: 'Second', count: 2 }]);
	});

	it('maps the supplier scope onto the wholesale parameters', async () => {
		const { filterStore, fetchSpy } = await initCatalog(() => json({ values: {}, facets: {} }));

		fetchSpy.mockClear();
		filterStore.setSupplierScope('hobbyist');
		await vi.runOnlyPendingTimersAsync();
		expect(requestedUrls(fetchSpy, '/api/catalog?')[0]).toContain('showWholesale=false');
		expect(window.location.search).toBe('?showWholesale=false');

		fetchSpy.mockClear();
		filterStore.setSupplierScope('wholesale');
		await vi.runOnlyPendingTimersAsync();
		expect(requestedUrls(fetchSpy, '/api/catalog?')[0]).toContain(
			'showWholesale=true&wholesaleOnly=true'
		);

		filterStore.setSupplierScope('all');
		await vi.runOnlyPendingTimersAsync();
		expect(window.location.search).toBe('');
	});

	it('lists out-of-stock coffees too when asked, and says so in the link', async () => {
		const { filterStore, fetchSpy } = await initCatalog(() => json({ values: {}, facets: {} }));
		fetchSpy.mockClear();

		filterStore.setIncludeUnstocked(true);
		await vi.runOnlyPendingTimersAsync();

		expect(requestedUrls(fetchSpy, '/api/catalog?')[0]).toContain('stocked=all');
		expect(requestedUrls(fetchSpy, '/api/catalog/filters?')[0]).toContain('stocked=all');
		expect(window.location.search).toBe('?stocked=all');

		filterStore.clearFilters();
		await vi.runOnlyPendingTimersAsync();
		expect(get(filterStore).includeUnstocked).toBe(false);
		expect(window.location.search).toBe('');
	});
});
