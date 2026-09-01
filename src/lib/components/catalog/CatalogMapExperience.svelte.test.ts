import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import '@testing-library/jest-dom/vitest';
import type { CatalogMapResponse } from '@purveyors/sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultCatalogUrlState } from '$lib/catalog/urlState';
import { DEFAULT_CATALOG_MAP_STATE } from '$lib/catalog/mapState';
import CatalogMapExperienceHarness from './__test-fixtures__/CatalogMapExperienceHarness.svelte';

vi.mock('$lib/components/catalog/CatalogMapCanvas.svelte', async () => ({
	default: (await import('./__test-fixtures__/CatalogMapCanvasHarness.svelte')).default
}));

function mapResponse(overrides: Partial<CatalogMapResponse> = {}): CatalogMapResponse {
	return {
		data: [
			{
				type: 'place',
				id: 'place-1:42',
				catalog_id: 42,
				place_id: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
				canonical_name: 'Huila',
				place_type: 'region',
				longitude: -75.55,
				latitude: 2.54,
				geographic_precision: 'region',
				coordinate_kind: 'centroid',
				place_provenance: 'reference_dataset',
				assignment_role: 'primary',
				assignment_provenance: 'deterministic_resolution',
				assignment_confidence: 0.94,
				elevation_min_masl: 1500,
				elevation_max_masl: 1900
			}
		],
		elevation_profile: null,
		meta: {
			resource: 'catalog-map',
			namespace: '/v1/catalog/map',
			version: 'v1',
			auth: { kind: 'api-key', role: null, apiPlan: 'viewer' },
			access: {
				publicOnly: true,
				showWholesale: false,
				wholesaleOnly: false,
				rowLimit: 100,
				limited: true,
				totalAvailable: 9,
				fineGrainedPlaces: false,
				viewportSearch: false,
				elevationProfile: false
			},
			effective: { zoom: 2, lens: 'catalog', place_id: null, bbox: null },
			totals: {
				unique_coffee_count: 9,
				placed_unique_coffee_count: 7,
				unplaced_unique_coffee_count: 2,
				placement_count: 8,
				mappable_placement_count: 7,
				viewport_placed_unique_coffee_count: 7,
				viewport_placement_count: 8
			},
			freshness: {
				generatedAt: '2026-09-01T12:00:00.000Z',
				cacheStatus: 'public',
				ttlSeconds: 60
			}
		},
		...overrides
	};
}

function renderExperience(canUseAdvancedMaps = false) {
	const onStateChange = vi.fn();
	const onElevationRangeChange = vi.fn();
	const onSelectCoffee = vi.fn(async () => true);
	const onSwitchToList = vi.fn();

	render(CatalogMapExperienceHarness, {
		initialState: { ...DEFAULT_CATALOG_MAP_STATE, view: 'map' },
		catalogState: createDefaultCatalogUrlState(),
		canUseAdvancedMaps,
		onStateChange,
		onElevationRangeChange,
		onSelectCoffee,
		onSwitchToList
	});

	return { onStateChange, onElevationRangeChange, onSelectCoffee, onSwitchToList };
}

