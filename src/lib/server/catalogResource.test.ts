import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSearchCatalog = vi.fn();
const mockGetCatalogDropdown = vi.fn();
const mockCheckRateLimit = vi.fn();
const mockGetApiRowLimit = vi.fn();
const mockGetLegacyRateLimitTier = vi.fn();
const mockLogApiUsage = vi.fn();
const mockRequireApiKeyAccess = vi.fn();
const mockResolvePrincipal = vi.fn();
const mockIsApiKeyPrincipal = vi.fn();
const mockIsSessionPrincipal = vi.fn();
const mockPrincipalHasRole = vi.fn();
const mockCreateAdminClient = vi.fn();

class MockAuthError extends Error {
	constructor(
		message: string,
		public status = 401
	) {
		super(message);
		this.name = 'AuthError';
	}
}

vi.mock('$lib/data/catalog', () => ({
	searchCatalog: mockSearchCatalog,
	getCatalogDropdown: mockGetCatalogDropdown
}));

vi.mock('$lib/server/apiAuth', () => ({
	checkRateLimit: mockCheckRateLimit,
	getApiRowLimit: mockGetApiRowLimit,
	getLegacyRateLimitTier: mockGetLegacyRateLimitTier,
	logApiUsage: mockLogApiUsage
}));

vi.mock('$lib/server/auth', () => ({
	AuthError: MockAuthError,
	requireApiKeyAccess: mockRequireApiKeyAccess
}));

vi.mock('$lib/server/principal', () => ({
	resolvePrincipal: mockResolvePrincipal,
	isApiKeyPrincipal: mockIsApiKeyPrincipal,
	isSessionPrincipal: mockIsSessionPrincipal,
	principalHasRole: mockPrincipalHasRole
}));

vi.mock('$lib/supabase-admin', () => ({
	createAdminClient: mockCreateAdminClient
}));

let buildCanonicalCatalogResponse: typeof import('./catalogResource').buildCanonicalCatalogResponse;

const sampleCatalogItem = {
	id: 1,
	name: 'Ethiopia Sidamo Grade 1',
	source: 'sweet_maria',
	stocked: true,
	cost_lb: 7.5,
	price_per_lb: 7.5,
	price_tiers: null,
	public_coffee: true,
	wholesale: false,
	ai_description: 'Floral and citrus',
	ai_tasting_notes: null,
	appearance: '15/17',
	arrival_date: '2024-01-15',
	bag_size: '60kg',
	continent: 'Africa',
	country: 'Ethiopia',
	cultivar_detail: 'Heirloom',
	cupping_notes: null,
	description_long: null,
	description_short: null,
	drying_method: 'Patio',
	farm_notes: null,
	grade: 'Grade 1',
	last_updated: '2024-01-20',
	link: 'https://supplier.test/ethiopia',
	lot_size: '320 bags',
	packaging: 'GrainPro',
	processing: 'Washed',
	region: 'Sidamo',
	roast_recs: 'City+',
	score_value: 87.5,
	stocked_date: '2024-01-15',
	type: 'Arabica',
	unstocked_date: null,
	coffee_user: null
};

function makeEvent(url: string, headers: HeadersInit = {}) {
	return {
		url: new URL(url),
		request: new Request(url, { headers }),
		locals: {
			supabase: { kind: 'session-client' }
		}
	} as unknown as Parameters<typeof buildCanonicalCatalogResponse>[0];
}

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();

	mockGetApiRowLimit.mockReturnValue(25);
	mockGetLegacyRateLimitTier.mockReturnValue('api_viewer');
	mockCheckRateLimit.mockResolvedValue({
		allowed: true,
		limit: 200,
		remaining: 199,
		resetTime: new Date('2026-03-27T00:00:00Z')
	});
	mockLogApiUsage.mockResolvedValue(undefined);
	mockCreateAdminClient.mockReturnValue({ kind: 'admin-client' });
	mockGetCatalogDropdown.mockResolvedValue([]);
	mockSearchCatalog.mockResolvedValue({
		data: [sampleCatalogItem],
		count: 1,
		filtersApplied: {}
	});

	({ buildCanonicalCatalogResponse } = await import('./catalogResource'));
});

