import { describe, expect, it, vi } from 'vitest';
import {
	catalogTotalRequest,
	suggestFilterRemovals,
	withoutActiveFilter
} from './emptyStateSuggestions';
import {
	describeActiveCatalogFilters,
	type ActiveCatalogFilter,
	type CatalogFilterSnapshot
} from './filterModel';

const snapshot: CatalogFilterSnapshot = {
	filters: { country: ['Kenya', 'Peru'], peaberry: true, name: 'aa' },
	showWholesale: false,
	wholesaleOnly: false,
	includeUnstocked: true
};
const chips = describeActiveCatalogFilters(snapshot);
const chip = (id: string) => chips.find((entry) => entry.id === id) as ActiveCatalogFilter;
const signal = new AbortController().signal;

describe('withoutActiveFilter', () => {
	it('removes one value of a multi-value filter and keeps the rest', () => {
		expect(withoutActiveFilter(snapshot, chip('country:Kenya'))?.filters).toEqual({
			country: ['Peru'],
			peaberry: true,
			name: 'aa'
		});
	});

	it('drops a single-value filter altogether', () => {
		expect(withoutActiveFilter(snapshot, chip('peaberry'))?.filters).toEqual({
			country: ['Kenya', 'Peru'],
			name: 'aa'
		});
		const last = describeActiveCatalogFilters({ ...snapshot, filters: { country: ['Kenya'] } });
		expect(
			withoutActiveFilter({ ...snapshot, filters: { country: ['Kenya'] } }, last[0])?.filters
		).toEqual({});
	});

	it('widens the supplier scope to all suppliers', () => {
		expect(withoutActiveFilter(snapshot, chip('supplier_scope'))).toMatchObject({
			showWholesale: true,
			wholesaleOnly: false
		});
	});

	it('has nothing to offer for "including out of stock", whose removal only narrows', () => {
		expect(withoutActiveFilter(snapshot, chip('include_unstocked'))).toBeNull();
	});
});

describe('catalogTotalRequest', () => {
	it('asks the listing for one row under the same filters and scopes', () => {
		expect(catalogTotalRequest(snapshot)).toBe(
			'/api/catalog?page=1&limit=1&showWholesale=false&stocked=all&country=Kenya&country=Peru&peaberry=true&name=aa&projection=summary'
		);
	});
});

describe('suggestFilterRemovals', () => {
	it('lists the filters whose removal brings coffees back, most coffees first', async () => {
		const readTotal = vi.fn(async (without: CatalogFilterSnapshot) => {
			if (!('name' in without.filters)) return 85;
			if (!('peaberry' in without.filters)) return 12;
			return 0;
		});

		const suggestions = await suggestFilterRemovals(snapshot, chips, signal, readTotal);

		expect(suggestions.map((entry) => [entry.filter.id, entry.total])).toEqual([
			['name', 85],
			['peaberry', 12]
		]);
		// One read for each chip that could widen the results; the stock chip cannot.
		expect(readTotal).toHaveBeenCalledTimes(chips.length - 1);
	});

	it('skips a filter whose total cannot be read and returns the rest', async () => {
		const readTotal = vi.fn(async (without: CatalogFilterSnapshot) => {
			if (!('name' in without.filters)) throw new Error('offline');
			return !('peaberry' in without.filters) ? 12 : 0;
		});

		const suggestions = await suggestFilterRemovals(snapshot, chips, signal, readTotal);

		expect(suggestions.map((entry) => entry.filter.id)).toEqual(['peaberry']);
	});

	it('returns nothing when no single filter is the cause', async () => {
		expect(await suggestFilterRemovals(snapshot, chips, signal, async () => 0)).toEqual([]);
	});

	it('tries at most eight filters', async () => {
		const many: CatalogFilterSnapshot = {
			...snapshot,
			filters: { country: Array.from({ length: 12 }, (_, index) => `Country ${index}`) }
		};
		const readTotal = vi.fn(async () => 1);

		await suggestFilterRemovals(many, describeActiveCatalogFilters(many), signal, readTotal);

		expect(readTotal).toHaveBeenCalledTimes(8);
	});
});
