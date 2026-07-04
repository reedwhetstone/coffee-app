import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { get } from 'svelte/store';
import CatalogPage from './+page.svelte';
import type { PageData } from './$types';
import { createCatalogProofSummary } from '$lib/catalog/proofSummary';
import { filterStore } from '$lib/stores/filterStore';

const { goto, pageState } = vi.hoisted(() => ({
	goto: vi.fn(),
	pageState: { url: new URL('https://app.test/catalog') }
}));

vi.mock('$app/navigation', () => ({ goto }));
vi.mock('$app/state', () => ({ page: pageState }));

function createData(overrides: Partial<PageData> = {}): PageData {
	return {
		session: null,
		user: null,
		role: 'viewer',
		data: [
			{
				id: 1,
				name: 'Process Lot',
				source: 'Example Importer',
				country: 'Colombia',
				region: 'Huila',
				continent: 'South America',
				processing: 'Washed',
				price_per_lb: 8.5,
				cost_lb: 8.5,
				price_tiers: null,
				wholesale: false,
				link: null,
				process: {
					base_method: 'natural',
					fermentation_type: 'anaerobic',
					additives: ['fruit'],
					additive_detail: null,
					fermentation_duration_hours: null,
					drying_method: 'raised_bed',
					notes: null,
					disclosure_level: 'high_detail',
					confidence: 0.86,
					evidence_available: false
				}
			}
		],
		trainingData: [],
		initialCatalogState: {
			filters: {},
			sortField: null,
			sortDirection: null,
			showWholesale: false,
			wholesaleOnly: false,
			pagination: { page: 1, limit: 15 }
		},
		catalogAccess: {
			canViewPublicCatalog: true,
			canViewFullCatalog: false,
			canViewWholesale: false,
			canUseBasicFilters: true,
			canUseAdvancedFilters: false,
			canUseProcessFacets: false,
			canUsePriceScoreRanges: false,
			canUseAdvancedSorts: false,
			canViewPremiumFilterMetadata: false,
			canUseSemanticSearch: false,
			canUseBeanMatching: false,
			canUseSavedSearches: false,
			canExport: false
		},
		catalogAccessNotice: null,
		pagination: {
			page: 1,
			limit: 15,
			total: 1,
			totalPages: 1,
			hasNext: false,
			hasPrev: false
		},
		meta: {},
		ppiAccess: false,
		trackedLotIds: [],
		briefMatchSummaries: [],
		...overrides
	} as unknown as PageData;
}

function renderCatalog(data: PageData) {
	return render(CatalogPage, { data });
}

