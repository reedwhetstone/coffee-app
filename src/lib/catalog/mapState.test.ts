import { describe, expect, it } from 'vitest';
import {
	buildCatalogMapRequestParams,
	formatCatalogMapBounds,
	normalizeCatalogMapBounds,
	parseCatalogMapUrlState,
	preserveCatalogExperienceParams,
	writeCatalogMapUrlState,
	type CatalogMapUrlState
} from './mapState';
import { createDefaultCatalogUrlState } from './urlState';

const placeId = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';

describe('catalog map URL state', () => {
	it('round-trips map, antimeridian viewport, lens, units, and canonical place navigation', () => {
		const state: CatalogMapUrlState = {
			view: 'map',
			lens: 'elevation',
			units: 'ft',
			center: [179.123456, -12.987654],
			zoom: 6.25,
			bbox: { west: 170, south: -20, east: -170, north: 5 },
			placeId
		};
		const params = writeCatalogMapUrlState(new URLSearchParams('country=Ethiopia'), state);

		expect(params.get('country')).toBe('Ethiopia');
		expect(params.get('map_bbox')).toBe('170,-20,-170,5');
		expect(parseCatalogMapUrlState(params)).toEqual({
			...state,
			center: [179.12346, -12.98765]
		});
	});

	it('drops malformed geometry, coordinates, zoom, and place identities', () => {
		const parsed = parseCatalogMapUrlState(
			new URLSearchParams(
				'view=map&map_center=999,2&map_zoom=99&map_bbox=-10,40,20,-40&map_place=not-a-uuid'
			)
		);

		expect(parsed.center).toEqual([0, 18]);
		expect(parsed.zoom).toBe(1.75);
		expect(parsed.bbox).toBeNull();
		expect(parsed.placeId).toBeNull();
	});

	it('preserves only validated map/deep-link state across filter-store URL rewrites', () => {
		const next = preserveCatalogExperienceParams(
			new URLSearchParams(
				`view=map&map_center=-73,5&map_zoom=4&map_bbox=-80,-5,-60,15&map_place=${placeId}&coffee=42&tracked=only&map_units=ft`
			),
			new URLSearchParams('country=Colombia')
		);

		expect(next.toString()).toContain('country=Colombia');
		expect(next.get('view')).toBe('map');
		expect(next.get('map_place')).toBe(placeId);
		expect(next.get('coffee')).toBe('42');
		expect(next.get('tracked')).toBe('only');
	});

	it('formats bounds deterministically without changing antimeridian meaning', () => {
		expect(
			formatCatalogMapBounds({ west: 170.1234567, south: -20, east: -170.7654321, north: 5 })
		).toBe('170.12346,-20,-170.76543,5');
	});

	it('normalizes fitted longitudes while preserving antimeridian crossing', () => {
		expect(normalizeCatalogMapBounds({ west: 170, south: -20, east: 190, north: 5 })).toEqual({
			west: 170,
			south: -20,
			east: -170,
			north: 5
		});
	});
});

describe('catalog map BFF request state', () => {
	it('keeps one catalog filter/visibility state and adds only canonical map params', () => {
		const catalogState = createDefaultCatalogUrlState();
		catalogState.filters = {
			country: ['Ethiopia', 'Kenya'],
			elevation_masl: { min: 1200, max: 1900 },
			grade: 'AA'
		};
		catalogState.showWholesale = false;
		catalogState.sortField = 'score_value';
		catalogState.sortDirection = 'desc';

		const params = buildCatalogMapRequestParams(catalogState, {
			view: 'map',
			lens: 'elevation',
			units: 'masl',
			center: [0, 0],
			zoom: 5.7,
			bbox: { west: 170, south: -20, east: -170, north: 20 },
			placeId
		});

		expect(params.getAll('country')).toEqual(['Ethiopia', 'Kenya']);
		expect(params.get('elevation_min_masl')).toBe('1200');
		expect(params.get('elevation_max_masl')).toBe('1900');
		expect(params.get('grade')).toBe('AA');
		expect(params.get('showWholesale')).toBe('false');
		expect(params.get('bbox')).toBe('170,-20,-170,20');
		expect(params.get('zoom')).toBe('22');
		expect(params.get('lens')).toBe('elevation');
		expect(params.get('place_id')).toBe(placeId);
		expect(params.has('sortField')).toBe(false);
		expect(params.has('page')).toBe(false);
	});
});