describe('CatalogMapExperience', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('renders non-additive coverage labels and keeps gated controls honest', async () => {
		const fetchSpy = vi.fn(
			async (_input: RequestInfo | URL) =>
				new Response(JSON.stringify(mapResponse()), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				})
		);
		vi.stubGlobal('fetch', fetchSpy);

		renderExperience(false);

		await waitFor(() => expect(screen.getByText('9')).toBeInTheDocument());
		expect(
			screen.getByText('Map counts are placements. Multi-origin coffees can appear more than once.')
		).toBeInTheDocument();
		expect(screen.getByText('2')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Elevation' })).toBeDisabled();
		expect(screen.getByText('Existing catalog results remain available')).toBeInTheDocument();
		expect(fetchSpy).toHaveBeenCalledTimes(1);
		expect(fetchSpy.mock.calls[0][0].toString()).toContain('/api/catalog/map?');
		expect(fetchSpy.mock.calls[0][0].toString()).toContain('lens=catalog');
	});

	it('hydrates a single entitled row instead of opening raw map data', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(JSON.stringify(mapResponse()), {
						status: 200,
						headers: { 'Content-Type': 'application/json' }
					})
			)
		);
		const { onSelectCoffee } = renderExperience(true);

		const placeButton = await screen.findByRole('button', { name: /Huila/ });
		await fireEvent.click(placeButton);

		expect(onSelectCoffee).toHaveBeenCalledWith(42);
	});

	it('keeps the list rail and a clear recovery path when map data fails', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(JSON.stringify({ error: { message: 'Projection unavailable' } }), {
						status: 503,
						headers: { 'Content-Type': 'application/json' }
					})
			)
		);
		renderExperience(true);

		await waitFor(() => expect(screen.getByText('Map data unavailable.')).toBeInTheDocument());
		expect(screen.getByRole('alert')).toHaveTextContent('Projection unavailable');
		expect(screen.getByText('Existing catalog results remain available')).toBeInTheDocument();
	});

	it('keeps a panned viewport pending until the user explicitly searches it', async () => {
		const responseBody = mapResponse();
		responseBody.meta.access.viewportSearch = true;
		const fetchSpy = vi.fn(
			async (_input: RequestInfo | URL) =>
				new Response(JSON.stringify(responseBody), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				})
		);
		vi.stubGlobal('fetch', fetchSpy);
		renderExperience(true);

		await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
		await fireEvent.click(screen.getByRole('button', { name: 'Simulate map pan' }));

		expect(screen.getByRole('button', { name: 'Search this area' })).toBeInTheDocument();
		expect(fetchSpy).toHaveBeenCalledTimes(1);

		await fireEvent.click(screen.getByRole('button', { name: 'Search this area' }));
		await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
		expect(fetchSpy.mock.calls[1][0].toString()).toContain('bbox=-20%2C-10%2C40%2C50');
	});

	it('does not toggle the mobile sheet again after a drag settles it', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(JSON.stringify(mapResponse()), {
						status: 200,
						headers: { 'Content-Type': 'application/json' }
					})
			)
		);
		renderExperience(true);

		await screen.findByText('9');
		const sheetToggle = screen.getByRole('button', { name: /Catalog results/ });
		await fireEvent.pointerDown(sheetToggle, { clientY: 200, pointerId: 1 });
		await fireEvent.pointerUp(sheetToggle, { clientY: 100, pointerId: 1 });
		await fireEvent.click(sheetToggle);

		expect(sheetToggle).toHaveAttribute('aria-expanded', 'true');
	});

	it('keeps every returned feature keyboard-reachable in the accessible list', async () => {
		const clusters = Array.from({ length: 13 }, (_, index) => ({
			type: 'cluster',
			id: `cluster-${index}`,
			longitude: index,
			latitude: index,
			bounds: { west: index, south: index, east: index + 1, north: index + 1 },
			placement_count: index + 1,
			unique_coffee_count: index + 1
		}));
		const fetchSpy = vi.fn(
			async () =>
				new Response(
					JSON.stringify(mapResponse({ data: clusters as CatalogMapResponse['data'] })),
					{
						status: 200,
						headers: { 'Content-Type': 'application/json' }
					}
				)
		);
		vi.stubGlobal('fetch', fetchSpy);
		renderExperience(false);

		await waitFor(() => {
			const buttons = screen.getAllByRole('button', { name: /placements.*zoom to cluster/ });
			expect(buttons).toHaveLength(13);
		});
	});

	it('does not commit an accessible cluster bbox without viewport access', async () => {
		const cluster = {
			type: 'cluster',
			id: 'cluster-1',
			longitude: 10,
			latitude: 20,
			bounds: { west: 5, south: 15, east: 15, north: 25 },
			placement_count: 4,
			unique_coffee_count: 3
		};
		const fetchSpy = vi.fn(
			async () =>
				new Response(
					JSON.stringify(mapResponse({ data: [cluster] as CatalogMapResponse['data'] })),
					{
						status: 200,
						headers: { 'Content-Type': 'application/json' }
					}
				)
		);
		vi.stubGlobal('fetch', fetchSpy);
		const { onStateChange } = renderExperience(false);

		const clusterButton = await screen.findByRole('button', {
			name: /4 placements.*zoom to cluster/
		});
		await fireEvent.click(clusterButton);

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		expect(onStateChange).toHaveBeenLastCalledWith(
			expect.objectContaining({ center: [10, 20], bbox: null })
		);
	});
});