function proof(overrides: Record<string, unknown> = {}) {
	return createCatalogProofSummary({
		country: 'Colombia',
		region: 'Huila',
		source: 'Example Importer',
		stocked: true,
		stocked_date: '2026-04-01',
		price_per_lb: 8.5,
		price_tiers: [{ min_lbs: 1, price: 8.5 }],
		wholesale: false,
		processing_base_method: 'washed',
		drying_method: 'raised_bed',
		processing_disclosure_level: 'high_detail',
		processing_confidence: 0.86,
		processing_evidence_available: true,
		...overrides
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	pageState.url = new URL('https://app.test/catalog');
	filterStore.initializeForRoute('__test-reset__', []);
	vi.stubGlobal(
		'fetch',
		vi.fn(async (url: string, init?: RequestInit) => {
			if (url.startsWith('/api/catalog/1/track') && init?.method === 'PUT') {
				return new Response(JSON.stringify({ tracked: true }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				});
			}

			if (url.startsWith('/api/catalog/filters')) {
				return new Response(
					JSON.stringify({
						countries: ['Colombia'],
						processing: ['Washed'],
						processing_base_method: ['Natural']
					}),
					{ status: 200, headers: { 'Content-Type': 'application/json' } }
				);
			}

			if (url.startsWith('/api/catalog/origin-price-stats')) {
				return new Response(
					JSON.stringify({
						originPriceStats: [
							{
								origin: 'Colombia',
								median: 4,
								q1: 3,
								q3: 5,
								min: 2,
								max: 6,
								sample_size: 12,
								supplier_count: 4
							}
						]
					}),
					{ status: 200, headers: { 'Content-Type': 'application/json' } }
				);
			}

			if (url.startsWith('/v1/catalog/1/similar')) {
				return new Response(
					JSON.stringify({
						data: {
							target: {
								id: 1,
								name: 'Process Lot',
								source: 'Example Importer',
								origin: 'Huila',
								country: 'Colombia',
								continent: 'South America',
								processing: 'Washed',
								processing_base_method: 'washed',
								fermentation_type: null,
								drying_method: null,
								stocked: true,
								arrival_date: '2026-03-15',
								stocked_date: '2026-04-01',
								proof: proof(),
								price_per_lb: 8.5,
								price_tiers: [{ min_lbs: 1, price: 8.5 }],
								cost_lb: 9,
								pricing: {
									price_per_lb: 8.5,
									price_tiers: [{ min_lbs: 1, price: 8.5 }],
									cost_lb: 9,
									baseline_quantity_lbs: 1,
									baseline_price_per_lb: 8.5,
									baseline_source: 'price_per_lb'
								}
							},
							matches: [
								{
									coffee: {
										id: 2,
										name: 'Member Match Lot',
										source: 'Match Importer',
										origin: 'Huila',
										country: 'Colombia',
										continent: 'South America',
										processing: 'Washed',
										processing_base_method: 'washed',
										fermentation_type: null,
										drying_method: null,
										stocked: true,
										arrival_date: '2026-03-20',
										stocked_date: '2026-04-02',
										proof: proof({
											source: 'Match Importer',
											stocked_date: '2026-04-02',
											price_per_lb: 7.5,
											price_tiers: [{ min_lbs: 1, price: 7.5 }]
										})
									},
									pricing: {
										price_per_lb: 7.5,
										price_tiers: [{ min_lbs: 1, price: 7.5 }],
										cost_lb: 8,
										baseline_quantity_lbs: 1,
										baseline_price_per_lb: 7.5,
										baseline_source: 'price_per_lb'
									},
									price_delta_1lb: { amount: -1, percent: -11.8, currency: 'USD' },
									score: {
										average: 0.89,
										dimensions: { origin: 0.91, processing: 0.87, tasting: 0.85 },
										chunk_matches: 2
									},
									match: {
										category: 'likely_same',
										confidence: 'medium_beta',
										beta: true,
										language: 'Beta likely same coffee candidate.'
									},
									explanation: {
										summary: 'Beta similarity score.',
										signals: ['Origin similarity 0.91']
									}
								}
							]
						},
						meta: { copy: { confidence: 'Beta confidence copy.' } }
					}),
					{ status: 200, headers: { 'Content-Type': 'application/json' } }
				);
			}

			return new Response(JSON.stringify({ data: [], pagination: null }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			});
		})
	);
});

describe('/catalog intelligence connective tissue', () => {
	it('frames the catalog as supply evidence behind market intelligence with analytics links', () => {
		renderCatalog(createData());

		expect(screen.getByText('Supply evidence layer')).toBeInTheDocument();
		expect(
			screen.getByText(
				/Inspect the row-level supply substrate behind Parchment Market Index reads/i
			)
		).toBeInTheDocument();
		expect(screen.getByText('Active rows in this query')).toBeInTheDocument();
		expect(screen.getByText('Origins shown on this page')).toBeInTheDocument();
		expect(screen.getByText('Suppliers shown on this page')).toBeInTheDocument();
		expect(screen.getByText('Priced rows shown')).toBeInTheDocument();

		expect(screen.getByRole('link', { name: 'Open Parchment Market Index' })).toHaveAttribute(
			'href',
			'/analytics'
		);
		expect(screen.getByRole('link', { name: 'Preview supplier comparison gate' })).toHaveAttribute(
			'href',
			'/analytics'
		);
		expect(screen.queryByText(/save sourcing research/i)).not.toBeInTheDocument();
	});

	it('deep-links to supplier comparison only when Parchment Intelligence access makes the anchor concrete', () => {
		renderCatalog(
			createData({
				session: { access_token: 'ppi-token' } as PageData['session'],
				ppiAccess: true
			} as unknown as Partial<PageData>)
		);

		expect(
			screen.getByRole('link', { name: 'Review supplier comparison evidence' })
		).toHaveAttribute('href', '/analytics#supplier-comparison');
		expect(
			screen.queryByText('Need workflow leverage from this supply layer?')
		).not.toBeInTheDocument();
	});

	it('routes empty catalog queries back to the broader market read instead of pretending a saved workflow exists', () => {
		renderCatalog(
			createData({
				data: [],
				trainingData: [],
				pagination: {
					page: 1,
					limit: 15,
					total: 0,
					totalPages: 0,
					hasNext: false,
					hasPrev: false
				}
			} as unknown as Partial<PageData>)
		);

		expect(screen.getByText('No catalog rows match this supply query')).toBeInTheDocument();
		expect(
			screen.getByText(/review broader origin, supplier, and pricing evidence/i)
		).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Review broader Market Index' })).toHaveAttribute(
			'href',
			'/analytics'
		);
	});

	it('keeps existing rows visible with a quiet pending indicator during a filter refetch instead of the full skeleton', async () => {
		vi.mocked(fetch).mockImplementation(async (input: URL | RequestInfo) => {
			const url =
				typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
			if (url.startsWith('/api/catalog/filters')) {
				return new Response(JSON.stringify({ countries: ['Colombia'] }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				});
			}
			if (url.startsWith('/api/catalog/origin-price-stats')) {
				return new Response(JSON.stringify({ originPriceStats: [] }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				});
			}
			// Hold the catalog refetch pending so the refetch state stays visible.
			if (url.startsWith('/api/catalog?')) {
				return new Promise<Response>(() => {});
			}
			return new Response(JSON.stringify({ data: [], pagination: null }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			});
		});

		renderCatalog(createData());

		expect(screen.getByText('Process Lot')).toBeInTheDocument();
		await waitFor(() => expect(get(filterStore).routeId).toBe('/catalog'));

		filterStore.setFilter('name', 'kenya');

		await waitFor(() => expect(get(filterStore).isRefetching).toBe(true));

		// Stale rows stay on screen; the page is not replaced by the full skeleton.
		expect(screen.getByText('Process Lot')).toBeInTheDocument();
		expect(screen.getByText('Green Coffee Catalog')).toBeInTheDocument();
		expect(screen.getByText('Updating results')).toBeInTheDocument();
	});

	it('rehydrates and opens a catalog coffee deep link after prior catalog navigation', async () => {
		const initialData = createData();
		const deepLinkedLot = {
			...initialData.data[0],
			id: 99,
			name: 'Deep Link Lot',
			source: 'Canvas Importer',
			country: 'Kenya',
			region: 'Nyeri'
		};

		filterStore.initializeForRoute(
			'/catalog',
			initialData.data as unknown as Record<string, unknown>[],
			{
				catalogUrlState: initialData.initialCatalogState,
				serverData: initialData.data as unknown as Record<string, unknown>[],
				pagination: initialData.pagination
			}
		);
		pageState.url = new URL('https://app.test/catalog?coffee=99');

		renderCatalog(
			createData({
				data: [deepLinkedLot, initialData.data[0]],
				pagination: {
					page: 1,
					limit: 15,
					total: 2,
					totalPages: 1,
					hasNext: false,
					hasPrev: false
				}
			} as unknown as Partial<PageData>)
		);

		await waitFor(() => {
			expect(screen.getAllByText('Deep Link Lot').length).toBeGreaterThanOrEqual(2);
		});
		expect(screen.getByRole('tablist', { name: 'Coffee detail tabs' })).toBeInTheDocument();
	});

	it('gates watchlist toggles until streamed tracked ids resolve', async () => {
		let resolveTrackedIds: (ids: number[]) => void = () => {};
		const trackedLotIds = new Promise<number[]>((resolve) => {
			resolveTrackedIds = resolve;
		});

		renderCatalog(
			createData({
				session: { access_token: 'member-token' } as PageData['session'],
				role: 'member',
				trackedLotIds
			} as unknown as Partial<PageData>)
		);

		expect(
			screen.queryByRole('button', { name: /track process lot|untrack process lot/i })
		).not.toBeInTheDocument();
		expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/track'))).toBe(
			false
		);

		resolveTrackedIds([1]);

		const toggle = await screen.findByRole('button', { name: /untrack process lot/i });
		await fireEvent.click(toggle);

		expect(fetch).toHaveBeenCalledWith(
			'/api/catalog/1/track',
			expect.objectContaining({ method: 'PUT' })
		);
	});
});

