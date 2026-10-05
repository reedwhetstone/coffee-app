import { describe, expect, it, vi } from 'vitest';
import type { ParchmentClient } from '@purveyors/sdk';
import { loadCatalogFilterOptions, toCatalogFilterQuery } from './catalogFilterOptions';

type Query = Record<string, unknown>;

const TAXONOMIES = {
	data: {
		varieties: [
			{ code: 'bourbon', label: 'Bourbon', parent_code: null, description: 'A family.' },
			{ code: 'pink_bourbon', label: 'Pink Bourbon', parent_code: 'bourbon', description: '' },
			{ code: 'typica', label: 'Typica', parent_code: null, description: '' }
		],
		species: [{ code: 'arabica', label: 'Arabica', parent_code: null, description: '' }],
		drying_methods: [{ code: 'patio', label: 'Patio', parent_code: null, description: '' }]
	}
};

/** A stand-in client whose facet counts depend on which filters the read carries. */
function makeClient(
	options: { facets?: (query: Query) => unknown; totals?: (query: Query) => number } = {}
) {
	const facets = vi.fn(async (query: Query) => ({
		data: options.facets?.(query) ?? { values: {}, facets: {} },
		error: null
	}));
	const list = vi.fn(async (query: Query) => ({
		data: { data: [], pagination: { total: options.totals?.(query) ?? 0 } },
		error: null
	}));
	const taxonomies = vi.fn(async () => ({ data: TAXONOMIES, error: null }));
	const client = { catalog: { facets, list, taxonomies } } as unknown as ParchmentClient;
	return { client, facets, list, taxonomies };
}

const url = (search: string) => new URL(`https://app.test/api/catalog/filters?counts=1&${search}`);
const freeAccount = { canUseProcessFacets: false };
const member = { canUseProcessFacets: true };

describe('toCatalogFilterQuery', () => {
	it('maps the shareable link params onto Parchment filter params and drops paging, sort and view state', () => {
		expect(
			toCatalogFilterQuery(
				url(
					'page=3&limit=15&sortField=price_per_lb&sortDirection=asc&view=map&map_zoom=4&country=Kenya&country=Ethiopia&price_per_lb_min=8&elevation_min_masl=1500&include_unknown_elevation=true&stocked_days=30&arrival_date=Spot&variety_code=bourbon&cultivar_detail=Caturra&grade=AA'
				)
			)
		).toEqual({
			stocked: 'true',
			showWholesale: 'true',
			country: ['Kenya', 'Ethiopia'],
			pricePerLbMin: '8',
			elevationMinMasl: '1500',
			includeUnknownElevation: 'true',
			stockedDays: '30',
			arrivalDate: 'Spot',
			varietyCode: 'bourbon',
			variety: 'Caturra',
			grade: 'AA'
		});
	});

	it('keeps the supplier scope and stock scope the listing uses', () => {
		expect(toCatalogFilterQuery(url('showWholesale=false'))).toMatchObject({
			stocked: 'true',
			showWholesale: 'false'
		});
		expect(toCatalogFilterQuery(url('showWholesale=false&wholesaleOnly=true'))).toMatchObject({
			showWholesale: 'true',
			wholesaleOnly: 'true'
		});
		expect(toCatalogFilterQuery(url('stocked=all'))).toMatchObject({ stocked: 'all' });
	});
});

