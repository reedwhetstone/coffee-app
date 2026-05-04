import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import CatalogPage from './+page.svelte';
import type { PageData } from './$types';

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
		...overrides
	} as unknown as PageData;
}

function renderCatalog(data: PageData) {
	return render(CatalogPage, { data });
}

beforeEach(() => {
	vi.clearAllMocks();
	pageState.url = new URL('https://app.test/catalog');
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
										stocked: true
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

describe('/catalog similar comparison controls', () => {
	it('shows a locked member comparison CTA without leaking match data for non-members', () => {
		renderCatalog(createData());

		expect(screen.getByText('Member comparison')).toBeInTheDocument();
		expect(screen.queryByText('Member Match Lot')).not.toBeInTheDocument();
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

		await fireEvent.click(screen.getByRole('button', { name: /compare similar coffees/i }));

		await waitFor(() => expect(screen.getByText('Member Match Lot')).toBeInTheDocument());
		expect(screen.getByText('Match Importer · In stock')).toBeInTheDocument();
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
