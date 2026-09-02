import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import '@testing-library/jest-dom/vitest';
import type { CatalogMapResponse } from '@purveyors/sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultCatalogUrlState } from '$lib/catalog/urlState';
import { DEFAULT_CATALOG_MAP_STATE, type CatalogMapUrlState } from '$lib/catalog/mapState';
import type { CoffeeCatalog } from '$lib/types/component.types';
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

function renderExperience(
	canUseAdvancedMaps = false,
	initialState: CatalogMapUrlState = {
		...DEFAULT_CATALOG_MAP_STATE,
		view: 'map' as const
	}
) {
	const onStateChange = vi.fn();
	const onSelectCoffee = vi.fn(
		async (catalogId: number) =>
			({
				id: catalogId,
				name: catalogId === 42 ? 'Sidama Natural' : `Coffee ${catalogId}`
			}) as CoffeeCatalog
	);
	const onClearCoffee = vi.fn();
	const onSwitchToList = vi.fn();

	render(CatalogMapExperienceHarness, {
		initialState,
		catalogState: createDefaultCatalogUrlState(),
		canUseAdvancedMaps,
		onStateChange,
		onSelectCoffee,
		onClearCoffee,
		onSwitchToList
	});

	return { onStateChange, onSelectCoffee, onClearCoffee, onSwitchToList };
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
			screen.getByText(
				/Browse coffees by origin\. Terrain color shows approximate elevation; bubble numbers count mapped placements/
			)
		).toBeInTheDocument();
		expect(screen.getByText('2')).toBeInTheDocument();
		expect(screen.getByLabelText('Terrain elevation key')).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Elevation' })).not.toBeInTheDocument();
		expect(screen.getByText('Existing catalog results remain available')).toBeInTheDocument();
		expect(document.body).not.toHaveTextContent(/\b(canonical|entitled|viewport|evidence)\b/i);
		expect(fetchSpy).toHaveBeenCalledTimes(1);
		expect(fetchSpy.mock.calls[0][0].toString()).toContain('/api/catalog/map?');
		expect(fetchSpy.mock.calls[0][0].toString()).toContain('lens=catalog');
		expect(fetchSpy.mock.calls[0][0].toString()).toContain('zoom=22');
		expect(fetchSpy.mock.calls[0][0].toString()).toContain('projection=locations');
	});

	it('gives the mobile map column the full responsive viewport height', async () => {
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
		expect(screen.getByRole('button', { name: 'Simulate map pan' }).parentElement).toHaveClass(
			'h-full'
		);
	});

	it('keeps terrain standard without a separate map lens or range form', async () => {
		const fetchSpy = vi.fn(
			async (_input: RequestInfo | URL) =>
				new Response(JSON.stringify(mapResponse()), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				})
		);
		vi.stubGlobal('fetch', fetchSpy);
		renderExperience(true);

		await screen.findByText('9');
		expect(screen.queryByRole('button', { name: 'Catalog' })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Elevation' })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Apply range' })).not.toBeInTheDocument();
		expect(screen.getByText('Approx. terrain elevation · MASL')).toBeInTheDocument();
		expect(screen.getByLabelText('Below 1,000 MASL')).toBeInTheDocument();
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
		const { onSelectCoffee, onClearCoffee } = renderExperience(true);

		await screen.findByText('9');
		await fireEvent.click(screen.getByRole('button', { name: 'Simulate single origin selection' }));

		expect(onSelectCoffee).toHaveBeenCalledWith(42);
		expect(await screen.findByText('Selected coffee detail: Sidama Natural')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Back to map results' })).toBeInTheDocument();

		const clearCountBeforeClose = onClearCoffee.mock.calls.length;
		await fireEvent.click(screen.getByRole('button', { name: 'Close coffee detail to map' }));
		expect(onClearCoffee).toHaveBeenCalledTimes(clearCountBeforeClose + 1);
		expect(screen.getByRole('button', { name: /Catalog results/ })).toHaveAttribute(
			'aria-expanded',
			'false'
		);
	});

	it('opens a selected-area rail with readable coffees when a visual cluster is selected', async () => {
		const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
			const url = input.toString();
			const body = url.startsWith('/api/catalog/map?')
				? mapResponse()
				: {
						data: [
							{
								id: 42,
								name: 'Sidama Natural',
								source: 'Royal Coffee',
								country: 'Ethiopia',
								region: 'Sidama',
								processing: 'Natural',
								cost_lb: 7.25,
								price_per_lb: 7.25,
								price_tiers: null
							},
							{
								id: 43,
								name: 'Kenya AA',
								source: 'Genuine Origin',
								country: 'Kenya',
								region: 'Nyeri',
								processing: 'Washed',
								cost_lb: 8.5,
								price_per_lb: 8.5,
								price_tiers: null
							}
						]
					};
			return new Response(JSON.stringify(body), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			});
		});
		vi.stubGlobal('fetch', fetchSpy);
		renderExperience(true);

		await screen.findByText('9');
		await fireEvent.click(screen.getByRole('button', { name: 'Simulate cluster selection' }));

		expect(await screen.findByText('Sidama Natural')).toBeInTheDocument();
		expect(screen.getByText('Kenya AA')).toBeInTheDocument();
		expect(screen.getByText('Ethiopia and Kenya')).toBeInTheDocument();
		expect(screen.getByText(/2 coffees across 12 mapped placements/)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'All results' })).toBeInTheDocument();
		expect(fetchSpy.mock.calls[1][0].toString()).toContain('ids=42%2C43');
	});

	it('describes broad semantic locations honestly and opens their coffees', async () => {
		const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
			const body = input.toString().startsWith('/api/catalog/map?')
				? mapResponse()
				: {
						data: [
							{
								id: 42,
								name: 'Ethiopia Guji',
								source: 'Ally Coffee',
								country: 'Ethiopia',
								region: 'Guji',
								processing: 'Natural',
								cost_lb: 6.8,
								price_per_lb: 6.8,
								price_tiers: null
							}
						]
					};
			return new Response(JSON.stringify(body), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			});
		});
		vi.stubGlobal('fetch', fetchSpy);
		renderExperience(true);

		await screen.findByText('9');
		await fireEvent.click(screen.getByRole('button', { name: 'Simulate location selection' }));

		expect(await screen.findByText('Ethiopia Guji')).toBeInTheDocument();
		expect(screen.getByText('Country-level area')).toBeInTheDocument();
		expect(
			screen.getByText(/broad geographic center, not an exact farm location/i)
		).toBeInTheDocument();
	});

	it('hydrates large location groups in bounded pages', async () => {
		const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
			const url = input.toString();
			if (url.startsWith('/api/catalog/map?')) {
				return new Response(JSON.stringify(mapResponse()), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				});
			}
			const params = new URL(url, 'https://app.test').searchParams;
			const ids = (params.get('ids') ?? '').split(',').map(Number);
			return new Response(
				JSON.stringify({
					data: ids.map((id) => ({
						id,
						name: `Coffee ${id}`,
						source: 'Test supplier',
						country: 'Ethiopia',
						region: null,
						processing: null,
						cost_lb: null,
						price_per_lb: null,
						price_tiers: null
					}))
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } }
			);
		});
		vi.stubGlobal('fetch', fetchSpy);
		renderExperience(true);

		await screen.findByText('9');
		await fireEvent.click(
			screen.getByRole('button', { name: 'Simulate large location selection' })
		);
		expect(await screen.findByText('Coffee 25')).toBeInTheDocument();
		expect(screen.queryByText('Coffee 26')).not.toBeInTheDocument();

		await fireEvent.click(screen.getByRole('button', { name: 'Show more coffees' }));
		expect(await screen.findByText('Coffee 30')).toBeInTheDocument();
		expect(fetchSpy.mock.calls[1][0].toString()).toContain('limit=25');
		expect(fetchSpy.mock.calls[2][0].toString()).toContain('limit=5');
	});

	it('opens grouped coffee detail without losing the selected area', async () => {
		const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
			const body = input.toString().startsWith('/api/catalog/map?')
				? mapResponse()
				: {
						data: [
							{
								id: 42,
								name: 'Sidama Natural',
								source: 'Royal Coffee',
								country: 'Ethiopia',
								region: 'Sidama',
								processing: 'Natural',
								cost_lb: 7.25,
								price_per_lb: 7.25,
								price_tiers: null
							}
						]
					};
			return new Response(JSON.stringify(body), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			});
		});
		vi.stubGlobal('fetch', fetchSpy);
		renderExperience(true);

		await screen.findByText('9');
		await fireEvent.click(screen.getByRole('button', { name: 'Simulate cluster selection' }));
		await screen.findByText('Sidama Natural');
		await fireEvent.click(screen.getByRole('button', { name: /Sidama Natural/ }));

		expect(await screen.findByText('Selected coffee detail: Sidama Natural')).toBeInTheDocument();
		expect(screen.queryByText('Existing catalog results remain available')).not.toBeInTheDocument();
		const backButton = screen.getByRole('button', { name: 'Back to Selected map area' });
		await fireEvent.click(backButton);
		expect(screen.getByRole('button', { name: /Sidama Natural/ })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'All results' })).toBeInTheDocument();
	});

	it('closes grouped coffee detail to the map without discarding the selected area', async () => {
		const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
			const body = input.toString().startsWith('/api/catalog/map?')
				? mapResponse()
				: {
						data: [
							{
								id: 42,
								name: 'Sidama Natural',
								source: 'Royal Coffee',
								country: 'Ethiopia',
								region: 'Sidama',
								processing: 'Natural',
								cost_lb: 7.25,
								price_per_lb: 7.25,
								price_tiers: null
							}
						]
					};
			return new Response(JSON.stringify(body), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			});
		});
		vi.stubGlobal('fetch', fetchSpy);
		renderExperience(true);

		await screen.findByText('9');
		await fireEvent.click(screen.getByRole('button', { name: 'Simulate cluster selection' }));
		await screen.findByText('Sidama Natural');
		await fireEvent.click(screen.getByRole('button', { name: /Sidama Natural/ }));
		await screen.findByText('Selected coffee detail: Sidama Natural');

		await fireEvent.click(screen.getByRole('button', { name: 'Close coffee detail to map' }));

		const sheetToggle = screen.getByRole('button', { name: /Selected map area/ });
		expect(sheetToggle).toHaveAttribute('aria-expanded', 'false');
		expect(screen.queryByText('Selected coffee detail: Sidama Natural')).not.toBeInTheDocument();

		await fireEvent.click(sheetToggle);
		expect(sheetToggle).toHaveAttribute('aria-expanded', 'true');
		expect(screen.getByRole('button', { name: /Sidama Natural/ })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'All results' })).toBeInTheDocument();
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

		await waitFor(() =>
			expect(screen.getByText("We couldn't refresh the map.")).toBeInTheDocument()
		);
		expect(screen.getByRole('alert')).not.toHaveTextContent('Projection unavailable');
		expect(screen.getByRole('alert')).toHaveTextContent(
			'Your catalog results are still available.'
		);
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

	it('keeps returned features keyboard-reachable when the accessible list is opened', async () => {
		const clusters = Array.from({ length: 49 }, (_, index) => ({
			type: 'cluster',
			id: `cluster-${index}`,
			longitude: index,
			latitude: index,
			bounds: { west: index, south: index, east: index + 1, north: index + 1 },
			placement_count: index + 1,
			unique_coffee_count: index + 1,
			catalog_ids: [index + 1]
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

		await fireEvent.click(await screen.findByText(/Browse map locations/));
		await waitFor(() => {
			const buttons = screen.getAllByRole('button', { name: /coffee.*zoom in to explore/i });
			expect(buttons).toHaveLength(48);
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Show more locations' }));
		expect(
			await screen.findByRole('button', { name: /49 coffees.*zoom in to explore/i })
		).toBeInTheDocument();
	});

	it('clears stale map features when a refreshed request fails', async () => {
		const responseBody = mapResponse();
		responseBody.meta.access.viewportSearch = true;
		const fetchSpy = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(JSON.stringify(responseBody), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				})
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ error: { message: 'Projection unavailable' } }), {
					status: 503,
					headers: { 'Content-Type': 'application/json' }
				})
			);
		vi.stubGlobal('fetch', fetchSpy);
		renderExperience(true);

		await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
		await fireEvent.click(screen.getByRole('button', { name: 'Simulate map pan' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Search this area' }));
		await screen.findByText("We couldn't refresh the map.");

		expect(await screen.findByText('Browse map locations (0)')).toBeInTheDocument();
	});

	it('does not commit an accessible cluster bbox without viewport access', async () => {
		const cluster = {
			type: 'cluster',
			id: 'cluster-1',
			longitude: 10,
			latitude: 20,
			bounds: { west: 5, south: 15, east: 15, north: 25 },
			placement_count: 4,
			unique_coffee_count: 3,
			catalog_ids: [1, 2, 3]
		};
		const fetchSpy = vi.fn(
			async (_input: RequestInfo | URL) =>
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

		await fireEvent.click(await screen.findByText(/Browse map locations/));
		const clusterButton = await screen.findByRole('button', {
			name: /3 coffees.*zoom in to explore/i
		});
		await fireEvent.click(clusterButton);

		expect(fetchSpy).toHaveBeenCalledTimes(2);
		expect(fetchSpy.mock.calls[1][0].toString()).toContain('ids=1%2C2%2C3');
		expect(onStateChange).toHaveBeenLastCalledWith(
			expect.objectContaining({ center: [10, 20], bbox: null })
		);
	});

	it('reconciles spatial scope stripped by lenient access handling', async () => {
		const fetchSpy = vi.fn(
			async () =>
				new Response(JSON.stringify(mapResponse()), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				})
		);
		vi.stubGlobal('fetch', fetchSpy);
		const { onStateChange } = renderExperience(false, {
			...DEFAULT_CATALOG_MAP_STATE,
			view: 'map',
			bbox: { west: -80, south: -10, east: -60, north: 20 },
			placeId: '6ba7b810-9dad-41d1-80b4-00c04fd430c8'
		});

		await waitFor(() =>
			expect(onStateChange).toHaveBeenCalledWith(
				expect.objectContaining({ bbox: null, placeId: null })
			)
		);
		await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
	});
});
