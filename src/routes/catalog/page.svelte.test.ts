import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { get } from 'svelte/store';
import { tick } from 'svelte';
import CatalogPage from './+page.svelte';
import type { PageData } from './$types';
import { createCatalogProofSummary } from '$lib/catalog/proofSummary';
import { filterStore } from '$lib/stores/filterStore';
import { catalogFilterPanel } from '$lib/stores/catalogFilterPanel.svelte';
import type { UserRole } from '$lib/types/auth.types';

const { goto, replaceState, pageState, track } = vi.hoisted(() => ({
	goto: vi.fn(),
	replaceState: vi.fn(),
	pageState: { url: new URL('https://app.test/catalog'), state: {} },
	track: vi.fn()
}));

vi.mock('@vercel/analytics/sveltekit', () => ({ track }));

vi.mock('$app/navigation', () => ({ goto, replaceState }));
vi.mock('$app/state', () => ({ page: pageState }));
vi.mock('$lib/components/catalog/CatalogMapCanvas.svelte', async () => ({
	default: (
		await import('$lib/components/catalog/__test-fixtures__/CatalogMapCanvasHarness.svelte')
	).default
}));

function createData(
	overrides: Partial<PageData> & {
		session?: unknown;
		role?: UserRole;
		ppiAccess?: boolean;
	} = {}
): PageData {
	const { session = null, role = 'viewer', ppiAccess = false, ...pageOverrides } = overrides;

	return {
		auth: {
			isSignedIn: Boolean(session),
			user: session ? { id: 'user-1', email: 'user@example.com' } : null,
			role,
			ppiAccess
		},
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
		trackedLotIds: [],
		briefMatchSummaries: [],
		...pageOverrides
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
	window.history.replaceState({}, '', '/catalog');
	filterStore.initializeForRoute('__test-reset__', []);
	catalogFilterPanel.open = false;
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
						values: {
							countries: ['Colombia'],
							processing: ['Washed'],
							processing_base_method: ['Natural']
						},
						facets: {
							countries: [{ value: 'Colombia', count: 344 }],
							processing: [{ value: 'Washed', count: 1235 }],
							processing_base_method: [{ value: 'Natural', count: 533 }],
							grade_size: [
								{ value: 'KE:AA', count: 39 },
								{ value: 'ET:G1', count: 84 }
							],
							grade_cup: [{ value: 'ET:G1', count: 84 }],
							screen_size_min: [
								{ value: '17', count: 32 },
								{ value: '15', count: 103 }
							],
							elevation_band: [
								{ value: '1800-1999', count: 288 },
								{ value: '1200-1399', count: 558 }
							],
							score_protocols: [{ value: 'supplier_unspecified', count: 443 }],
							processing_disclosure_level: [
								{ value: 'structured', count: 2033 },
								{ value: 'high_detail', count: 291 }
							]
						},
						grades: [
							{
								code: 'KE:AA',
								label: 'Kenya AA',
								description: "Kenya's largest standard screen grade.",
								dimensions: ['size'],
								sort_order: 100
							},
							{
								code: 'ET:G1',
								label: 'Ethiopia Grade 1',
								description: 'Ethiopia grade 1.',
								dimensions: ['size', 'cup'],
								sort_order: 200
							}
						]
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

			if (url.startsWith('/api/catalog/1/similar')) {
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

		expect(screen.getByText('Live supply, updated daily')).toBeInTheDocument();
		expect(
			screen.getByText(/Every stocked green coffee from 40\+ US importers in one place/i)
		).toBeInTheDocument();
		expect(screen.getByText('Active rows in this query')).toBeInTheDocument();
		expect(screen.getByText('Origins shown on this page')).toBeInTheDocument();
		expect(screen.getByText('Suppliers shown on this page')).toBeInTheDocument();
		expect(screen.getByText('Priced rows shown')).toBeInTheDocument();

		expect(screen.getByRole('link', { name: 'Open the Market Index' })).toHaveAttribute(
			'href',
			'/analytics'
		);
		expect(screen.queryByRole('link', { name: 'Preview supplier comparison gate' })).toBeNull();
		expect(screen.queryByText(/save sourcing research/i)).not.toBeInTheDocument();
	});

	it('does not repeat the Market Index CTA for Intelligence users', () => {
		renderCatalog(
			createData({
				session: { access_token: 'ppi-token' },
				ppiAccess: true
			} as unknown as Partial<PageData>)
		);

		expect(screen.getAllByRole('link', { name: 'Open the Market Index' })).toHaveLength(1);
		expect(screen.queryByRole('link', { name: 'Review supplier comparison evidence' })).toBeNull();
		expect(
			screen.queryByText('Need workflow leverage from this supply layer?')
		).not.toBeInTheDocument();
	});

	it('uses one market CTA and one paid-product CTA for signed-in free users', () => {
		renderCatalog(
			createData({
				session: { access_token: 'viewer-token' },
				role: 'viewer'
			} as unknown as Partial<PageData>)
		);

		expect(screen.getAllByRole('link', { name: 'Open the Market Index' })).toHaveLength(1);
		expect(screen.getAllByRole('button', { name: 'Compare paid products' })).toHaveLength(1);
		expect(screen.queryByRole('link', { name: 'Preview supplier comparison gate' })).toBeNull();
	});

	it('uses one contextual Market Index CTA for signed-in viewers with empty results', () => {
		renderCatalog(
			createData({
				session: { access_token: 'viewer-token' },
				role: 'viewer',
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

		expect(screen.getByText('No coffees match these filters')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Review broader Market Index' })).toHaveAttribute(
			'href',
			'/analytics'
		);
		expect(screen.queryByRole('link', { name: 'Open the Market Index' })).toBeNull();
		expect(screen.getAllByRole('link', { name: /Market Index/i })).toHaveLength(1);
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
				session: { access_token: 'member-token' },
				role: 'member',
				trackedLotIds
			} as unknown as Partial<PageData>)
		);

		expect(
			screen.queryByRole('button', { name: /track process lot|untrack process lot/i })
		).not.toBeInTheDocument();
		expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/track'))).toBe(false);

		resolveTrackedIds([1]);

		const toggle = await screen.findByRole('button', { name: /untrack process lot/i });
		await fireEvent.click(toggle);

		expect(fetch).toHaveBeenCalledWith(
			'/api/catalog/1/track',
			expect.objectContaining({ method: 'PUT' })
		);
	});

	it('keeps watchlist toggles hidden when streamed tracked ids fail', async () => {
		renderCatalog(
			createData({
				session: { access_token: 'member-token' },
				role: 'member',
				trackedLotIds: Promise.resolve(null)
			} as unknown as Partial<PageData>)
		);

		await waitFor(() => {
			expect(
				screen.queryByRole('button', { name: /track process lot|untrack process lot/i })
			).not.toBeInTheDocument();
		});
		expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/track'))).toBe(false);
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

	it('clears streamed origin stats while new page data is pending', async () => {
		let resolveStats!: (stats: (typeof colombiaStats)[]) => void;
		const pendingStats = new Promise<(typeof colombiaStats)[]>((resolve) => {
			resolveStats = resolve;
		});

		const { rerender } = renderCatalog(
			createData({
				originPriceStats: [{ ...colombiaStats, median: 8.5 }]
			} as unknown as Partial<PageData>)
		);

		await waitFor(() => {
			expect(screen.getByText('Near median')).toBeInTheDocument();
		});

		await rerender({
			data: createData({
				initialCatalogState: {
					filters: {},
					sortField: null,
					sortDirection: null,
					showWholesale: true,
					wholesaleOnly: false,
					pagination: { page: 1, limit: 15 }
				},
				originPriceStats: pendingStats
			} as unknown as Partial<PageData>)
		});

		await waitFor(() => {
			expect(screen.queryByText('Near median')).not.toBeInTheDocument();
			expect(screen.queryByText(/above median/i)).not.toBeInTheDocument();
		});

		resolveStats([{ ...colombiaStats, median: 4 }]);

		await waitFor(() => {
			expect(screen.getByText(/above median/i)).toBeInTheDocument();
		});
	});

	it('refreshes origin price stats when the wholesale scope changes after hydration', async () => {
		const pageData = createData({
			session: { access_token: 'member-token' },
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
			initialCatalogState: {
				filters: {},
				sortField: null,
				sortDirection: null,
				showWholesale: true,
				wholesaleOnly: false,
				pagination: { page: 1, limit: 15 }
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
					showWholesale: false,
					wholesaleOnly: false,
					pagination: { page: 1, limit: 15 }
				},
				serverData: pageData.data as unknown as Record<string, unknown>[],
				pagination: pageData.pagination
			}
		);

		await waitFor(() => {
			expect(fetch).toHaveBeenCalledWith(
				'/api/catalog/origin-price-stats?showWholesale=false',
				expect.objectContaining({ signal: expect.any(AbortSignal) })
			);
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
				session: { access_token: 'member-token' },
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
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ tracked: true })
		});
	});

	it('recomputes page-local counts from canonical matching IDs when pagination changes', async () => {
		vi.mocked(fetch).mockImplementation(async (input: URL | RequestInfo) => {
			const url =
				typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
			if (url.startsWith('/api/catalog/filters')) {
				return new Response(JSON.stringify({ countries: [], processing: [] }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				});
			}
			if (url.startsWith('/api/catalog?')) {
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
				session: { access_token: 'member-token' },
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
						totalMatchCount: 2,
						matchingIds: [1, 2]
					}
				]
			} as unknown as Partial<PageData>)
		);

		expect(screen.getByLabelText('Sourcing brief matches')).toBeInTheDocument();
		expect(screen.getByText('Colombia brief')).toBeInTheDocument();

		await fireEvent.click(screen.getByRole('button', { name: 'Next' }));

		await waitFor(() => expect(screen.getByText('Ethiopia Page Two Lot')).toBeInTheDocument());
		const section = screen.getByLabelText('Sourcing brief matches');
		expect(screen.getByText('Colombia brief')).toBeInTheDocument();
		expect(within(section).getByText('1')).toBeInTheDocument();
	});

	it('omits briefs with no canonical IDs on the displayed page', () => {
		renderCatalog(
			createData({
				session: { access_token: 'member-token' },
				role: 'member',
				briefMatchSummaries: [
					{
						briefId: 'brief-1',
						briefName: 'Elsewhere brief',
						criteria: { version: 1, country: 'Ethiopia' },
						totalMatchCount: 1,
						matchingIds: [99]
					}
				]
			} as unknown as Partial<PageData>)
		);

		expect(screen.queryByLabelText('Sourcing brief matches')).not.toBeInTheDocument();
	});

	it('includes a streamed deep-link row by canonical ID', async () => {
		const initial = createData();
		pageState.url = new URL('https://app.test/catalog?coffee=99');
		renderCatalog(
			createData({
				session: { access_token: 'member-token' },
				role: 'member',
				deepLinkCoffee: Promise.resolve({
					...initial.data[0],
					id: 99,
					name: 'Canonical Deep Link Match'
				}),
				briefMatchSummaries: [
					{
						briefId: 'brief-1',
						briefName: 'Deep-link brief',
						criteria: { version: 1, country: 'Kenya' },
						totalMatchCount: 1,
						matchingIds: [99]
					}
				]
			} as unknown as Partial<PageData>)
		);

		await waitFor(() => expect(screen.getByText('Deep-link brief')).toBeInTheDocument());
		const section = screen.getByLabelText('Sourcing brief matches');
		expect(within(section).getByText('1')).toBeInTheDocument();
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
		expect(fetch).not.toHaveBeenCalledWith('/api/catalog/1/similar?limit=8&stocked_only=true', {
			headers: { Accept: 'application/json' }
		});
	});

	it('shows signed-in non-members the locked matches detail without fetching member data', async () => {
		renderCatalog(
			createData({
				session: { access_token: 'viewer-token' },
				role: 'viewer'
			} as unknown as Partial<PageData>)
		);

		await fireEvent.click(screen.getByRole('button', { name: /unlock matches/i }));

		expect(screen.getByText('Unlock similar coffee matches')).toBeInTheDocument();
		expect(goto).not.toHaveBeenCalled();
		expect(fetch).not.toHaveBeenCalledWith('/api/catalog/1/similar?limit=8&stocked_only=true', {
			headers: { Accept: 'application/json' }
		});
	});

	it('lets members open an on-demand similar coffee comparison panel', async () => {
		renderCatalog(
			createData({
				session: { access_token: 'member-token' },
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

describe('/catalog filters', () => {
	const memberAccess = {
		canViewPublicCatalog: true,
		canViewFullCatalog: true,
		canViewWholesale: true,
		canUseBasicFilters: true,
		canUseAdvancedFilters: true,
		canUseProcessFacets: true,
		canUsePriceRanges: true,
		canUsePriceScoreRanges: true,
		canUseAdvancedSorts: true,
		canViewPremiumFilterMetadata: true,
		canUseSemanticSearch: true,
		canUseBeanMatching: true,
		canUseSavedSearches: true,
		canExport: true
	};

	it('gives anonymous and free viewers the public process list, with the structured filters shown locked', async () => {
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

		const row = document.querySelector('[data-catalog-primary-row]') as HTMLElement;
		expect(within(row).getByLabelText('Process')).toBeInstanceOf(HTMLSelectElement);
		expect(
			within(row).getByText('Members filter by process method, fermentation, additives and drying.')
		).toBeInTheDocument();
		expect(within(row).queryByRole('group', { name: 'Process' })).not.toBeInTheDocument();
		expect(await within(row).findByRole('option', { name: 'Washed (1,235)' })).toBeInTheDocument();
		expect(
			screen.getByText('Structured process filters require a member account.')
		).toBeInTheDocument();
	});

	it('locks the price range for anonymous visitors and opens it to signed-in free accounts', async () => {
		const { unmount } = renderCatalog(createData());
		await fireEvent.click(screen.getByRole('button', { name: 'Price per lb' }));
		expect(screen.getByText('Sign in with a free account to filter by price.')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Under $8' })).toBeDisabled();
		unmount();

		renderCatalog(
			createData({
				session: { access_token: 'viewer-token' },
				role: 'viewer',
				catalogAccess: { ...createData().catalogAccess, canUsePriceRanges: true }
			} as unknown as Partial<PageData>)
		);
		await fireEvent.click(screen.getByRole('button', { name: 'Price per lb' }));
		expect(
			screen.queryByText('Sign in with a free account to filter by price.')
		).not.toBeInTheDocument();
		await fireEvent.click(screen.getByRole('button', { name: 'Under $8' }));
		expect(get(filterStore).filters.cost_lb).toEqual({ min: '', max: '8' });
		expect(
			screen.getByRole('button', { name: 'Remove filter: Price: up to $8 per lb' })
		).toBeInTheDocument();
	});

	it('explains when viewer-tier premium discovery filters were not applied', () => {
		renderCatalog(
			createData({
				catalogAccessNotice: {
					status: 403,
					code: 'entitlement_required',
					message:
						'Some requested catalog filters or sorts are available to members and customer API keys.',
					deniedParams: ['type', 'grade', 'appearance', 'sort']
				}
			} as unknown as Partial<PageData>)
		);

		expect(screen.getByText('Some requested filters were not applied')).toBeInTheDocument();
		expect(
			screen.getByText(
				'Some requested catalog filters or sorts are available to members and customer API keys.'
			)
		).toBeInTheDocument();
	});

	it('gives members the structured process chips with counts in place of the public list', async () => {
		renderCatalog(
			createData({
				session: { access_token: 'member-token' },
				role: 'member',
				catalogAccess: memberAccess
			} as unknown as Partial<PageData>)
		);

		const row = document.querySelector('[data-catalog-primary-row]') as HTMLElement;
		const chips = within(row).getByRole('group', { name: 'Process' });
		const natural = await within(chips).findByRole('button', { name: 'Natural 533' });
		expect(within(row).queryByLabelText('Process')).not.toBeInTheDocument();
		expect(row.querySelector('[data-catalog-lock]')).toBeNull();

		await fireEvent.click(natural);
		expect(get(filterStore).filters.processing_base_method).toBe('Natural');
		expect(natural).toHaveAttribute('aria-pressed', 'true');
		expect(
			screen.getByRole('button', { name: 'Remove filter: Process: Natural' })
		).toBeInTheDocument();
	});

	it('opens one filter panel from the row, with each section locked or open by access level', async () => {
		// The panel slides in; the test DOM has no Web Animations API.
		Object.defineProperty(HTMLElement.prototype, 'animate', {
			configurable: true,
			value: vi.fn(() => ({ finished: Promise.resolve(), cancel: vi.fn(), play: vi.fn() }))
		});
		const { unmount } = renderCatalog(createData());
		await fireEvent.click(screen.getByRole('button', { name: /^All filters/ }));
		let panel = document.querySelector('[data-catalog-filter-panel]') as HTMLElement;
		expect(
			[...panel.querySelectorAll('summary')].map((summary) => summary.textContent?.trim())
		).toEqual([
			'Origin and supplier',
			'Process',
			'Grade and quality',
			'Variety',
			'Freshness',
			'Transparency'
		]);
		expect(panel.querySelectorAll('[data-catalog-lock]')).toHaveLength(6);
		expect(within(panel).getByLabelText('Hobbyist suppliers only')).toBeEnabled();
		expect(within(panel).getByLabelText('Wholesale suppliers only')).toBeDisabled();
		// A locked section shows its reason and none of its controls.
		expect(
			within(panel).getByText(
				'Members filter by grade, screen size, moisture, growing elevation and cup score.'
			)
		).toBeInTheDocument();
		expect(within(panel).queryByLabelText('Lowest elevation')).not.toBeInTheDocument();
		expect(within(panel).queryByLabelText('Lowest score')).not.toBeInTheDocument();
		unmount();
		catalogFilterPanel.open = false;

		renderCatalog(
			createData({
				session: { access_token: 'member-token' },
				role: 'member',
				catalogAccess: memberAccess
			} as unknown as Partial<PageData>)
		);
		await fireEvent.click(screen.getByRole('button', { name: /^All filters/ }));
		panel = document.querySelector('[data-catalog-filter-panel]') as HTMLElement;
		expect(panel.querySelectorAll('[data-catalog-lock]')).toHaveLength(0);
		expect(within(panel).getByLabelText('Wholesale suppliers only')).toBeEnabled();
		expect(within(panel).getByLabelText('Lowest elevation')).toBeEnabled();
		expect(within(panel).getByRole('group', { name: 'Drying' })).toBeInTheDocument();
		expect(within(panel).getByRole('searchbox', { name: 'Variety' })).toBeInTheDocument();
	});

	it('offers grade and quality filters to members, with one grade selection across every kind', async () => {
		Object.defineProperty(HTMLElement.prototype, 'animate', {
			configurable: true,
			value: vi.fn(() => ({ finished: Promise.resolve(), cancel: vi.fn(), play: vi.fn() }))
		});
		renderCatalog(
			createData({
				session: { access_token: 'member-token' },
				role: 'member',
				catalogAccess: memberAccess
			} as unknown as Partial<PageData>)
		);
		await fireEvent.click(screen.getByRole('button', { name: /^All filters/ }));
		const section = document.querySelector('[data-catalog-grading]') as HTMLElement;

		const size = await within(section).findByRole('group', { name: 'Size grade' });
		const cup = within(section).getByRole('group', { name: 'Cup grade' });
		const kenyaAa = within(size).getByRole('button', { name: 'Kenya AA 39' });
		expect(kenyaAa).toHaveAttribute('title', "Kenya's largest standard screen grade.");
		// A designation that grades two things is listed under both.
		expect(within(size).getByRole('button', { name: 'Ethiopia Grade 1 84' })).toBeInTheDocument();

		await fireEvent.click(kenyaAa);
		await fireEvent.click(within(cup).getByRole('button', { name: 'Ethiopia Grade 1 84' }));
		expect(get(filterStore).filters.grade_code).toEqual(['KE:AA', 'ET:G1']);
		expect(within(size).getByRole('button', { name: 'Ethiopia Grade 1 84' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		expect(
			screen.getByRole('button', { name: 'Remove filter: Grade: Kenya AA' })
		).toBeInTheDocument();

		await fireEvent.click(within(section).getByRole('button', { name: 'Peaberry' }));
		expect(get(filterStore).filters.peaberry).toBe(true);

		await fireEvent.click(within(section).getByRole('button', { name: '1,800 to 1,999 m 288' }));
		expect(get(filterStore).filters.elevation_masl).toEqual({ min: '1800', max: '1999' });

		expect(
			within(section).getByText(/Stated smallest screen: 15 \(103\), 17 \(32\)/)
		).toBeInTheDocument();
		// Every score here has no stated protocol, so there is nothing to choose or rank by.
		expect(within(section).queryByLabelText('Scoring protocol')).not.toBeInTheDocument();
		expect(within(section).getByText(/are not ranked against each other/)).toBeInTheDocument();
		expect(
			within(document.querySelector('[data-catalog-primary-row]') as HTMLElement).queryByRole(
				'option',
				{ name: 'Cup score, high to low' }
			)
		).not.toBeInTheDocument();
	});

	it('lets members filter by how much a supplier discloses, most disclosed first', async () => {
		Object.defineProperty(HTMLElement.prototype, 'animate', {
			configurable: true,
			value: vi.fn(() => ({ finished: Promise.resolve(), cancel: vi.fn(), play: vi.fn() }))
		});
		renderCatalog(
			createData({
				session: { access_token: 'member-token' },
				role: 'member',
				catalogAccess: memberAccess
			} as unknown as Partial<PageData>)
		);
		await fireEvent.click(screen.getByRole('button', { name: /^All filters/ }));
		const section = document.querySelector('[data-catalog-transparency]') as HTMLElement;

		const group = await within(section).findByRole('group', { name: 'Process disclosure' });
		await waitFor(() =>
			expect(
				within(group)
					.getAllByRole('button')
					.map((button) => button.textContent?.replace(/\s+/g, ' ').trim())
			).toEqual(['High detail 291', 'Structured 2,033'])
		);

		await fireEvent.click(within(group).getByRole('button', { name: 'High detail 291' }));
		expect(get(filterStore).filters.processing_disclosure_level).toBe('high_detail');
		expect(
			screen.getByRole('button', { name: 'Remove filter: Process disclosure: High detail' })
		).toBeInTheDocument();
	});

	it('says which filter to remove when nothing matches, and how many coffees that shows', async () => {
		const baseFetch = vi.mocked(fetch).getMockImplementation()!;
		vi.mocked(fetch).mockImplementation(async (input, init) => {
			const url = String(input);
			if (url.startsWith('/api/catalog?') && url.includes('limit=1&')) {
				const total = !url.includes('country=') ? 101 : !url.includes('grade_code=') ? 85 : 0;
				return new Response(JSON.stringify({ data: [], pagination: { total } }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				});
			}
			return baseFetch(input, init);
		});
		renderCatalog(
			createData({
				session: { access_token: 'member-token' },
				role: 'member',
				catalogAccess: memberAccess,
				data: [],
				initialCatalogState: {
					...createData().initialCatalogState,
					showWholesale: true,
					filters: { country: ['Kenya'], grade_code: ['GT:SHB'] }
				},
				pagination: { page: 1, limit: 15, total: 0, totalPages: 0, hasNext: false, hasPrev: false }
			} as unknown as Partial<PageData>)
		);

		const empty = document.querySelector('[data-catalog-empty-state]') as HTMLElement;
		expect(within(empty).getByText('No coffees match these filters')).toBeInTheDocument();
		const suggestions = await within(empty).findByRole('list', { name: 'Suggestions' });
		expect(
			within(suggestions)
				.getAllByRole('button')
				.map((button) => button.textContent?.replace(/\s+/g, ' ').trim())
		).toEqual(['Remove Origin: Kenya 101 coffees', 'Remove Grade: GT:SHB 85 coffees']);

		await fireEvent.click(
			within(suggestions).getByRole('button', { name: /Remove Origin: Kenya/ })
		);
		expect(get(filterStore).filters).toEqual({ grade_code: ['GT:SHB'] });
	});

	describe('an empty result and the filters it belongs to', () => {
		const json = (body: unknown, status = 200) =>
			new Response(JSON.stringify(body), {
				status,
				headers: { 'Content-Type': 'application/json' }
			});
		const isTotalRead = (url: string) =>
			url.startsWith('/api/catalog?') && url.includes('limit=1&');
		const isListing = (url: string) => url.startsWith('/api/catalog?') && !isTotalRead(url);
		const noResultsEvents = () =>
			track.mock.calls.filter(([event]) => event === 'catalog_no_results');
		const totalReads = () =>
			vi
				.mocked(fetch)
				.mock.calls.map(([input]) => String(input))
				.filter(isTotalRead);
		const noCoffees = {
			data: [],
			pagination: { page: 1, limit: 15, total: 0, totalPages: 0, hasNext: false, hasPrev: false }
		};

		function renderEmptyCatalog() {
			renderCatalog(
				createData({
					session: { access_token: 'member-token' },
					role: 'member',
					catalogAccess: memberAccess,
					data: [],
					initialCatalogState: {
						...createData().initialCatalogState,
						showWholesale: true,
						filters: { country: ['Kenya'], grade_code: ['GT:SHB'] }
					},
					pagination: noCoffees.pagination
				} as unknown as Partial<PageData>)
			);
		}

		it('does not count or explain an empty result the next read replaces', async () => {
			const baseFetch = vi.mocked(fetch).getMockImplementation()!;
			vi.mocked(fetch).mockImplementation(async (input, init) => {
				const url = String(input);
				if (isTotalRead(url)) {
					const total = !url.includes('country=') ? 85 : !url.includes('grade_code=') ? 101 : 0;
					return json({ data: [], pagination: { total } });
				}
				if (isListing(url) && !url.includes('country=')) {
					return json({
						data: [{ id: 7, name: 'Huehuetenango SHB', source: 'Example Importer' }],
						pagination: {
							page: 1,
							limit: 15,
							total: 85,
							totalPages: 6,
							hasNext: true,
							hasPrev: false
						}
					});
				}
				return baseFetch(input, init);
			});
			renderEmptyCatalog();

			const empty = document.querySelector('[data-catalog-empty-state]') as HTMLElement;
			const suggestions = await within(empty).findByRole('list', { name: 'Suggestions' });
			expect(noResultsEvents()).toEqual([
				['catalog_no_results', { surface: 'catalog', controls: 'country,grade_code' }]
			]);

			await fireEvent.click(
				within(suggestions).getByRole('button', { name: /Remove Origin: Kenya/ })
			);
			await waitFor(() => expect(get(filterStore).pagination.total).toBe(85));
			await tick();

			// The grade alone matches 85 coffees, so it never came up empty.
			expect(noResultsEvents()).toHaveLength(1);
			// Nor was a suggestion read for it: no total is asked for with both removed.
			expect(totalReads().filter((url) => !/country=|grade_code=/.test(url))).toEqual([]);
		});

		it('waits for the read before counting, and does not count one that failed', async () => {
			let answerListing: ((response: Response) => void) | null = null;
			let failListing = false;
			const baseFetch = vi.mocked(fetch).getMockImplementation()!;
			vi.mocked(fetch).mockImplementation(async (input, init) => {
				const url = String(input);
				if (isTotalRead(url)) return json({ data: [], pagination: { total: 0 } });
				if (isListing(url)) {
					if (failListing) return json({ error: 'unavailable' }, 500);
					return new Promise<Response>((resolve) => (answerListing = resolve));
				}
				return baseFetch(input, init);
			});
			vi.spyOn(console, 'error').mockImplementation(() => {});
			renderEmptyCatalog();
			await waitFor(() => expect(noResultsEvents()).toHaveLength(1));
			await waitFor(() => expect(totalReads()).toHaveLength(2));

			// Another filter is added. Until its read answers, the page still shows
			// the previous empty result: nothing is counted or looked up for it.
			filterStore.setFilter('peaberry', true);
			await waitFor(() => expect(answerListing).not.toBeNull());
			expect(noResultsEvents()).toHaveLength(1);
			expect(totalReads()).toHaveLength(2);

			answerListing!(json(noCoffees));
			await waitFor(() =>
				expect(noResultsEvents()).toEqual([
					['catalog_no_results', { surface: 'catalog', controls: 'country,grade_code' }],
					['catalog_no_results', { surface: 'catalog', controls: 'country,grade_code,peaberry' }]
				])
			);
			await waitFor(() => expect(totalReads()).toHaveLength(5));

			// A read that fails leaves the old rows up; they say nothing about the
			// filters now selected.
			failListing = true;
			filterStore.setFilter('peaberry', '');
			await waitFor(() => expect(get(filterStore).resultsStatus).toBe('failed'));
			await tick();
			expect(noResultsEvents()).toHaveLength(2);
		});

		it('counts a set of filters once however often it is read again', async () => {
			const baseFetch = vi.mocked(fetch).getMockImplementation()!;
			vi.mocked(fetch).mockImplementation(async (input, init) => {
				const url = String(input);
				if (isTotalRead(url)) return json({ data: [], pagination: { total: 0 } });
				if (isListing(url)) return json(noCoffees);
				return baseFetch(input, init);
			});
			renderEmptyCatalog();
			await waitFor(() => expect(noResultsEvents()).toHaveLength(1));

			// A new order asks for the same filters again.
			filterStore.setSort('price_per_lb', 'asc');
			await waitFor(() => expect(get(filterStore).resultsStatus).toBe('pending'));
			await waitFor(() => expect(get(filterStore).resultsStatus).toBe('current'));
			await tick();
			expect(noResultsEvents()).toHaveLength(1);

			// A different origin is a different set, though the controls are the same.
			filterStore.setFilter('country', ['Peru']);
			await waitFor(() => expect(noResultsEvents()).toHaveLength(2));
			expect(noResultsEvents()[1]).toEqual([
				'catalog_no_results',
				{ surface: 'catalog', controls: 'country,grade_code' }
			]);
		});
	});

	it('records which controls are used, never what was chosen, and not what a link arrived with', async () => {
		renderCatalog(
			createData({
				session: { access_token: 'member-token' },
				role: 'member',
				catalogAccess: memberAccess,
				initialCatalogState: {
					...createData().initialCatalogState,
					showWholesale: true,
					filters: { country: ['Kenya'], name: 'private search' }
				}
			} as unknown as Partial<PageData>)
		);
		await waitFor(() => expect(get(filterStore).routeId).toBe('/catalog'));
		await tick();
		// The filters the page opened with are the starting point, not a change.
		expect(track).not.toHaveBeenCalled();

		filterStore.setFilter('country', ['Kenya', 'Peru', 'Brazil']);
		filterStore.setFilter('peaberry', true);
		await tick();
		filterStore.setFilter('name', '');
		await tick();
		filterStore.setSort('price_per_lb', 'asc');
		await tick();

		expect(track.mock.calls).toEqual([
			['catalog_filter_added', { surface: 'catalog', control: 'country' }],
			['catalog_filter_added', { surface: 'catalog', control: 'peaberry' }],
			['catalog_filter_removed', { surface: 'catalog', control: 'name' }],
			['catalog_sort_changed', { surface: 'catalog', sort: 'price_per_lb', direction: 'asc' }]
		]);
		expect(JSON.stringify(track.mock.calls)).not.toMatch(/Kenya|Peru|private search/);

		track.mockClear();
		filterStore.clearFilters();
		await tick();
		expect(track).toHaveBeenCalledWith('catalog_filters_cleared', { surface: 'catalog', count: 4 });
	});

	it('keeps a section the viewer opened open when the filters or counts change', async () => {
		Object.defineProperty(HTMLElement.prototype, 'animate', {
			configurable: true,
			value: vi.fn(() => ({ finished: Promise.resolve(), cancel: vi.fn(), play: vi.fn() }))
		});
		renderCatalog(createData());
		await fireEvent.click(screen.getByRole('button', { name: /^All filters/ }));
		const panel = document.querySelector('[data-catalog-filter-panel]') as HTMLElement;
		const section = (title: string) =>
			[...panel.querySelectorAll('details')].find(
				(details) => details.querySelector('summary')?.textContent?.trim() === title
			) as HTMLDetailsElement;

		expect(section('Origin and supplier').open).toBe(true);
		expect(section('Freshness').open).toBe(false);

		section('Freshness').open = true;
		await fireEvent(section('Freshness'), new Event('toggle'));
		filterStore.setFilter('region', 'Huila');
		await waitFor(() =>
			expect(
				screen.getByRole('button', { name: 'Remove filter: Region: Huila' })
			).toBeInTheDocument()
		);

		expect(section('Freshness').open).toBe(true);
	});

	it('lists every active filter as a removable chip and counts the ones set in the panel', async () => {
		renderCatalog(
			createData({
				session: { access_token: 'member-token' },
				role: 'member',
				catalogAccess: memberAccess,
				initialCatalogState: {
					...createData().initialCatalogState,
					showWholesale: true,
					filters: { country: ['Kenya'], grade: 'AA', stocked_days: '30' }
				}
			} as unknown as Partial<PageData>)
		);

		const active = screen.getByLabelText('Active filters');
		expect(
			within(active)
				.getAllByRole('listitem')
				.map((item) => item.textContent?.trim())
		).toEqual(['Grade text: AA', 'Origin: Kenya', 'Stocked in the last 30 days']);
		expect(screen.getByRole('button', { name: /All filters/ })).toHaveTextContent('2');

		await fireEvent.click(screen.getByRole('button', { name: 'Remove filter: Grade text: AA' }));
		expect(get(filterStore).filters).toEqual({ country: ['Kenya'], stocked_days: '30' });

		await fireEvent.click(within(active).getByRole('button', { name: 'Clear all' }));
		expect(get(filterStore).filters).toEqual({});
		expect(screen.queryByLabelText('Active filters')).not.toBeInTheDocument();
	});

	it('says so when a link names a variety, species or drying method the catalog does not know', () => {
		renderCatalog(createData({ unrecognizedCodeFilters: true } as unknown as Partial<PageData>));

		expect(screen.getByText('A filter in this link was not applied')).toBeInTheDocument();
	});

	it('leaves the filters out of the tracked-only view', () => {
		renderCatalog(
			createData({
				session: { access_token: 'member-token' },
				role: 'member',
				trackedOnly: true,
				catalogAccess: memberAccess
			} as unknown as Partial<PageData>)
		);

		expect(document.querySelector('[data-catalog-primary-row]')).toBeNull();
		expect(screen.queryByRole('button', { name: /^All filters/ })).not.toBeInTheDocument();
	});

	it('gives an empty tracked-only view one honest path back to the catalog', () => {
		renderCatalog(
			createData({
				session: { access_token: 'member-token' },
				role: 'member',
				trackedOnly: true,
				data: [],
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

		expect(screen.getByText('No tracked lots to show')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Show full catalog' })).toHaveAttribute(
			'href',
			'/catalog'
		);
		expect(screen.queryByRole('button', { name: 'Clear all filters' })).toBeNull();
	});

	it('does not claim an empty watchlist when tracked-only state is unknown', () => {
		renderCatalog(
			createData({
				session: { access_token: 'member-token' },
				role: 'member',
				trackedOnly: true,
				trackedLotIds: null,
				data: []
			} as unknown as Partial<PageData>)
		);

		expect(screen.getByText('Watchlist temporarily unavailable')).toBeInTheDocument();
		expect(screen.queryByText('No tracked lots to show')).not.toBeInTheDocument();
		expect(screen.queryByLabelText('Tracked lots filter')).not.toBeInTheDocument();
	});
});

describe('/catalog map navigation', () => {
	it('writes a restorable map URL without navigating away', async () => {
		renderCatalog(createData());
		const mapTab = screen.getByRole('tab', { name: 'Map' });

		expect(mapTab).toHaveAttribute('aria-describedby', 'catalog-map-explainer');
		expect(screen.getByRole('tooltip')).toHaveTextContent(
			/Terrain color shows approximate elevation\. Bubble numbers count mapped placements/
		);
		await fireEvent.click(mapTab);

		expect(replaceState).toHaveBeenCalledTimes(1);
		const [nextUrl] = replaceState.mock.calls[0] as [URL, unknown];
		expect(nextUrl.pathname).toBe('/catalog');
		expect(nextUrl.searchParams.get('view')).toBe('map');
		expect(nextUrl.searchParams.get('map_center')).toBe('0,18');
		expect(nextUrl.searchParams.get('map_zoom')).toBe('1.75');
	});

	it('switches between map and list immediately while preserving URL state', async () => {
		renderCatalog(createData());

		const mapTab = screen.getByRole('tab', { name: 'Map' });
		const listTab = screen.getByRole('tab', { name: 'List' });
		await fireEvent.click(mapTab);

		expect(mapTab).toHaveAttribute('aria-selected', 'true');
		expect(screen.getByLabelText('Coffee origin map')).toBeInTheDocument();

		await fireEvent.click(listTab);

		expect(listTab).toHaveAttribute('aria-selected', 'true');
		expect(screen.queryByLabelText('Coffee origin map')).not.toBeInTheDocument();
		expect(replaceState).toHaveBeenCalledTimes(2);
	});

	it('preserves a filter URL changed through native history before a map update', async () => {
		window.history.replaceState({}, '', '/catalog?country=Ethiopia');
		renderCatalog(createData());

		await fireEvent.click(screen.getByRole('tab', { name: 'Map' }));

		const [nextUrl] = replaceState.mock.calls[0] as [URL, unknown];
		expect(nextUrl.searchParams.get('country')).toBe('Ethiopia');
		expect(nextUrl.searchParams.get('view')).toBe('map');
	});

	it('asks the map for out-of-stock coffees too once "In stock only" is turned off', async () => {
		const mapStockScopes: (string | null)[] = [];
		const respond = vi.mocked(fetch).getMockImplementation()!;
		vi.mocked(fetch).mockImplementation((input, init) => {
			const url = String(input);
			if (!url.startsWith('/api/catalog/map?')) return respond(input, init);
			mapStockScopes.push(new URLSearchParams(url.slice(url.indexOf('?'))).get('stocked'));
			// The request is what matters here; the map never gets an answer.
			return new Promise<Response>(() => {});
		});

		renderCatalog(createData());
		await fireEvent.click(screen.getByRole('tab', { name: 'Map' }));
		await waitFor(() => expect(mapStockScopes).toEqual(['true']));

		await fireEvent.click(screen.getByLabelText('In stock only'));

		await waitFor(() => expect(mapStockScopes.at(-1)).toBe('all'));
	});
});
