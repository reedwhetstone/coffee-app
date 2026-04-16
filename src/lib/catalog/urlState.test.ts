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
			'https://app.test/catalog?country=Ethiopia&country=Colombia&processing=Washed&name=guji&price_per_lb_min=7.5&price_per_lb_max=9&page=2&showWholesale=true'
		);

		const state = parseCatalogUrlState(url, '/catalog');

		expect(state).toEqual({
			filters: {
				country: ['Ethiopia', 'Colombia'],
				processing: 'Washed',
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
			cost_lb: { min: '7.5', max: '' }
		};

		const params = buildCatalogShareParams(state, '/catalog');

		expect(params.toString()).toBe('country=Ethiopia&processing=Washed&price_per_lb_min=7.5');
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
		state.filters = { name: 'guji' };

		const params = buildCatalogRequestParams(state, '/catalog');

		expect(params.toString()).toBe('page=1&limit=15&name=guji');
	});

	it('maps URL state back onto shared catalog search options', () => {
		const state = createDefaultCatalogUrlState('/catalog');
		state.filters = {
			country: ['Ethiopia', 'Colombia'],
			source: ['sweet_marias', 'genuine_origin'],
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