describe('/catalog price intelligence', () => {
	const colombiaStats = {
		origin: 'Colombia',
		median: 6.0,
		q1: 4.5,
		q3: 8.0,
		min: 3.0,
		max: 14.0,
		sample_size: 24,
		supplier_count: 6
	};

	it('renders a price context badge on each card when origin stats are available', async () => {
		renderCatalog(
			createData({ originPriceStats: [colombiaStats] } as unknown as Partial<PageData>)
		);

		// Process Lot is Colombia at $8.50, median is $6.00 → ~42% above → well_above
		await waitFor(() => {
			expect(screen.getByText(/above median/i)).toBeInTheDocument();
		});
	});

	it('bases card price context on the displayed price instead of price_per_lb', async () => {
		renderCatalog(
			createData({
				data: [
					{
						...createData().data[0],
						price_per_lb: 6,
						cost_lb: 9,
						price_tiers: [{ min_lbs: 1, price: 9 }]
					}
				],
				originPriceStats: [{ ...colombiaStats, median: 9 }]
			} as unknown as Partial<PageData>)
		);

		await waitFor(() => {
			expect(screen.getByText('Near median')).toBeInTheDocument();
		});
		expect(screen.queryByText(/below median/i)).not.toBeInTheDocument();
	});

	it('does not render price context badges when no origin stats are provided', () => {
		renderCatalog(createData({ originPriceStats: [] } as unknown as Partial<PageData>));

		expect(screen.queryByText(/above median/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/below median/i)).not.toBeInTheDocument();
		expect(screen.queryByText('Near median')).not.toBeInTheDocument();
	});

	it('refreshes origin price stats when the wholesale scope changes after hydration', async () => {
		const pageData = createData({
			session: { access_token: 'member-token' } as PageData['session'],
			role: 'member',
			catalogAccess: {
				canViewPublicCatalog: true,
				canViewFullCatalog: true,
				canViewWholesale: true,
				canUseBasicFilters: true,
				canUseAdvancedFilters: true,
				canUseProcessFacets: true,
				canUsePriceScoreRanges: true,
				canUseAdvancedSorts: true,
				canViewPremiumFilterMetadata: true,
				canUseSemanticSearch: true,
				canUseBeanMatching: true,
				canUseSavedSearches: true,
				canExport: true
			},
			originPriceStats: [{ ...colombiaStats, median: 8.5 }]
		} as unknown as Partial<PageData>);

		renderCatalog(pageData);

		await waitFor(() => {
			expect(screen.getByText('Near median')).toBeInTheDocument();
		});

		filterStore.initializeForRoute(
			'/catalog',
			pageData.data as unknown as Record<string, unknown>[],
			{
				catalogUrlState: {
					filters: {},
					sortField: null,
					sortDirection: null,
					showWholesale: true,
					wholesaleOnly: false,
					pagination: { page: 1, limit: 15 }
				},
				serverData: pageData.data as unknown as Record<string, unknown>[],
				pagination: pageData.pagination
			}
		);

		await waitFor(() => {
			expect(fetch).toHaveBeenCalledWith(
				'/api/catalog/origin-price-stats?showWholesale=true',
				expect.objectContaining({ signal: expect.any(AbortSignal) })
			);
			expect(screen.getByText(/above median/i)).toBeInTheDocument();
		});
	});

	it('shows origin supply context panel when filtering to a single origin with stats', async () => {
		renderCatalog(
			createData({
				originPriceStats: [colombiaStats],
				initialCatalogState: {
					filters: { country: ['Colombia'] },
					sortField: null,
					sortDirection: null,
					showWholesale: false,
					wholesaleOnly: false,
					pagination: { page: 1, limit: 15 }
				}
			} as unknown as Partial<PageData>)
		);

		await waitFor(() => {
			expect(screen.getByLabelText('Origin price context')).toBeInTheDocument();
		});

		expect(screen.getByText(/Colombia supply context/i)).toBeInTheDocument();
		expect(screen.getByText(/\$6\.00\/lb/)).toBeInTheDocument();
		expect(screen.getByText('24')).toBeInTheDocument();
		expect(screen.getByText('6')).toBeInTheDocument();
	});

	it('does not show origin supply context panel when no single origin is filtered', () => {
		renderCatalog(
			createData({ originPriceStats: [colombiaStats] } as unknown as Partial<PageData>)
		);

		expect(screen.queryByLabelText('Origin price context')).not.toBeInTheDocument();
	});
});

