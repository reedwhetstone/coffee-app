import { describe, expect, it } from 'vitest';
import {
	elevationBandForPlace,
	formatElevationRange,
	formatGeographicPrecision,
	toCatalogMapGeoJson,
	type CatalogMapCluster,
	type CatalogMapPlace
} from './mapPresentation';

const place: CatalogMapPlace = {
	type: 'place',
	id: 'place:1:1',
	catalog_id: 1,
	place_id: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
	canonical_name: 'Huila',
	place_type: 'region',
	longitude: -75.5,
	latitude: 2.5,
	geographic_precision: 'region',
	coordinate_kind: 'centroid',
	place_provenance: 'reference_dataset',
	assignment_role: 'primary',
	assignment_provenance: 'deterministic_resolution',
	assignment_confidence: 0.92,
	elevation_min_masl: 1400,
	elevation_max_masl: 1800
};

const cluster: CatalogMapCluster = {
	type: 'cluster',
	id: 'cluster:1',
	longitude: -70,
	latitude: 5,
	bounds: { west: -80, south: -10, east: -60, north: 20, crossesAntimeridian: false },
	placement_count: 5,
	unique_coffee_count: 4,
	catalog_ids: [1, 2, 3, 4]
};

describe('catalog map presentation semantics', () => {
	it('keeps broad centroids explicitly distinct from exact farms', () => {
		expect(formatGeographicPrecision(place)).toBe('Region centroid, not an exact farm');
	});

	it('uses complete interval midpoints for bands and leaves partial bounds neutral', () => {
		expect(elevationBandForPlace(place).key).toBe('1400_to_1799');
		expect(
			elevationBandForPlace({ ...place, elevation_min_masl: 1800, elevation_max_masl: null }).key
		).toBe('partial_or_unknown');
	});

	it('formats partial bounds without inventing a closed interval', () => {
		expect(formatElevationRange(1800, null, 'masl')).toBe('1,800 MASL or higher');
		expect(formatElevationRange(null, 1800, 'ft')).toBe('5,906 ft or lower');
		expect(formatElevationRange(null, null, 'masl')).toBe('Elevation unknown');
	});

	it('keeps cluster placement and unique-coffee counts separate in map features', () => {
		const geojson = toCatalogMapGeoJson([cluster, place], 'elevation');
		expect(geojson.features[0].properties).toMatchObject({
			type: 'cluster',
			placementCount: 5,
			uniqueCoffeeCount: 4,
			label: '5 placements'
		});
		expect(geojson.features[1].properties).toMatchObject({
			type: 'place',
			catalogId: 1,
			precisionLabel: 'Region centroid, not an exact farm',
			elevationBand: '1400_to_1799'
		});
	});
});
