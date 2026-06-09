import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
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
		vi.fn(async (url: string) => {
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
			} as Partial<PageData>)
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
			} as Partial<PageData>)
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
		renderCatalog(createData({ originPriceStats: [colombiaStats] } as Partial<PageData>));

		// Process Lot is Colombia at $8.50, median is $6.00 → ~42% above → well_above
		await waitFor(() => {
			expect(screen.getByText(/above median/i)).toBeInTheDocument();
		});
	});

	it('does not render price context badges when no origin stats are provided', () => {
		renderCatalog(createData({ originPriceStats: [] } as Partial<PageData>));

		expect(screen.queryByText(/above median/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/below median/i)).not.toBeInTheDocument();
		expect(screen.queryByText('Near median')).not.toBeInTheDocument();
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
					pagination: { page: 1, limit: 15 }
				}
			} as Partial<PageData>)
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
		renderCatalog(createData({ originPriceStats: [colombiaStats] } as Partial<PageData>));

		expect(screen.queryByLabelText('Origin price context')).not.toBeInTheDocument();
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
			} as Partial<PageData>)
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
			} as Partial<PageData>)
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
			} as Partial<PageData>)
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
			} as Partial<PageData>)
		);

		expect(screen.getByText('Advanced process transparency')).toBeInTheDocument();
		expect(screen.getByLabelText('Base method')).toBeInTheDocument();
		expect(screen.getByLabelText('Fermentation')).toBeInTheDocument();
		expect(screen.getByLabelText('Confidence')).toBeInTheDocument();
		expect(screen.queryByText('Members unlock structured process filters')).not.toBeInTheDocument();
	});
});