describe('/catalog watchlist and sourcing briefs', () => {
	it('lets Mallard members use watchlist controls without Parchment Intelligence entitlement', async () => {
		renderCatalog(
			createData({
				session: { access_token: 'member-token' } as PageData['session'],
				role: 'member',
				ppiAccess: false,
				trackedLotIds: []
			} as unknown as Partial<PageData>)
		);

		const button = screen.getByRole('button', { name: 'Track Process Lot' });
		expect(button).toHaveAttribute('aria-pressed', 'false');

		await fireEvent.click(button);

		await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'true'));
		expect(fetch).toHaveBeenCalledWith('/api/catalog/1/track', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' }
		});
	});

	it('recomputes active brief counts when catalog pagination changes client-side', async () => {
		vi.mocked(fetch).mockImplementation(async (input: URL | RequestInfo) => {
			const url =
				typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
			if (url.startsWith('/api/catalog/filters')) {
				return new Response(JSON.stringify({ countries: [], processing: [] }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				});
			}
			if (url.startsWith('/v1/catalog')) {
				return new Response(
					JSON.stringify({
						data: [
							{
								...createData().data[0],
								id: 2,
								name: 'Ethiopia Page Two Lot',
								country: 'Ethiopia'
							}
						],
						pagination: {
							page: 2,
							limit: 1,
							total: 2,
							totalPages: 2,
							hasNext: false,
							hasPrev: true
						}
					}),
					{ status: 200, headers: { 'Content-Type': 'application/json' } }
				);
			}
			return new Response(JSON.stringify({ data: [], pagination: null }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			});
		});

		renderCatalog(
			createData({
				session: { access_token: 'member-token' } as PageData['session'],
				role: 'member',
				pagination: {
					page: 1,
					limit: 1,
					total: 2,
					totalPages: 2,
					hasNext: true,
					hasPrev: false
				},
				briefMatchSummaries: [
					{
						briefId: 'brief-1',
						briefName: 'Colombia brief',
						criteria: { version: 1, country: 'Colombia' },
						matchCount: 1,
						matchingIds: [1]
					}
				]
			} as unknown as Partial<PageData>)
		);

		expect(screen.getByLabelText('Sourcing brief matches')).toBeInTheDocument();
		expect(screen.getByText('Colombia brief')).toBeInTheDocument();

		await fireEvent.click(screen.getByRole('button', { name: 'Next' }));

		await waitFor(() => {
			expect(screen.queryByLabelText('Sourcing brief matches')).not.toBeInTheDocument();
		});
	});
});

