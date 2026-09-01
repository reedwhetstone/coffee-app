import { render, waitFor } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import CatalogMapCanvas from './CatalogMapCanvas.svelte';

const maplibre = vi.hoisted(() => {
	const setWorkerUrl = vi.fn();
	const constructMap = vi.fn();
	const fakeMap = {
		addControl: vi.fn(),
		on: vi.fn(),
		remove: vi.fn(),
		getSource: vi.fn(),
		getCenter: vi.fn(() => ({ lng: 0, lat: 18 })),
		getZoom: vi.fn(() => 1.75),
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
});
