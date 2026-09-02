import { buildCatalogShareParams, type CatalogUrlState } from '$lib/catalog/urlState';

export type CatalogViewMode = 'list' | 'map';

export interface CatalogMapBounds {
	west: number;
	south: number;
	east: number;
	north: number;
}

export interface CatalogMapUrlState {
	view: CatalogViewMode;
	center: [longitude: number, latitude: number];
	zoom: number;
	bbox: CatalogMapBounds | null;
	placeId: string | null;
}

export const DEFAULT_CATALOG_MAP_STATE: CatalogMapUrlState = {
	view: 'list',
	center: [0, 18],
	zoom: 1.75,
	bbox: null,
	placeId: null
};

/**
 * Ask Parchment for its lightest point-level projection, then let MapLibre's
 * worker cluster those points for the current screen. This keeps marker
 * coordinates close to the canonical place instead of drawing server tile
 * centers over oceans, and avoids a network round trip for every zoom.
 */
export const CATALOG_MAP_POINT_PROJECTION_ZOOM = 22;

const MAP_UI_KEYS = [
	'view',
	'map_lens',
	'map_units',
	'map_center',
	'map_zoom',
	'map_bbox',
	'map_place'
] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseFinite(value: string | null): number | null {
	if (value === null || value.trim() === '') return null;
	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function parseCoordinatePair(value: string | null): [number, number] | null {
	if (!value) return null;
	const parts = value.split(',').map((part) => parseFinite(part));
	if (parts.length !== 2 || parts.some((part) => part === null)) return null;
	const [longitude, latitude] = parts as [number, number];
	if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) return null;
	return [longitude, latitude];
}

export function parseCatalogMapBounds(value: string | null): CatalogMapBounds | null {
	if (!value) return null;
	const parts = value.split(',').map((part) => parseFinite(part));
	if (parts.length !== 4 || parts.some((part) => part === null)) return null;
	const [west, south, east, north] = parts as [number, number, number, number];
	if (
		west < -180 ||
		west > 180 ||
		east < -180 ||
		east > 180 ||
		south < -90 ||
		south > 90 ||
		north < -90 ||
		north > 90 ||
		south > north
	) {
		return null;
	}
	return { west, south, east, north };
}

function trimCoordinate(value: number): string {
	return Number(value.toFixed(5)).toString();
}

export function normalizeCatalogMapLongitude(longitude: number): number {
	const wrapped = ((((longitude + 180) % 360) + 360) % 360) - 180;
	return wrapped === -180 && longitude > 0 ? 180 : wrapped;
}

/** Normalize map-library bounds into the API's canonical longitude domain. */
export function normalizeCatalogMapBounds(bounds: CatalogMapBounds): CatalogMapBounds {
	return {
		west: normalizeCatalogMapLongitude(bounds.west),
		south: bounds.south,
		east: normalizeCatalogMapLongitude(bounds.east),
		north: bounds.north
	};
}

export function formatCatalogMapBounds(bounds: CatalogMapBounds): string {
	return [bounds.west, bounds.south, bounds.east, bounds.north].map(trimCoordinate).join(',');
}

export function parseCatalogMapUrlState(searchParams: URLSearchParams): CatalogMapUrlState {
	const view = searchParams.get('view') === 'map' ? 'map' : 'list';
	const center =
		parseCoordinatePair(searchParams.get('map_center')) ?? DEFAULT_CATALOG_MAP_STATE.center;
	const requestedZoom = parseFinite(searchParams.get('map_zoom'));
	const zoom =
		requestedZoom !== null && requestedZoom >= 0 && requestedZoom <= 22
			? requestedZoom
			: DEFAULT_CATALOG_MAP_STATE.zoom;
	const requestedPlaceId = searchParams.get('map_place');

	return {
		view,
		center,
		zoom,
		bbox: parseCatalogMapBounds(searchParams.get('map_bbox')),
		placeId: requestedPlaceId && UUID_PATTERN.test(requestedPlaceId) ? requestedPlaceId : null
	};
}

/** Replace only map-owned URL params, preserving the catalog filter URL. */
export function writeCatalogMapUrlState(
	searchParams: URLSearchParams,
	state: CatalogMapUrlState
): URLSearchParams {
	for (const key of MAP_UI_KEYS) searchParams.delete(key);
	if (state.view !== 'map') return searchParams;

	searchParams.set('view', 'map');
	searchParams.set(
		'map_center',
		[normalizeCatalogMapLongitude(state.center[0]), state.center[1]].map(trimCoordinate).join(',')
	);
	searchParams.set('map_zoom', trimCoordinate(state.zoom));
	if (state.bbox) searchParams.set('map_bbox', formatCatalogMapBounds(state.bbox));
	if (state.placeId) searchParams.set('map_place', state.placeId);
	return searchParams;
}

/**
 * Preserve the bounded presentation state when the filter store rewrites the
 * canonical catalog query string. Invalid map state is dropped, not echoed.
 */
export function preserveCatalogExperienceParams(
	current: URLSearchParams,
	nextCatalogParams: URLSearchParams
): URLSearchParams {
	writeCatalogMapUrlState(nextCatalogParams, parseCatalogMapUrlState(current));

	const selectedCoffee = current.get('coffee');
	if (selectedCoffee && /^\d+$/.test(selectedCoffee) && Number(selectedCoffee) > 0) {
		nextCatalogParams.set('coffee', selectedCoffee);
	}
	if (current.get('tracked') === 'only') nextCatalogParams.set('tracked', 'only');
	return nextCatalogParams;
}

/** Build the thin-BFF request from one canonical catalog state plus map state. */
export function buildCatalogMapRequestParams(
	catalogState: CatalogUrlState,
	mapState: CatalogMapUrlState
): URLSearchParams {
	const params = buildCatalogShareParams(catalogState, '/catalog');
	params.delete('page');
	params.delete('limit');
	params.delete('sortField');
	params.delete('sortDirection');
	params.set('stocked', 'true');
	params.set('showWholesale', catalogState.showWholesale ? 'true' : 'false');
	params.set('wholesaleOnly', catalogState.wholesaleOnly ? 'true' : 'false');
	params.set('zoom', CATALOG_MAP_POINT_PROJECTION_ZOOM.toString());
	params.set('projection', 'locations');
	// Terrain is now a presentation layer on every catalog map. Keep the API on
	// its lightweight catalog projection; numeric elevation filtering remains a
	// canonical catalog query capability rather than a map lens.
	params.set('lens', 'catalog');
	if (mapState.bbox) params.set('bbox', formatCatalogMapBounds(mapState.bbox));
	if (mapState.placeId) params.set('place_id', mapState.placeId);
	return params;
}
