import { render, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CatalogMapCanvas from './CatalogMapCanvas.svelte';

const maplibre = vi.hoisted(() => {
	const setWorkerUrl = vi.fn();
	const constructMap = vi.fn();
	const fakeMap = {
		addControl: vi.fn(),
		addSource: vi.fn(),
		addLayer: vi.fn(),
		on: vi.fn(),
		remove: vi.fn(),
		getSource: vi.fn(),
		getCenter: vi.fn(() => ({ lng: 0, lat: 18 })),
		getZoom: vi.fn(() => 1.75),
		getBounds: vi.fn(() => ({
			getWest: () => 170,
			getSouth: () => -10,
			getEast: () => 190,
			getNorth: () => 10
		})),
		fitBounds: vi.fn(),
		jumpTo: vi.fn()
	};

	return { setWorkerUrl, constructMap, fakeMap };
});

vi.mock('maplibre-gl', () => ({
	Map: vi.fn(function MapMock() {
		maplibre.constructMap();
		return maplibre.fakeMap;
	}),
	NavigationControl: vi.fn(function NavigationControlMock() {}),
	setWorkerUrl: maplibre.setWorkerUrl
}));

describe('CatalogMapCanvas worker integration', () => {
	beforeEach(() => {
		vi.clearAllMocks();
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

	it('normalizes antimeridian bounds and does not commit cluster search without access', async () => {
		const onViewportChange = vi.fn();
		render(CatalogMapCanvas, {
			items: [],
			lens: 'catalog',
			center: [0, 18],
			zoom: 1.75,
			canSearchViewport: false,
			onViewportChange,
			onPlaceSelect: vi.fn()
		});

		await waitFor(() => expect(maplibre.constructMap).toHaveBeenCalledOnce());
		const load = maplibre.fakeMap.on.mock.calls.find(
			(call) => call[0] === 'load'
		)?.[1] as () => void;
		load();
		const clusterClick = maplibre.fakeMap.on.mock.calls.find(
			(call) => call[0] === 'click' && call[1] === 'catalog-map-clusters'
		)?.[2] as (event: unknown) => void;
		const moveend = maplibre.fakeMap.on.mock.calls.find(
			(call) => call[0] === 'moveend'
		)?.[1] as () => void;

		clusterClick({
			features: [{ properties: { type: 'cluster', west: 170, south: -10, east: -170, north: 10 } }]
		});
		moveend();

		expect(maplibre.fakeMap.fitBounds).toHaveBeenCalledWith(
			[
				[170, -10],
				[190, 10]
			],
			expect.any(Object)
		);
		expect(onViewportChange).toHaveBeenCalledWith({
			center: [0, 18],
			zoom: 1.75,
			bounds: { west: 170, south: -10, east: -170, north: 10 },
			commitSearch: false
		});
	});
});
