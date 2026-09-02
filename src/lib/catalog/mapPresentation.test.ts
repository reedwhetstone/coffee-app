import { describe, expect, it } from 'vitest';
import {
	elevationBandForPlace,
	formatElevationRange,
	formatGeographicPrecision,
	toCatalogMapGeoJson,
	type CatalogMapCluster,
	type CatalogMapLocation,
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

const location: CatalogMapLocation = {
	type: 'location',
	id: 'location:ethiopia',
	place_id: null,
	canonical_name: 'Ethiopia',
	place_type: 'country',
	longitude: 40.5,
	latitude: 9.1,
	geographic_precision: 'country',
	coordinate_kind: 'centroid',
	place_provenance: 'reference_dataset',
	placement_count: 8,
	unique_coffee_count: 6,
	catalog_ids: [1, 2, 3, 4, 5, 6]
};

describe('catalog map presentation semantics', () => {
	it('keeps broad centroids explicitly distinct from exact farms', () => {
		expect(formatGeographicPrecision(place)).toBe('Region-level area');
	});

	it('uses complete interval midpoints for bands and leaves partial bounds neutral', () => {
		expect(elevationBandForPlace(place).key).toBe('1400_to_1799');
		expect(
			elevationBandForPlace({ ...place, elevation_min_masl: 2200, elevation_max_masl: 2600 })
		).toMatchObject({ key: '2200_and_above', color: '#4E8098' });
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
		const geojson = toCatalogMapGeoJson([cluster, place]);
		expect(geojson.features[0].properties).toMatchObject({
			type: 'cluster',
			placementCount: 5,
			uniqueCoffeeCount: 4,
			label: 'Mapped area',
			catalogIds: [1, 2, 3, 4]
		});
		expect(geojson.features[1].properties).toMatchObject({
			type: 'place',
			catalogId: 1,
			precisionLabel: 'Region-level area',
			elevationBand: '1400_to_1799',
			color: '#C05B2E'
		});
	});

	it('keeps semantic location groups named and selectable', () => {
		const feature = toCatalogMapGeoJson([location]).features[0];
		expect(feature.properties).toMatchObject({
			type: 'location',
			label: 'Ethiopia',
			precisionLabel: 'Country-level area',
			catalogIds: [1, 2, 3, 4, 5, 6]
		});
	});
});