describe('/catalog similar comparison controls', () => {
	it('shows a locked member comparison CTA without leaking match data for non-members', () => {
		renderCatalog(createData());

		expect(screen.getByRole('button', { name: /unlock matches/i })).toBeInTheDocument();
		expect(screen.queryByText('Member Match Lot')).not.toBeInTheDocument();
	});

	it('shows anonymous users the locked matches detail without fetching member data', async () => {
		renderCatalog(createData());

		await fireEvent.click(screen.getByRole('button', { name: /unlock matches/i }));

		expect(screen.getByText('Unlock similar coffee matches')).toBeInTheDocument();
		expect(goto).not.toHaveBeenCalled();
		expect(fetch).not.toHaveBeenCalledWith('/v1/catalog/1/similar?limit=8&stocked_only=true', {
			headers: { Accept: 'application/json' }
		});
	});

	it('shows signed-in non-members the locked matches detail without fetching member data', async () => {
		renderCatalog(
			createData({
				session: { access_token: 'viewer-token' } as PageData['session'],
				role: 'viewer'
			} as unknown as Partial<PageData>)
		);

		await fireEvent.click(screen.getByRole('button', { name: /unlock matches/i }));

		expect(screen.getByText('Unlock similar coffee matches')).toBeInTheDocument();
		expect(goto).not.toHaveBeenCalled();
		expect(fetch).not.toHaveBeenCalledWith('/v1/catalog/1/similar?limit=8&stocked_only=true', {
			headers: { Accept: 'application/json' }
		});
	});

	it('lets members open an on-demand similar coffee comparison panel', async () => {
		renderCatalog(
			createData({
				session: { access_token: 'member-token' } as PageData['session'],
				role: 'member',
				catalogAccess: {
					canViewPublicCatalog: true,
					canViewFullCatalog: true,
					canViewWholesale: true,
					canUseBasicFilters: true,
					canUseAdvancedFilters: true,
					canUseProcessFacets: true,
					canUsePriceScoreRanges: true,
					canUseAdvancedSorts: true,
					canViewPremiumFilterMetadata: true,
					canUseSemanticSearch: true,
					canUseBeanMatching: true,
					canUseSavedSearches: true,
					canExport: true
				}
			} as unknown as Partial<PageData>)
		);

		await fireEvent.click(screen.getByRole('button', { name: /compare matches/i }));

		await waitFor(() => expect(screen.getByText('Member Match Lot')).toBeInTheDocument());
		expect(screen.getByText('Match Importer · In stock')).toBeInTheDocument();
		expect(
			screen.getByText('Stocked: 2026-04-02 · date signal, not a quality claim')
		).toBeInTheDocument();
		expect(screen.getByText('$1.00/lb lower (11.8%)')).toBeInTheDocument();
	});
});

