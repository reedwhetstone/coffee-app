import { render, screen } from '@testing-library/svelte';
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

			return new Response(JSON.stringify({ data: [], pagination: null }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			});
		})
	);
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
