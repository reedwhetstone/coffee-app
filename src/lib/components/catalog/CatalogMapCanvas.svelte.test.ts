import { render, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CatalogMapCanvas from './CatalogMapCanvas.svelte';

const maplibre = vi.hoisted(() => {
	const setWorkerUrl = vi.fn();
	const constructMap = vi.fn();
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
	const fakeMap = {
		addControl: vi.fn(),
		addSource: vi.fn(),
		addLayer: vi.fn(),
		on: vi.fn(),
		remove: vi.fn(),
		resize: vi.fn(),
		getCanvas: vi.fn(() => ({ style: { cursor: '' } })),
		getSource: vi.fn(() => fakeSource),
		getCenter: vi.fn(() => ({ lng: 0, lat: 18 })),
		getZoom: vi.fn(() => 1.75),
		getBounds: vi.fn(() => ({
			getWest: () => 170,
			getSouth: () => -10,
			getEast: () => 190,
			getNorth: () => 10
		})),
		easeTo: vi.fn(),
		jumpTo: vi.fn()
	};

	return { setWorkerUrl, constructMap, fakeSource, fakeMap };
});

vi.mock('maplibre-gl', () => ({
	Map: vi.fn(function MapMock() {
		maplibre.constructMap();
		return maplibre.fakeMap;
	}),
	NavigationControl: vi.fn(function NavigationControlMock() {}),
	setWorkerUrl: maplibre.setWorkerUrl
}));

function loadMap() {
	const load = maplibre.fakeMap.on.mock.calls.find((call) => call[0] === 'load')?.[1] as () => void;
	load();
}

describe('CatalogMapCanvas worker integration', () => {
	beforeEach(() => {
		vi.clearAllMocks();
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
			lens: 'catalog',
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
			lens: 'catalog',
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

	it('shows shared-location context and keeps single-origin selection wired to details', async () => {
		const onClusterSelect = vi.fn();
		const onPlaceSelect = vi.fn();
		render(CatalogMapCanvas, {
			items: [],
			lens: 'catalog',
			center: [0, 18],
			zoom: 1.75,
			onViewportChange: vi.fn(),
			onPlaceSelect,
			onClusterSelect
		});

		await waitFor(() => expect(maplibre.constructMap).toHaveBeenCalledOnce());
		loadMap();
		const sharedClick = maplibre.fakeMap.on.mock.calls.find(
			(call) => call[0] === 'click' && call[1] === 'catalog-map-shared-locations'
		)?.[2] as (event: unknown) => void;
		const placeClick = maplibre.fakeMap.on.mock.calls.find(
			(call) => call[0] === 'click' && call[1] === 'catalog-map-places'
		)?.[2] as (event: unknown) => void;

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

		expect(onClusterSelect).toHaveBeenCalledWith({
			kind: 'location',
			label: 'Ethiopia',
			precisionLabel: 'Country-level area',
			mappedOriginCount: 8,
			coffeeMatchCount: 6,
			catalogIds: [1, 2, 3, 4, 5, 6],
			originLabels: ['Ethiopia']
		});
		expect(onPlaceSelect).toHaveBeenCalledWith(42, 'place-id');
	});

	it('normalizes antimeridian bounds and wrapped centers without committing a network search on pan or zoom', async () => {
		const onViewportChange = vi.fn();
		render(CatalogMapCanvas, {
			items: [],
			lens: 'catalog',
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