describe('/catalog process controls', () => {
	it('hides working process facet controls for anonymous and viewer access', async () => {
		renderCatalog(
			createData({
				catalogAccessNotice: {
					status: 401,
					code: 'auth_required',
					message: 'Structured process filters require a member account.',
					deniedParams: ['processing_base_method']
				}
			} as unknown as Partial<PageData>)
		);

		expect(screen.getByText('Members unlock structured process filters')).toBeInTheDocument();
		expect(
			screen.getByText('Structured process filters require a member account.')
		).toBeInTheDocument();
		expect(screen.queryByLabelText('Base method')).not.toBeInTheDocument();
		expect(screen.queryByText('Advanced process transparency')).not.toBeInTheDocument();
	});

	it('enables process facet controls for member access', async () => {
		renderCatalog(
			createData({
				session: { access_token: 'member-token' } as PageData['session'],
				role: 'member',
				catalogAccess: {
					canViewPublicCatalog: true,
					canViewFullCatalog: true,
					canViewWholesale: true,
					canUseBasicFilters: true,
					canUseAdvancedFilters: true,
					canUseProcessFacets: true,
					canUsePriceScoreRanges: true,
					canUseAdvancedSorts: true,
					canViewPremiumFilterMetadata: true,
					canUseSemanticSearch: true,
					canUseBeanMatching: true,
					canUseSavedSearches: true,
					canExport: true
				}
			} as unknown as Partial<PageData>)
		);

		expect(screen.getByText('Advanced process transparency')).toBeInTheDocument();
		expect(screen.getByLabelText('Base method')).toBeInTheDocument();
		expect(screen.getByLabelText('Fermentation')).toBeInTheDocument();
		expect(screen.getByLabelText('Confidence')).toBeInTheDocument();
		expect(screen.queryByText('Members unlock structured process filters')).not.toBeInTheDocument();
	});
});