describe('buildCanonicalCatalogResponse', () => {
	it('serves anonymous catalog requests through the public canonical contract', async () => {
		mockResolvePrincipal.mockResolvedValue({
			isAuthenticated: false,
			primaryAppRole: null,
			apiPlan: null
		});
		mockIsApiKeyPrincipal.mockReturnValue(false);
		mockIsSessionPrincipal.mockReturnValue(false);
		mockPrincipalHasRole.mockReturnValue(false);

		const response = await buildCanonicalCatalogResponse(
			makeEvent('https://app.test/v1/catalog?page=1&limit=15')
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.meta.auth.kind).toBe('anonymous');
		expect(body.meta.access.publicOnly).toBe(true);
		expect(body.pagination).toMatchObject({ page: 1, limit: 15, total: 1 });
		expect(mockSearchCatalog).toHaveBeenCalledWith(
			{ kind: 'session-client' },
			expect.objectContaining({
				stockedOnly: true,
				publicOnly: true,
				limit: 15,
				offset: 0
			})
		);
	});

	it('lets member sessions request wholesale-visible catalog data with the same contract', async () => {
		mockResolvePrincipal.mockResolvedValue({
			isAuthenticated: true,
			primaryAppRole: 'member',
			apiPlan: 'viewer'
		});
		mockIsApiKeyPrincipal.mockReturnValue(false);
		mockIsSessionPrincipal.mockReturnValue(true);
		mockPrincipalHasRole.mockReturnValue(true);

		const response = await buildCanonicalCatalogResponse(
			makeEvent('https://app.test/v1/catalog?page=2&limit=10&showWholesale=true')
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.meta.auth.kind).toBe('session');
		expect(body.meta.access.publicOnly).toBe(false);
		expect(body.meta.access.showWholesale).toBe(true);
		expect(body.pagination).toMatchObject({ page: 2, limit: 10 });
		expect(mockSearchCatalog).toHaveBeenCalledWith(
			{ kind: 'session-client' },
			expect.objectContaining({
				publicOnly: false,
				showWholesale: true,
				limit: 10,
				offset: 10
			})
		);
	});

	it('applies api-key rate limits and row limits while keeping the canonical response shape', async () => {
		const apiKeyPrincipal = {
			isAuthenticated: true,
			primaryAppRole: 'api-member',
			apiPlan: 'viewer',
			apiKeyId: 'key-1'
		};

		mockResolvePrincipal.mockResolvedValue(apiKeyPrincipal);
		mockIsApiKeyPrincipal.mockReturnValue(true);
		mockIsSessionPrincipal.mockReturnValue(false);
		mockRequireApiKeyAccess.mockResolvedValue(apiKeyPrincipal);
		mockSearchCatalog.mockResolvedValue({
			data: Array.from({ length: 25 }, (_, index) => ({
				...sampleCatalogItem,
				id: index + 1,
				name: `Coffee ${index + 1}`
			})),
			count: 40,
			filtersApplied: {}
		});

		const response = await buildCanonicalCatalogResponse(
			makeEvent('https://app.test/v1/catalog', {
				Authorization: 'Bearer pk_live_valid'
			})
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.meta.auth.kind).toBe('api-key');
		expect(body.meta.access.publicOnly).toBe(true);
		expect(body.meta.access.rowLimit).toBe(25);
		expect(body.meta.access.limited).toBe(true);
		expect(body.pagination).toMatchObject({ page: 1, limit: 25, total: 40 });
		expect(response.headers.get('X-RateLimit-Limit')).toBe('200');
		expect(response.headers.get('X-RateLimit-Remaining')).toBe('199');
		expect(mockSearchCatalog).toHaveBeenCalledWith(
			{ kind: 'admin-client' },
			expect.objectContaining({
				stockedOnly: true,
				publicOnly: true,
				limit: 25,
				offset: 0
			})
		);
		expect(mockLogApiUsage).toHaveBeenCalledWith(
			'key-1',
			'/v1/catalog',
			200,
			expect.any(Number),
			undefined,
			undefined
		);
	});
});
