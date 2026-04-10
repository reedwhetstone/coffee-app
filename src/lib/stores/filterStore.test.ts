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

describe('filterStore stocked filters', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-04-10T00:00:00.000Z'));
		vi.restoreAllMocks();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
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
