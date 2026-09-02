import type { CatalogMapResponse } from '@purveyors/sdk';
import type { CatalogMapBounds, ElevationDisplayUnit } from './mapState';

export type CatalogMapItem = CatalogMapResponse['data'][number];
export type CatalogMapPlace = Extract<CatalogMapItem, { type: 'place' }>;
export type CatalogMapCluster = Extract<CatalogMapItem, { type: 'cluster' }>;

export interface CatalogMapLocation {
	type: 'location';
	id: string;
	place_id: string | null;
	canonical_name: string;
	place_type: CatalogMapPlace['place_type'];
	longitude: number;
	latitude: number;
	geographic_precision: CatalogMapPlace['geographic_precision'];
	coordinate_kind: CatalogMapPlace['coordinate_kind'];
	place_provenance: CatalogMapPlace['place_provenance'];
	placement_count: number;
	unique_coffee_count: number;
	catalog_ids: number[];
}

export type CatalogMapDisplayItem = CatalogMapItem | CatalogMapLocation;

export interface CatalogMapPointProperties {
	type: 'cluster' | 'location' | 'place';
	id: string;
	label: string;
	placementCount: number;
	uniqueCoffeeCount: number;
	catalogId: number | null;
	catalogIds: number[];
	placeId: string | null;
	precisionLabel: string;
	elevationBand: string;
	color: string;
	west: number | null;
	south: number | null;
	east: number | null;
	north: number | null;
}

export interface CatalogMapGeoJson {
	type: 'FeatureCollection';
	features: Array<{
		type: 'Feature';
		geometry: { type: 'Point'; coordinates: [number, number] };
		properties: CatalogMapPointProperties;
	}>;
}

export const ELEVATION_BANDS = [
	{ key: 'below_1000', label: 'Below 1,000 MASL', color: '#8FA382' },
	{ key: '1000_to_1399', label: '1,000–1,399 MASL', color: '#D9A05B' },
	{ key: '1400_to_1799', label: '1,400–1,799 MASL', color: '#C05B2E' },
	{ key: '1800_to_2199', label: '1,800–2,199 MASL', color: '#9C4356' },
	{ key: '2200_and_above', label: '2,200+ MASL', color: '#6D5BD0' },
	{ key: 'partial_or_unknown', label: 'Elevation unavailable', color: '#695C4D' }
] as const;

const CATALOG_POINT_COLOR = '#C05B2E';
const CLUSTER_COLOR = '#302F2A';

export function isCatalogMapCluster(item: CatalogMapDisplayItem): item is CatalogMapCluster {
	return item.type === 'cluster';
}

export function isCatalogMapPlace(item: CatalogMapDisplayItem): item is CatalogMapPlace {
	return item.type === 'place';
}

export function isCatalogMapLocation(item: CatalogMapDisplayItem): item is CatalogMapLocation {
	return item.type === 'location';
}

export function elevationBandForPlace(place: CatalogMapPlace): (typeof ELEVATION_BANDS)[number] {
	// A partial interval has no finite midpoint. Keep it neutral instead of
	// fabricating a band from the one known side.
	if (place.elevation_min_masl === null || place.elevation_max_masl === null) {
		return ELEVATION_BANDS[5];
	}
	const midpoint = (place.elevation_min_masl + place.elevation_max_masl) / 2;
	if (midpoint < 1000) return ELEVATION_BANDS[0];
	if (midpoint < 1400) return ELEVATION_BANDS[1];
	if (midpoint < 1800) return ELEVATION_BANDS[2];
	if (midpoint < 2200) return ELEVATION_BANDS[3];
	return ELEVATION_BANDS[4];
}

export function formatGeographicPrecision(
	place: Pick<CatalogMapPlace, 'coordinate_kind' | 'geographic_precision'>
): string {
	if (place.coordinate_kind === 'exact_point' && place.geographic_precision === 'exact_site') {
		return 'Exact site location';
	}
	const label = place.geographic_precision.replaceAll('_', ' ');
	return place.coordinate_kind === 'centroid'
		? `${label[0].toUpperCase()}${label.slice(1)}-level area`
		: `${label[0].toUpperCase()}${label.slice(1)}-level location`;
}

export function maslToFeet(masl: number): number {
	return Math.round(masl * 3.28084);
}

export function formatElevationValue(value: number | null, units: ElevationDisplayUnit): string {
	if (value === null) return 'unknown';
	return units === 'ft'
		? `${maslToFeet(value).toLocaleString()} ft`
		: `${value.toLocaleString()} MASL`;
}

export function formatElevationRange(
	minimum: number | null,
	maximum: number | null,
	units: ElevationDisplayUnit
): string {
	if (minimum === null && maximum === null) return 'Elevation unknown';
	if (minimum !== null && maximum !== null) {
		return `${formatElevationValue(minimum, units)}–${formatElevationValue(maximum, units)}`;
	}
	if (minimum !== null) return `${formatElevationValue(minimum, units)} or higher`;
	return `${formatElevationValue(maximum, units)} or lower`;
}

export function catalogMapItemBounds(item: CatalogMapDisplayItem): CatalogMapBounds | null {
	return item.type === 'cluster' ? item.bounds : null;
}

export function toCatalogMapGeoJson(
	items: CatalogMapDisplayItem[],
	lens: 'catalog' | 'elevation'
): CatalogMapGeoJson {
	return {
		type: 'FeatureCollection',
		features: items.map((item) => {
			if (isCatalogMapCluster(item)) {
				return {
					type: 'Feature' as const,
					geometry: {
						type: 'Point' as const,
						coordinates: [item.longitude, item.latitude] as [number, number]
					},
					properties: {
						type: 'cluster' as const,
						id: item.id,
						label: 'Mapped area',
						placementCount: item.placement_count,
						uniqueCoffeeCount: item.unique_coffee_count,
						catalogId: null,
						catalogIds: item.catalog_ids,
						placeId: null,
						precisionLabel: 'Cluster',
						elevationBand: 'cluster',
						color: CLUSTER_COLOR,
						west: item.bounds.west,
						south: item.bounds.south,
						east: item.bounds.east,
						north: item.bounds.north
					}
				};
			}

			if (isCatalogMapLocation(item)) {
				const precisionLabel = formatGeographicPrecision(item);
				return {
					type: 'Feature' as const,
					geometry: {
						type: 'Point' as const,
						coordinates: [item.longitude, item.latitude] as [number, number]
					},
					properties: {
						type: 'location' as const,
						id: item.id,
						label: item.canonical_name,
						placementCount: item.placement_count,
						uniqueCoffeeCount: item.unique_coffee_count,
						catalogId: null,
						catalogIds: item.catalog_ids,
						placeId: item.place_id,
						precisionLabel,
						elevationBand: 'location',
						color: CLUSTER_COLOR,
						west: null,
						south: null,
						east: null,
						north: null
					}
				};
			}

			const band = elevationBandForPlace(item);
			return {
				type: 'Feature' as const,
				geometry: {
					type: 'Point' as const,
					coordinates: [item.longitude, item.latitude] as [number, number]
				},
				properties: {
					type: 'place' as const,
					id: item.id,
					label: item.canonical_name,
					placementCount: 1,
					uniqueCoffeeCount: 1,
					catalogId: item.catalog_id,
					catalogIds: [item.catalog_id],
					placeId: item.place_id,
					precisionLabel: formatGeographicPrecision(item),
					elevationBand: band.key,
					color: lens === 'elevation' ? band.color : CATALOG_POINT_COLOR,
					west: null,
					south: null,
					east: null,
					north: null
				}
			};
		})
	};
}
