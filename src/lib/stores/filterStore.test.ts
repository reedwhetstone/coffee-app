import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type FilterStoreModule = typeof import('./filterStore');

async function loadFilterStore(): Promise<FilterStoreModule> {
	vi.resetModules();
	return import('./filterStore');
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
		expect(state.showWholesale).toBe(false);
		expect(state.wholesaleOnly).toBe(false);
		expect(state.sortField).toBe('score_value');
		expect(state.sortDirection).toBe('asc');
		expect(state.pagination.page).toBe(1);
		expect(fetchSpy).toHaveBeenNthCalledWith(1, '/api/catalog/filters?');
		expect(fetchSpy).toHaveBeenNthCalledWith(
			2,
			'/api/catalog?page=1&limit=15&sortField=score_value&sortDirection=asc',
			expect.objectContaining({ signal: expect.any(AbortSignal) })
		);
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
		expect(fetchSpy).toHaveBeenCalledTimes(1);
		expect(fetchSpy.mock.calls[0][0].toString()).toContain('/api/catalog?');
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

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		const requestUrl = fetchSpy.mock.calls[0][0].toString();
		expect(requestUrl).toContain('/api/catalog?');
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
		expect(fetchSpy).toHaveBeenNthCalledWith(
			1,
			'/api/catalog?page=1&limit=15&country=Ethiopia',
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

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		const requestUrl = fetchSpy.mock.calls[0][0].toString();
		expect(requestUrl).toContain('/api/catalog?');
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
