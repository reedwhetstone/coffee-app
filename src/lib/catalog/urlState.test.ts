import { describe, expect, it } from 'vitest';
import {
	buildCatalogRequestParams,
	buildCatalogShareParams,
	catalogUrlStateToSearchState,
	createDefaultCatalogUrlState,
	parseCatalogUrlState
} from './urlState';

describe('catalog URL state helpers', () => {
	it('parses canonical catalog query params into route state', () => {
		const url = new URL(
			'https://app.test/catalog?country=Ethiopia&country=Colombia&processing=Washed&processing_base_method=washed&fermentation_type=anaerobic&process_additive=fruit&has_additives=true&processing_disclosure_level=high_detail&processing_confidence_min=0.8&name=guji&price_per_lb_min=7.5&price_per_lb_max=9&page=2&showWholesale=true&wholesaleOnly=true'
		);

		const state = parseCatalogUrlState(url, '/catalog');

		expect(state).toEqual({
			filters: {
				country: ['Ethiopia', 'Colombia'],
				processing: 'Washed',
				processing_base_method: 'washed',
				fermentation_type: 'anaerobic',
				process_additive: 'fruit',
				has_additives: true,
				processing_disclosure_level: 'high_detail',
				processing_confidence_min: 0.8,
				name: 'guji',
				cost_lb: {
					min: '7.5',
					max: '9'
				}
			},
			sortField: null,
			sortDirection: null,
			showWholesale: true,
			wholesaleOnly: true,
			pagination: {
				page: 2,
				limit: 15
			}
		});
	});

	it('omits default values from share URLs while preserving active filters', () => {
		const state = createDefaultCatalogUrlState('/catalog');
		state.filters = {
			country: ['Ethiopia'],
			processing: 'Washed',
			processing_base_method: 'washed',
			fermentation_type: 'anaerobic',
			process_additive: 'fruit',
			has_additives: true,
			processing_disclosure_level: 'high_detail',
			processing_confidence_min: 0.8,
			cost_lb: { min: '7.5', max: '' }
		};

		const params = buildCatalogShareParams(state, '/catalog');

		expect(params.toString()).toBe(
			'country=Ethiopia&processing=Washed&processing_base_method=washed&fermentation_type=anaerobic&process_additive=fruit&has_additives=true&processing_disclosure_level=high_detail&processing_confidence_min=0.8&price_per_lb_min=7.5'
		);
	});

	it('preserves wholesale-only catalog URLs for member-scoped views', () => {
		const state = createDefaultCatalogUrlState('/catalog');
		state.showWholesale = true;
		state.wholesaleOnly = true;

		expect(buildCatalogRequestParams(state, '/catalog').toString()).toBe(
			'page=1&limit=15&showWholesale=true&wholesaleOnly=true'
		);
		expect(buildCatalogShareParams(state, '/catalog').toString()).toBe(
			'showWholesale=true&wholesaleOnly=true'
		);
	});

	it('normalizes contradictory wholesale-only URLs to a wholesale-inclusive scope', () => {
		const state = parseCatalogUrlState(
			new URL('https://app.test/catalog?showWholesale=false&wholesaleOnly=true'),
			'/catalog'
		);

		expect(state.showWholesale).toBe(true);
		expect(state.wholesaleOnly).toBe(true);
		expect(buildCatalogShareParams(state, '/catalog').toString()).toBe(
			'showWholesale=true&wholesaleOnly=true'
		);
	});

	it('defaults to all coffees and preserves the explicit hobbyist-only scope', () => {
		const defaultState = parseCatalogUrlState(new URL('https://app.test/catalog'), '/catalog');
		const hobbyistState = parseCatalogUrlState(
			new URL('https://app.test/catalog?showWholesale=false'),
			'/catalog'
		);

		expect(defaultState.showWholesale).toBe(true);
		expect(hobbyistState.showWholesale).toBe(false);
		expect(buildCatalogShareParams(hobbyistState, '/catalog').toString()).toBe(
			'showWholesale=false'
		);
	});

	it('maps process transparency filters onto shared catalog search options', () => {
		const state = createDefaultCatalogUrlState('/catalog');
		state.filters = {
			processing_base_method: 'natural',
			fermentation_type: 'anaerobic',
			process_additive: 'fruit',
			has_additives: false,
			processing_disclosure_level: 'high_detail',
			processing_confidence_min: '0.8'
		};

		expect(catalogUrlStateToSearchState(state)).toMatchObject({
			processingBaseMethod: 'natural',
			fermentationType: 'anaerobic',
			processAdditive: 'fruit',
			hasAdditives: false,
			processingDisclosureLevel: 'high_detail',
			processingConfidenceMin: 0.8
		});
	});

	it('drops unsupported processing confidence thresholds instead of serializing hidden filters', () => {
		const invalidState = parseCatalogUrlState(
			new URL('https://app.test/catalog?processing_confidence_min=1.5'),
			'/catalog'
		);
		const unsupportedState = parseCatalogUrlState(
			new URL('https://app.test/catalog?processing_confidence_min=0.75'),
			'/catalog'
		);

		expect(invalidState.filters).not.toHaveProperty('processing_confidence_min');
		expect(unsupportedState.filters).not.toHaveProperty('processing_confidence_min');

		const searchState = createDefaultCatalogUrlState('/catalog');
		searchState.filters = { processing_confidence_min: '0.75' };
		expect(catalogUrlStateToSearchState(searchState).processingConfidenceMin).toBeUndefined();
		expect(buildCatalogRequestParams(searchState, '/catalog').toString()).toBe('page=1&limit=15');
	});

	it('parses and serializes has_additives with strict boolean semantics', () => {
		const trueState = parseCatalogUrlState(
			new URL('https://app.test/catalog?has_additives=true'),
			'/catalog'
		);
		const falseState = parseCatalogUrlState(
			new URL('https://app.test/catalog?has_additives=false'),
			'/catalog'
		);
		const malformedState = parseCatalogUrlState(
			new URL('https://app.test/catalog?has_additives=unknown'),
			'/catalog'
		);
		const emptyState = parseCatalogUrlState(
			new URL('https://app.test/catalog?has_additives='),
			'/catalog'
		);

		expect(trueState.filters.has_additives).toBe(true);
		expect(falseState.filters.has_additives).toBe(false);
		expect(catalogUrlStateToSearchState(falseState).hasAdditives).toBe(false);
		expect(buildCatalogRequestParams(falseState, '/catalog').toString()).toBe(
			'page=1&limit=15&has_additives=false'
		);
		expect(malformedState.filters).not.toHaveProperty('has_additives');
		expect(emptyState.filters).not.toHaveProperty('has_additives');

		const stringBooleanState = createDefaultCatalogUrlState('/catalog');
		stringBooleanState.filters = { has_additives: 'false' };
		expect(catalogUrlStateToSearchState(stringBooleanState).hasAdditives).toBeUndefined();
		expect(buildCatalogRequestParams(stringBooleanState, '/catalog').toString()).toBe(
			'page=1&limit=15'
		);
	});

	it('round-trips numeric MASL bounds separately from the legacy grade text filter', () => {
		const state = parseCatalogUrlState(
			new URL(
				'https://app.test/catalog?grade=SHB&elevation_min_masl=1200&elevation_max_masl=1900&include_unknown_elevation=true'
			),
			'/catalog'
		);

		expect(state.filters).toMatchObject({
			grade: 'SHB',
			elevation_masl: { min: '1200', max: '1900', includeUnknown: true }
		});
		expect(buildCatalogShareParams(state, '/catalog').toString()).toBe(
			'grade=SHB&elevation_min_masl=1200&elevation_max_masl=1900&include_unknown_elevation=true'
		);
		expect(catalogUrlStateToSearchState(state)).toMatchObject({
			grade: 'SHB',
			elevationMinMasl: 1200,
			elevationMaxMasl: 1900,
			includeUnknownElevation: true
		});

		const unsupportedScalar = parseCatalogUrlState(
			new URL('https://app.test/catalog?elevation_masl=high'),
			'/catalog'
		);
		expect(unsupportedScalar.filters).not.toHaveProperty('elevation_masl');
	});

	it('keeps active sort settings in share URLs when filters are cleared', () => {
		const state = createDefaultCatalogUrlState('/catalog');
		state.sortField = 'score_value';
		state.sortDirection = 'asc';

		const params = buildCatalogShareParams(state, '/catalog');

		expect(params.toString()).toBe('sortField=score_value&sortDirection=asc');
	});

	it('keeps request params explicit for server fetches', () => {
		const state = createDefaultCatalogUrlState('/catalog');
		state.filters = { name: 'guji', processing_confidence_min: 0.8 };

		const params = buildCatalogRequestParams(state, '/catalog');

		expect(params.toString()).toBe('page=1&limit=15&processing_confidence_min=0.8&name=guji');
	});

	it('maps URL state back onto shared catalog search options', () => {
		const state = createDefaultCatalogUrlState('/catalog');
		state.filters = {
			country: ['Ethiopia', 'Colombia'],
			source: ['sweet_marias', 'genuine_origin'],
			processing_base_method: 'Natural',
			fermentation_type: 'anaerobic',
			process_additive: 'hops',
			has_additives: true,
			processing_disclosure_level: 'high_detail',
			processing_confidence_min: 0.8,
			score_value: { min: '86', max: '90' },
			cost_lb: { min: '7.5', max: '9.25' },
			stocked_date: '2026-04-01',
			stocked_days: 30
		};
		state.pagination.page = 3;
		state.sortField = 'score_value';
		state.sortDirection = 'asc';

		expect(catalogUrlStateToSearchState(state)).toEqual({
			origin: undefined,
			continent: undefined,
			country: ['Ethiopia', 'Colombia'],
			source: ['sweet_marias', 'genuine_origin'],
			processing: undefined,
			processingBaseMethod: 'Natural',
			fermentationType: 'anaerobic',
			processAdditive: 'hops',
			hasAdditives: true,
			processingDisclosureLevel: 'high_detail',
			processingConfidenceMin: 0.8,
			cultivarDetail: undefined,
			type: undefined,
			grade: undefined,
			appearance: undefined,
			name: undefined,
			region: undefined,
			scoreValueMin: 86,
			scoreValueMax: 90,
			pricePerLbMin: 7.5,
			pricePerLbMax: 9.25,
			elevationMinMasl: undefined,
			elevationMaxMasl: undefined,
			arrivalDate: undefined,
			stockedDate: '2026-04-01',
			stockedDays: 30,
			orderBy: 'score_value',
			orderDirection: 'asc',
			limit: 15,
			offset: 30
		});
	});

	it('round-trips the relative stocked window through URL and search state', () => {
		const state = parseCatalogUrlState(
			new URL('https://app.test/catalog?stocked_days=30'),
			'/catalog'
		);

		expect(state.filters.stocked_days).toBe(30);
		expect(buildCatalogShareParams(state, '/catalog').toString()).toBe('stocked_days=30');
		expect(catalogUrlStateToSearchState(state).stockedDays).toBe(30);
	});

	it('round-trips the standardized variety, species and drying filters as repeatable codes', () => {
		const state = parseCatalogUrlState(
			new URL(
				'https://app.test/catalog?variety_code=bourbon&variety_code=gesha&species_code=arabica&drying_method_code=raised_bed'
			)
		);

		expect(state.filters).toEqual({
			variety_code: ['bourbon', 'gesha'],
			species_code: ['arabica'],
			drying_method_code: ['raised_bed']
		});
		expect(buildCatalogShareParams(state).toString()).toBe(
			'drying_method_code=raised_bed&variety_code=bourbon&variety_code=gesha&species_code=arabica'
		);
		expect(catalogUrlStateToSearchState(state)).toMatchObject({
			varietyCodes: ['bourbon', 'gesha'],
			speciesCodes: ['arabica'],
			dryingMethodCodes: ['raised_bed']
		});
	});

	it('round-trips a view that also lists out-of-stock coffees', () => {
		const state = parseCatalogUrlState(new URL('https://app.test/catalog?stocked=all'));

		expect(state.includeUnstocked).toBe(true);
		expect(buildCatalogShareParams(state).toString()).toBe('stocked=all');
		expect(buildCatalogRequestParams(state).get('stocked')).toBe('all');
		expect(
			parseCatalogUrlState(new URL('https://app.test/catalog')).includeUnstocked
		).toBeUndefined();
	});

	it('reads a value a link repeats as one selection', () => {
		const state = parseCatalogUrlState(
			new URL(
				'https://app.test/catalog?country=Kenya&country=Ethiopia&country=Kenya&source=sweet_marias&source=sweet_marias&variety_code=gesha&variety_code=gesha'
			)
		);

		expect(state.filters).toEqual({
			country: ['Kenya', 'Ethiopia'],
			source: ['sweet_marias'],
			variety_code: ['gesha']
		});
		expect(buildCatalogShareParams(state).toString()).toBe(
			'country=Kenya&country=Ethiopia&source=sweet_marias&variety_code=gesha'
		);
	});

	it('keeps every filter from an older link whose control is retired', () => {
		const search =
			'sortField=region&sortDirection=asc&processing=Natural&processing_confidence_min=0.8&cultivar_detail=Caturra&type=Importer&grade=SHB&appearance=EP';
		const state = parseCatalogUrlState(new URL(`https://app.test/catalog?${search}`));

		expect(state.filters).toEqual({
			processing: 'Natural',
			processing_confidence_min: 0.8,
			cultivar_detail: 'Caturra',
			type: 'Importer',
			grade: 'SHB',
			appearance: 'EP'
		});
		expect(state.sortField).toBe('region');
		expect(buildCatalogShareParams(state).toString()).toBe(search);
	});

	it('round-trips the grade and quality filters', () => {
		const search =
			'grade_code=KE%3AAA&grade_code=PREP%3AEP&peaberry=true&lab_analyzed=true&screen_min=15&screen_max=18&include_unknown_screen=true&moisture_max=11.5&score_value_min=86&score_protocol=sca_2004';
		const state = parseCatalogUrlState(new URL(`https://app.test/catalog?${search}`));

		expect(state.filters).toEqual({
			grade_code: ['KE:AA', 'PREP:EP'],
			peaberry: true,
			lab_analyzed: true,
			screen_size: { min: '15', max: '18', includeUnknown: true },
			moisture_max: 11.5,
			score_value: { min: '86', max: '' },
			score_protocol: 'sca_2004'
		});
		expect(buildCatalogShareParams(state).toString()).toBe(search);
		expect(catalogUrlStateToSearchState(state)).toMatchObject({
			gradeCodes: ['KE:AA', 'PREP:EP'],
			peaberry: true,
			labAnalyzed: true,
			screenMin: 15,
			screenMax: 18,
			includeUnknownScreen: true,
			moistureMax: 11.5,
			scoreValueMin: 86,
			scoreProtocol: 'sca_2004'
		});
	});

	it('normalizes hand-typed grade codes and ignores grading values Parchment would not accept', () => {
		const filters = (search: string) =>
			parseCatalogUrlState(new URL(`https://app.test/catalog?${search}`)).filters;

		expect(filters('grade_code=ke:aa&grade_code=KE:AA')).toEqual({ grade_code: ['KE:AA'] });
		// There is no "not a peaberry" filter, and an unknown protocol is not a filter.
		expect(filters('peaberry=false&lab_analyzed=no&score_protocol=made_up')).toEqual({});
		expect(filters('score_protocol=SUPPLIER_UNSPECIFIED')).toEqual({
			score_protocol: 'supplier_unspecified'
		});
		// Screen sizes are whole numbers from 8 to 20; an inverted pair is dropped whole.
		expect(filters('screen_min=7&screen_max=18')).toEqual({ screen_size: { min: '', max: '18' } });
		expect(filters('screen_min=15.5')).toEqual({});
		expect(filters('screen_min=18&screen_max=15')).toEqual({});
		expect(filters('include_unknown_screen=true')).toEqual({});
		expect(filters('moisture_max=0&moisture_max=abc')).toEqual({});
	});
});
