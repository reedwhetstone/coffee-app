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

const GRADES = {
	data: [
		{
			code: 'KE:AA',
			system: 'KE',
			label: 'Kenya AA',
			description: "Kenya's largest standard screen grade.",
			dimensions: ['size'],
			sort_order: 100,
			active: true
		},
		{
			code: 'ET:G1',
			system: 'ET',
			label: 'Ethiopia Grade 1',
			description: 'Ethiopia grade 1.',
			dimensions: ['defects', 'cup'],
			sort_order: 200,
			active: true
		},
		{
			code: 'OLD:X',
			system: 'OLD',
			label: 'Retired grade',
			description: 'No longer assigned.',
			dimensions: ['size'],
			sort_order: 900,
			active: false
		}
	]
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
	const grades = vi.fn(async () => ({ data: GRADES, error: null }));
	const client = { catalog: { facets, list, taxonomies, grades } } as unknown as ParchmentClient;
	return { client, facets, list, taxonomies, grades };
}

const url = (search: string) => new URL(`https://app.test/api/catalog/filters?counts=1&${search}`);
const freeAccount = {
	canUseProcessFacets: false,
	canUseAdvancedFilters: false,
	canUsePriceScoreRanges: false
};
// One capability at a time, so each case is about one set of reads.
const member = { ...freeAccount, canUseProcessFacets: true };
const gradingMember = {
	...freeAccount,
	canUseAdvancedFilters: true,
	canUsePriceScoreRanges: true
};
const fullMember = { ...gradingMember, canUseProcessFacets: true };

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

	describe('grade and quality', () => {
		const gradingFacets = {
			values: {},
			facets: {
				countries: [{ value: 'Kenya', count: 85 }],
				grade_size: [{ value: 'KE:AA', count: 39 }],
				grade_defects: [{ value: 'ET:G1', count: 84 }],
				grade_cup: [{ value: 'ET:G1', count: 84 }],
				screen_size_min: [{ value: '17', count: 32 }],
				elevation_band: [{ value: '1800-1999', count: 288 }]
			}
		};

		it('reads nothing about grades for a caller who may not filter on them', async () => {
			const { client, facets, grades, list } = makeClient({ facets: () => gradingFacets });

			const result = await loadCatalogFilterOptions(
				client,
				url('grade_code=KE:AA&screen_min=15'),
				freeAccount
			);

			expect(facets).toHaveBeenCalledTimes(1);
			expect(facets).toHaveBeenCalledWith(
				expect.not.objectContaining({ include: expect.anything() })
			);
			expect(grades).not.toHaveBeenCalled();
			expect(list).not.toHaveBeenCalled();
			expect(result).not.toHaveProperty('grades');
			for (const facet of ['grade_size', 'grade_cup', 'screen_size_min', 'elevation_band']) {
				expect(result.facets).not.toHaveProperty(facet);
			}
			expect(result.facets).not.toHaveProperty('score_protocols');
		});

		it('adds grade counts, screen sizes, elevation bands and the active grade vocabulary', async () => {
			const { client, facets, grades } = makeClient({ facets: () => gradingFacets });

			const result = await loadCatalogFilterOptions(client, url(''), gradingMember);

			expect(facets).toHaveBeenCalledWith({
				stocked: 'true',
				showWholesale: 'true',
				include: 'grading'
			});
			expect(grades).toHaveBeenCalledTimes(1);
			expect(result.facets.grade_size).toEqual([{ value: 'KE:AA', count: 39 }]);
			expect(result.facets.grade_altitude).toEqual([]);
			expect(result.facets.screen_size_min).toEqual([{ value: '17', count: 32 }]);
			expect(result.facets.elevation_band).toEqual([{ value: '1800-1999', count: 288 }]);
			expect(result.grades).toEqual([
				{
					code: 'KE:AA',
					label: 'Kenya AA',
					description: "Kenya's largest standard screen grade.",
					dimensions: ['size'],
					sort_order: 100
				},
				{
					code: 'ET:G1',
					label: 'Ethiopia Grade 1',
					description: 'Ethiopia grade 1.',
					dimensions: ['defects', 'cup'],
					sort_order: 200
				}
			]);
			expect(result).not.toHaveProperty('vocabulary');
		});

		it('asks for both sets of counts for a caller who may use both', async () => {
			const { client, facets } = makeClient();

			await loadCatalogFilterOptions(client, url(''), fullMember);

			expect(facets).toHaveBeenCalledWith({
				stocked: 'true',
				showWholesale: 'true',
				include: 'taxonomy,grading'
			});
		});

		it('counts every kind of grade with the grade selection removed, in one extra read', async () => {
			const { client, facets } = makeClient({
				facets: (query) =>
					'gradeCode' in query
						? { values: {}, facets: { grade_size: [{ value: 'KE:AA', count: 39 }] } }
						: gradingFacets
			});

			const result = await loadCatalogFilterOptions(
				client,
				url('grade_code=KE:AA&grade_code=ET:G1&name=aa'),
				gradingMember
			);

			expect(facets).toHaveBeenCalledTimes(2);
			expect(facets).toHaveBeenCalledWith({
				stocked: 'true',
				showWholesale: 'true',
				name: 'aa',
				include: 'grading'
			});
			// All five grade groups come from the read without the grade selection.
			expect(result.facets.grade_size).toEqual([{ value: 'KE:AA', count: 39 }]);
			expect(result.facets.grade_cup).toEqual([{ value: 'ET:G1', count: 84 }]);
			expect(result.facets.grade_defects).toEqual([{ value: 'ET:G1', count: 84 }]);
			expect(result.facets.grade_altitude).toEqual([]);
			// Other controls keep the counts under the selection.
			expect(result.facets.countries).toEqual([]);
		});

		it('counts screen sizes and elevation bands with their own range removed', async () => {
			const { client, facets } = makeClient();

			await loadCatalogFilterOptions(
				client,
				url(
					'screen_min=15&screen_max=18&include_unknown_screen=true&elevation_min_masl=1800&elevation_max_masl=1999&include_unknown_elevation=true'
				),
				gradingMember
			);

			const calls = facets.mock.calls.map(([query]) => Object.keys(query).sort().join(','));
			expect(calls).toEqual([
				'elevationMaxMasl,elevationMinMasl,include,includeUnknownElevation,includeUnknownScreen,screenMax,screenMin,showWholesale,stocked',
				'elevationMaxMasl,elevationMinMasl,include,includeUnknownElevation,showWholesale,stocked',
				'include,includeUnknownScreen,screenMax,screenMin,showWholesale,stocked'
			]);
		});

		it('reports one protocol when no score states one, from two totals', async () => {
			const { client, list } = makeClient({ totals: () => 443 });

			const result = await loadCatalogFilterOptions(
				client,
				url('country=Kenya&score_value_min=86&score_protocol=sca_2004'),
				gradingMember
			);

			expect(result.facets.score_protocols).toEqual([
				{ value: 'supplier_unspecified', count: 443 }
			]);
			expect(list).toHaveBeenCalledTimes(2);
			// The score filters themselves are left out, so the counts describe the choice.
			const base = { stocked: 'true', showWholesale: 'true', country: 'Kenya' };
			const page = { page: 1, limit: 1, projection: 'summary' };
			expect(list).toHaveBeenCalledWith({ ...base, scoreValueMin: 0, ...page });
			expect(list).toHaveBeenCalledWith({
				...base,
				scoreProtocol: 'supplier_unspecified',
				...page
			});
		});

		it('counts each stated protocol once some score states one, and lists those first', async () => {
			const totals: Record<string, number> = {
				supplier_unspecified: 400,
				sca_2004: 30,
				q_arabica: 13,
				cva_affective: 0,
				coe: 0
			};
			const { client, list } = makeClient({
				totals: (query) =>
					typeof query.scoreProtocol === 'string' ? totals[query.scoreProtocol] : 443
			});

			const result = await loadCatalogFilterOptions(client, url(''), gradingMember);

			expect(list).toHaveBeenCalledTimes(6);
			expect(result.facets.score_protocols).toEqual([
				{ value: 'sca_2004', count: 30 },
				{ value: 'q_arabica', count: 13 },
				{ value: 'supplier_unspecified', count: 400 }
			]);
		});

		it('offers no protocol when nothing is scored, and none when the totals cannot be read', async () => {
			const unscored = makeClient({ totals: () => 0 });
			expect(
				(await loadCatalogFilterOptions(unscored.client, url(''), gradingMember)).facets
					.score_protocols
			).toEqual([]);

			const failing = makeClient();
			failing.list.mockResolvedValue({ data: undefined, error: { error: {} } } as never);
			expect(
				(await loadCatalogFilterOptions(failing.client, url(''), gradingMember)).facets
			).not.toHaveProperty('score_protocols');
		});

		it('returns the options without grades when the vocabulary cannot be read', async () => {
			const { client, grades } = makeClient({ facets: () => gradingFacets });
			grades.mockRejectedValue(new Error('unavailable'));

			const result = await loadCatalogFilterOptions(client, url(''), gradingMember);

			expect(result).not.toHaveProperty('grades');
			expect(result.facets.grade_size).toEqual([{ value: 'KE:AA', count: 39 }]);
		});
	});
});