describe('loadCatalogFilterOptions', () => {
	it('reads one set of counts under the active filters for a caller without the standardized filters', async () => {
		const { client, facets, list, taxonomies } = makeClient({
			facets: () => ({
				values: { countries: ['Kenya'], regions: ['Nyeri'], grade: ['AA'] },
				facets: {
					countries: [{ value: 'Kenya', count: 85 }],
					regions: [{ value: 'Nyeri', count: 20 }],
					grade: [{ value: 'AA', count: 30 }]
				}
			})
		});

		const result = await loadCatalogFilterOptions(client, url('name=nyeri'), freeAccount);

		expect(facets).toHaveBeenCalledTimes(1);
		expect(facets).toHaveBeenCalledWith({ stocked: 'true', showWholesale: 'true', name: 'nyeri' });
		expect(taxonomies).not.toHaveBeenCalled();
		expect(list).not.toHaveBeenCalled();
		expect(result.vocabulary).toBeUndefined();
		expect(result.facets.countries).toEqual([{ value: 'Kenya', count: 85 }]);
		// Only what the controls read is returned: open-text facets are left out.
		expect(result.facets).not.toHaveProperty('grade');
		expect(result.values).not.toHaveProperty('grade');
		expect(result.facets).not.toHaveProperty('varieties');
	});

	it("counts a control's other options with that control's own filter removed", async () => {
		const { client, facets } = makeClient({
			facets: (query) =>
				'country' in query
					? {
							values: { countries: ['Kenya'], continents: ['Africa'] },
							facets: {
								countries: [{ value: 'Kenya', count: 85 }],
								continents: [{ value: 'Africa', count: 85 }]
							}
						}
					: {
							values: { countries: ['Brazil', 'Kenya'], continents: ['Africa', 'South America'] },
							facets: {
								countries: [
									{ value: 'Brazil', count: 216 },
									{ value: 'Kenya', count: 85 }
								],
								continents: [
									{ value: 'Africa', count: 300 },
									{ value: 'South America', count: 700 }
								]
							}
						}
		});

		const result = await loadCatalogFilterOptions(
			client,
			url('country=Kenya&name=aa'),
			freeAccount
		);

		expect(facets).toHaveBeenCalledTimes(2);
		expect(facets).toHaveBeenCalledWith({
			stocked: 'true',
			showWholesale: 'true',
			country: 'Kenya',
			name: 'aa'
		});
		expect(facets).toHaveBeenCalledWith({ stocked: 'true', showWholesale: 'true', name: 'aa' });
		// Countries come from the read without the country filter; continents keep
		// the counts under it.
		expect(result.facets.countries).toEqual([
			{ value: 'Brazil', count: 216 },
			{ value: 'Kenya', count: 85 }
		]);
		expect(result.values.countries).toEqual(['Brazil', 'Kenya']);
		expect(result.facets.continents).toEqual([{ value: 'Africa', count: 85 }]);
	});

	it("keeps a control's counts under the filters when its extra read fails", async () => {
		const { client, facets } = makeClient();
		facets.mockImplementation(async (query: Query) => {
			if (!('country' in query)) throw new Error('upstream timeout');
			return {
				data: { values: {}, facets: { countries: [{ value: 'Kenya', count: 85 }] } },
				error: null
			};
		});

		const result = await loadCatalogFilterOptions(client, url('country=Kenya'), freeAccount);

		expect(result.facets.countries).toEqual([{ value: 'Kenya', count: 85 }]);
	});

	it('adds the vocabulary and standardized counts for callers who may filter on them', async () => {
		const { client, facets, taxonomies } = makeClient({
			facets: () => ({
				values: { varieties: ['bourbon'], species_codes: ['arabica'], drying_methods: ['patio'] },
				facets: {
					varieties: [{ value: 'bourbon', count: 40 }],
					species_codes: [{ value: 'arabica', count: 900 }],
					drying_methods: [{ value: 'patio', count: 7 }]
				}
			})
		});

		const result = await loadCatalogFilterOptions(client, url('country=Kenya'), member);

		expect(taxonomies).toHaveBeenCalledTimes(1);
		expect(facets).toHaveBeenCalledWith({
			stocked: 'true',
			showWholesale: 'true',
			country: 'Kenya',
			include: 'taxonomy'
		});
		// The country control's extra read does not need the standardized counts.
		expect(facets).toHaveBeenCalledWith({ stocked: 'true', showWholesale: 'true' });
		expect(result.facets.varieties).toEqual([{ value: 'bourbon', count: 40 }]);
		expect(result.vocabulary).toEqual({
			varieties: [
				{ code: 'bourbon', label: 'Bourbon', parent_code: null },
				{ code: 'pink_bourbon', label: 'Pink Bourbon', parent_code: 'bourbon' },
				{ code: 'typica', label: 'Typica', parent_code: null }
			],
			species: [{ code: 'arabica', label: 'Arabica', parent_code: null }],
			drying_methods: [{ code: 'patio', label: 'Patio', parent_code: null }]
		});
	});

	it('counts coffees with no standardized variety from two listing totals, ignoring the variety selection', async () => {
		const { client, list } = makeClient({
			totals: (query) => ('varietyCode' in query ? 60 : 85)
		});

		const result = await loadCatalogFilterOptions(
			client,
			url('country=Kenya&variety_code=pink_bourbon'),
			member
		);

		expect(result.unstandardizedVarietyCount).toBe(25);
		expect(list).toHaveBeenCalledTimes(2);
		const base = { stocked: 'true', showWholesale: 'true', country: 'Kenya' };
		const page = { page: 1, limit: 1, projection: 'summary' };
		expect(list).toHaveBeenCalledWith({ ...base, ...page });
		// Every top-level family, so a coffee carrying any standardized variety matches.
		expect(list).toHaveBeenCalledWith({ ...base, varietyCode: ['bourbon', 'typica'], ...page });
	});

	it('reports the no-standardized-variety count as unknown when a total cannot be read', async () => {
		const { client, list } = makeClient();
		list.mockResolvedValue({ data: undefined, error: { error: { code: 'unavailable' } } } as never);

		const result = await loadCatalogFilterOptions(client, url(''), member);

		expect(result.vocabulary).toBeDefined();
		expect(result.unstandardizedVarietyCount).toBeNull();
	});

	it('returns the options without a vocabulary when the vocabulary cannot be read', async () => {
		const { client, taxonomies, list } = makeClient();
		taxonomies.mockRejectedValue(new Error('unavailable'));

		const result = await loadCatalogFilterOptions(client, url(''), member);

		expect(result).toEqual({ values: expect.any(Object), facets: expect.any(Object) });
		expect(list).not.toHaveBeenCalled();
	});

	it('reads a facet Parchment left out of an empty result as having no options', async () => {
		const { client } = makeClient({ facets: () => ({ values: {}, facets: {} }) });

		const result = await loadCatalogFilterOptions(client, url('name=zzzz'), member);

		expect(result.facets.countries).toEqual([]);
		expect(result.facets.species_codes).toEqual([]);
		expect(result.facets.regions).toEqual([]);
	});

	it('returns only the most common regions, as suggestions', async () => {
		const regions = Array.from({ length: 400 }, (_, index) => ({
			value: `Region ${index}`,
			count: index
		}));
		const { client } = makeClient({ facets: () => ({ values: {}, facets: { regions } }) });

		const result = await loadCatalogFilterOptions(client, url(''), freeAccount);

		expect(result.facets.regions).toHaveLength(150);
		expect(result.facets.regions[0]).toEqual({ value: 'Region 399', count: 399 });
		expect(result.values).not.toHaveProperty('regions');
	});

	it('fails when the counts under the active filters cannot be read', async () => {
		const { client, facets } = makeClient();
		facets.mockResolvedValue({
			data: undefined,
			error: { error: { code: 'invalid_query' } }
		} as never);

		await expect(loadCatalogFilterOptions(client, url(''), freeAccount)).rejects.toThrow(
			'Catalog facets request failed'
		);
	});
});
