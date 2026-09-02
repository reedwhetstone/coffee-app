import { render, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CatalogMapCanvas from './CatalogMapCanvas.svelte';

const maplibre = vi.hoisted(() => {
	const setWorkerUrl = vi.fn();
	const constructMap = vi.fn();
	const fakePopup = {
		setLngLat: vi.fn(),
		setDOMContent: vi.fn(),
		addTo: vi.fn(),
		remove: vi.fn()
	};
	fakePopup.setLngLat.mockReturnValue(fakePopup);
	fakePopup.setDOMContent.mockReturnValue(fakePopup);
	fakePopup.addTo.mockReturnValue(fakePopup);
	const fakeSource = {
		setData: vi.fn(),
		getClusterExpansionZoom: vi.fn(async () => 7),
		getClusterLeaves: vi.fn(async () => [
			{
				properties: {
					label: 'Ethiopia',
					catalogIds: [42, 43],
					placementCount: 2,
					uniqueCoffeeCount: 2
				}
			}
		])
	};
	const styleState = {
		terrainSourceAdded: false,
		terrainLayerAdded: false
	};
	const fakeMap = {
		addControl: vi.fn(),
		addSource: vi.fn((id: string) => {
			if (id === 'catalog-terrain-dem') styleState.terrainSourceAdded = true;
		}),
		addLayer: vi.fn((layer: { id?: string }) => {
			if (layer.id === 'catalog-terrain-relief') styleState.terrainLayerAdded = true;
		}),
		removeLayer: vi.fn((id: string) => {
			if (id === 'catalog-terrain-relief') styleState.terrainLayerAdded = false;
		}),
		removeSource: vi.fn((id: string) => {
			if (id === 'catalog-terrain-dem') styleState.terrainSourceAdded = false;
		}),
		on: vi.fn(),
		remove: vi.fn(),
		resize: vi.fn(),
		getCanvas: vi.fn(() => ({ style: { cursor: '' } })),
		getSource: vi.fn((id: string) => {
			if (id === 'catalog-map') return fakeSource;
			if (id === 'catalog-terrain-dem' && styleState.terrainSourceAdded) return {};
			return undefined;
		}),
		getCenter: vi.fn(() => ({ lng: 0, lat: 18 })),
		getZoom: vi.fn(() => 1.75),
		getBounds: vi.fn(() => ({
			getWest: () => 170,
			getSouth: () => -10,
			getEast: () => 190,
			getNorth: () => 10
		})),
		getLayer: vi.fn((id: string) => {
			if (id === 'catalog-terrain-relief') {
				return styleState.terrainLayerAdded ? {} : undefined;
			}
			return {};
		}),
		setPaintProperty: vi.fn(),
		easeTo: vi.fn(),
		jumpTo: vi.fn()
	};

	return { setWorkerUrl, constructMap, fakeSource, fakeMap, fakePopup, styleState };
});

vi.mock('maplibre-gl', () => ({
	Map: vi.fn(function MapMock() {
		maplibre.constructMap();
		return maplibre.fakeMap;
	}),
	NavigationControl: vi.fn(function NavigationControlMock() {}),
	Popup: vi.fn(function PopupMock() {
		return maplibre.fakePopup;
	}),
	setWorkerUrl: maplibre.setWorkerUrl
}));

function loadMap() {
	const load = maplibre.fakeMap.on.mock.calls.find((call) => call[0] === 'load')?.[1] as () => void;
	load();
}

describe('CatalogMapCanvas worker integration', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		maplibre.styleState.terrainSourceAdded = false;
		maplibre.styleState.terrainLayerAdded = false;
		maplibre.fakeMap.addSource.mockImplementation((id: string) => {
			if (id === 'catalog-terrain-dem') maplibre.styleState.terrainSourceAdded = true;
		});
		maplibre.fakeMap.addLayer.mockImplementation((layer: { id?: string }) => {
			if (layer.id === 'catalog-terrain-relief') maplibre.styleState.terrainLayerAdded = true;
		});
		maplibre.fakeSource.getClusterExpansionZoom.mockResolvedValue(7);
		maplibre.fakeSource.getClusterLeaves.mockResolvedValue([
			{
				properties: {
					label: 'Ethiopia',
					catalogIds: [42, 43],
					placementCount: 2,
					uniqueCoffeeCount: 2
				}
			}
		]);
	});

	it('binds the packaged MapLibre worker before constructing the map', async () => {
		render(CatalogMapCanvas, {
			items: [],
			center: [0, 18],
			zoom: 1.75,
			onViewportChange: vi.fn(),
			onPlaceSelect: vi.fn()
		});

		await waitFor(() => expect(maplibre.constructMap).toHaveBeenCalledOnce());
		expect(maplibre.setWorkerUrl).toHaveBeenCalledWith(
			expect.stringContaining('maplibre-gl-worker')
		);
		expect(maplibre.setWorkerUrl.mock.invocationCallOrder[0]).toBeLessThan(
			maplibre.constructMap.mock.invocationCallOrder[0]
		);
	});

	it('clusters lightweight points in the worker and expands a selected cluster immediately', async () => {
		const onClusterSelect = vi.fn();
		render(CatalogMapCanvas, {
			items: [],
			center: [0, 18],
			zoom: 1.75,
			onViewportChange: vi.fn(),
			onPlaceSelect: vi.fn(),
			onClusterSelect
		});

		await waitFor(() => expect(maplibre.constructMap).toHaveBeenCalledOnce());
		loadMap();

		expect(maplibre.fakeMap.addSource).toHaveBeenCalledWith(
			'catalog-map',
			expect.objectContaining({
				cluster: true,
				clusterMaxZoom: 14,
				clusterRadius: 52,
				clusterProperties: {
					placementCount: ['+', ['get', 'placementCount']],
					uniqueCoffeeCount: ['+', ['get', 'uniqueCoffeeCount']]
				}
			})
		);
		const clusterClick = maplibre.fakeMap.on.mock.calls.find(
			(call) => call[0] === 'click' && call[1] === 'catalog-map-clusters'
		)?.[2] as (event: unknown) => void;
		clusterClick({
			features: [
				{
					properties: { cluster_id: 7, placementCount: 12, uniqueCoffeeCount: 10 },
					geometry: { type: 'Point', coordinates: [-75, 5] }
				}
			]
		});

		await waitFor(() =>
			expect(onClusterSelect).toHaveBeenCalledWith({
				kind: 'area',
				label: 'Selected map area',
				precisionLabel: 'Nearby mapped origins',
				mappedOriginCount: 12,
				coffeeMatchCount: 2,
				catalogIds: [42, 43],
				originLabels: ['Ethiopia']
			})
		);
		await waitFor(() =>
			expect(maplibre.fakeSource.getClusterExpansionZoom).toHaveBeenCalledWith(7)
		);
		expect(maplibre.fakeMap.easeTo).toHaveBeenCalledWith({
			center: [-75, 5],
			zoom: 7,
			duration: 350
		});
	});

	it('warms the default basemap with the Purveyors field-journal palette', async () => {
		render(CatalogMapCanvas, {
			items: [],
			center: [0, 18],
			zoom: 1.75,
			onViewportChange: vi.fn(),
			onPlaceSelect: vi.fn()
		});

		await waitFor(() => expect(maplibre.constructMap).toHaveBeenCalledOnce());
		loadMap();

		expect(maplibre.fakeMap.setPaintProperty).toHaveBeenCalledWith(
			'background',
			'background-color',
			'#F7F2EA'
		);
		expect(maplibre.fakeMap.setPaintProperty).toHaveBeenCalledWith(
			'water',
			'fill-color',
			'#F8F6F2'
		);
		expect(maplibre.fakeMap.setPaintProperty).toHaveBeenCalledWith('park', 'fill-color', '#E7E5D8');
		expect(maplibre.fakeMap.setPaintProperty).toHaveBeenCalledWith(
			'label_country_1',
			'text-color',
			'#302F2A'
		);
	});

	it('renders the standard branded terrain bands beneath map context', async () => {
		const props = {
			items: [],
			center: [0, 18] as [number, number],
			zoom: 1.75,
			onViewportChange: vi.fn(),
			onPlaceSelect: vi.fn()
		};
		render(CatalogMapCanvas, props);

		await waitFor(() => expect(maplibre.constructMap).toHaveBeenCalledOnce());
		loadMap();

		expect(maplibre.fakeMap.addSource).toHaveBeenCalledWith('catalog-terrain-dem', {
			type: 'raster-dem',
			tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
			tileSize: 256,
			maxzoom: 15,
			encoding: 'terrarium',
			attribution:
				'<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md">Terrain: Mapzen and contributors</a>'
		});
		expect(maplibre.fakeMap.addLayer).toHaveBeenCalledWith(
			expect.objectContaining({
				id: 'catalog-terrain-relief',
				type: 'color-relief',
				source: 'catalog-terrain-dem',
				paint: {
					'color-relief-color': [
						'interpolate',
						['linear'],
						['elevation'],
						-1000,
						'#E9DDC8',
						999.9,
						'#E9DDC8',
						1000,
						'#DDBE83',
						1399.9,
						'#DDBE83',
						1400,
						'#C9855D',
						1799.9,
						'#C9855D',
						1800,
						'#A95E46',
						2199.9,
						'#A95E46',
						2200,
						'#704C3D',
						9000,
						'#704C3D'
					],
					'color-relief-opacity': 0.48
				}
			}),
			'water'
		);
	});

	it('keeps the catalog map usable when terrain cannot initialize', async () => {
		const onMapReady = vi.fn();
		const onMapError = vi.fn();
		maplibre.fakeMap.addSource.mockImplementation((id: string) => {
			if (id === 'catalog-terrain-dem') throw new Error('terrain unavailable');
		});
		render(CatalogMapCanvas, {
			items: [],
			center: [0, 18],
			zoom: 1.75,
			onViewportChange: vi.fn(),
			onPlaceSelect: vi.fn(),
			onMapReady,
			onMapError
		});

		await waitFor(() => expect(maplibre.constructMap).toHaveBeenCalledOnce());
		loadMap();

		expect(onMapReady).toHaveBeenCalledOnce();
		expect(onMapError).not.toHaveBeenCalled();
		expect(maplibre.fakeMap.addLayer).not.toHaveBeenCalledWith(
			expect.objectContaining({ id: 'catalog-terrain-relief' }),
			expect.anything()
		);
	});

	it('shows shared-location context and keeps single-origin selection wired to details', async () => {
		const onClusterSelect = vi.fn();
		const onPlaceSelect = vi.fn();
		render(CatalogMapCanvas, {
			items: [],
			center: [0, 18],
			zoom: 1.75,
			onViewportChange: vi.fn(),
			onPlaceSelect,
			onClusterSelect
		});

		await waitFor(() => expect(maplibre.constructMap).toHaveBeenCalledOnce());
		loadMap();
		const sharedClick = maplibre.fakeMap.on.mock.calls.find(
			(call) => call[0] === 'click' && call[1] === 'catalog-map-shared-location-hit-targets'
		)?.[2] as (event: unknown) => void;
		const placeClick = maplibre.fakeMap.on.mock.calls.find(
			(call) => call[0] === 'click' && call[1] === 'catalog-map-place-hit-targets'
		)?.[2] as (event: unknown) => void;
		expect(maplibre.fakeMap.addLayer).toHaveBeenCalledWith(
			expect.objectContaining({
				id: 'catalog-map-shared-location-hit-targets',
				paint: expect.objectContaining({ 'circle-radius': 22 })
			})
		);
		expect(maplibre.fakeMap.addLayer).toHaveBeenCalledWith(
			expect.objectContaining({
				id: 'catalog-map-place-hit-targets',
				paint: expect.objectContaining({ 'circle-radius': 22 })
			})
		);

		sharedClick({
			features: [
				{
					properties: {
						type: 'location',
						label: 'Ethiopia',
						precisionLabel: 'Country-level area',
						placementCount: 8,
						uniqueCoffeeCount: 6,
						catalogIds: '[1,2,3,4,5,6]'
					}
				}
			]
		});
		placeClick({
			features: [{ properties: { type: 'place', catalogId: 42, placeId: 'place-id' } }]
		});
		sharedClick({
			features: [
				{
					properties: {
						type: 'location',
						label: 'Huila',
						precisionLabel: 'Region-level area',
						placementCount: 1,
						uniqueCoffeeCount: 1,
						catalogIds: '[99]',
						placeId: 'semantic-place-id'
					}
				}
			]
		});

		expect(onClusterSelect).toHaveBeenCalledWith({
			kind: 'location',
			label: 'Ethiopia',
			precisionLabel: 'Country-level area',
			mappedOriginCount: 8,
			coffeeMatchCount: 6,
			catalogIds: [1, 2, 3, 4, 5, 6],
			originLabels: ['Ethiopia']
		});
		expect(onPlaceSelect).toHaveBeenNthCalledWith(1, 42, 'place-id');
		expect(onPlaceSelect).toHaveBeenNthCalledWith(2, 99, 'semantic-place-id');
	});

	it('labels the region bubble under the pointer without exposing raw map data', async () => {
		render(CatalogMapCanvas, {
			items: [],
			center: [0, 18],
			zoom: 1.75,
			onViewportChange: vi.fn(),
			onPlaceSelect: vi.fn()
		});

		await waitFor(() => expect(maplibre.constructMap).toHaveBeenCalledOnce());
		loadMap();
		const hover = maplibre.fakeMap.on.mock.calls.find(
			(call) => call[0] === 'mouseenter' && call[1] === 'catalog-map-shared-location-hit-targets'
		)?.[2] as (event: unknown) => void;
		hover({
			lngLat: { lng: 38.7, lat: 9.1 },
			features: [
				{
					properties: {
						type: 'location',
						label: 'Sidama',
						precisionLabel: 'Region-level area',
						placementCount: 8,
						uniqueCoffeeCount: 6
					}
				}
			]
		});

		expect(maplibre.fakePopup.setLngLat).toHaveBeenCalledWith({ lng: 38.7, lat: 9.1 });
		const content = maplibre.fakePopup.setDOMContent.mock.calls.at(-1)?.[0] as HTMLElement;
		expect(content).toHaveTextContent('Sidama');
		expect(content).toHaveTextContent('Region-level area · 6 coffees');
	});

	it('normalizes antimeridian bounds and wrapped centers without committing a network search on pan or zoom', async () => {
		const onViewportChange = vi.fn();
		render(CatalogMapCanvas, {
			items: [],
			center: [0, 18],
			zoom: 1.75,
			onViewportChange,
			onPlaceSelect: vi.fn()
		});

		await waitFor(() => expect(maplibre.constructMap).toHaveBeenCalledOnce());
		loadMap();
		maplibre.fakeMap.getCenter.mockReturnValue({ lng: 190, lat: 18 });
		const moveend = maplibre.fakeMap.on.mock.calls.find(
			(call) => call[0] === 'moveend'
		)?.[1] as () => void;
		moveend();

		expect(onViewportChange).toHaveBeenCalledWith({
			center: [-170, 18],
			zoom: 1.75,
			bounds: { west: 170, south: -10, east: -170, north: 10 },
			commitSearch: false
		});
	});
});
