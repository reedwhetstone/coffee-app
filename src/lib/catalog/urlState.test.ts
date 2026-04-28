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
			'https://app.test/catalog?country=Ethiopia&country=Colombia&processing=Washed&processing_base_method=washed&fermentation_type=anaerobic&process_additive=fruit&processing_disclosure_level=high_detail&processing_confidence_min=0.8&name=guji&price_per_lb_min=7.5&price_per_lb_max=9&page=2&showWholesale=true'
		);

		const state = parseCatalogUrlState(url, '/catalog');

		expect(state).toEqual({
			filters: {
				country: ['Ethiopia', 'Colombia'],
				processing: 'Washed',
				processing_base_method: 'washed',
				fermentation_type: 'anaerobic',
				process_additive: 'fruit',
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
			processing_disclosure_level: 'high_detail',
			processing_confidence_min: 0.8,
			cost_lb: { min: '7.5', max: '' }
		};

		const params = buildCatalogShareParams(state, '/catalog');

		expect(params.toString()).toBe(
			'country=Ethiopia&processing=Washed&processing_base_method=washed&fermentation_type=anaerobic&process_additive=fruit&processing_disclosure_level=high_detail&processing_confidence_min=0.8&price_per_lb_min=7.5'
		);
	});

	it('maps process transparency filters onto shared catalog search options', () => {
		const state = createDefaultCatalogUrlState('/catalog');
		state.filters = {
			processing_base_method: 'natural',
			fermentation_type: 'anaerobic',
			process_additive: 'fruit',
			processing_disclosure_level: 'high_detail',
			processing_confidence_min: '0.8'
		};

		expect(catalogUrlStateToSearchState(state)).toMatchObject({
			processingBaseMethod: 'natural',
			fermentationType: 'anaerobic',
			processAdditive: 'fruit',
			processingDisclosureLevel: 'high_detail',
			processingConfidenceMin: 0.8
		});
	});

	it('drops invalid processing confidence thresholds instead of serializing impossible claims', () => {
		const state = parseCatalogUrlState(
			new URL('https://app.test/catalog?processing_confidence_min=1.5'),
			'/catalog'
		);

		expect(state.filters).not.toHaveProperty('processing_confidence_min');

		const searchState = createDefaultCatalogUrlState('/catalog');
		searchState.filters = { processing_confidence_min: '5' };
		expect(catalogUrlStateToSearchState(searchState).processingConfidenceMin).toBeUndefined();
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
			processing_disclosure_level: 'high_detail',
			processing_confidence_min: 0.8,
			score_value: { min: '86', max: '90' },
			cost_lb: { min: '7.5', max: '9.25' },
			stocked_date: '30'
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
			arrivalDate: undefined,
			stockedDate: '30',
			orderBy: 'score_value',
			orderDirection: 'asc',
			limit: 15,
			offset: 30
		});
	});
});
