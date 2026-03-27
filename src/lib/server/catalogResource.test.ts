import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSearchCatalog = vi.fn();
const mockGetCatalogDropdown = vi.fn();
const mockGetPublicCatalog = vi.fn();
const mockCheckRateLimit = vi.fn();
const mockGetApiRowLimit = vi.fn();
const mockGetLegacyRateLimitTier = vi.fn();
const mockLogApiUsage = vi.fn();
const mockRequireApiKeyAccess = vi.fn();
const mockResolvePrincipal = vi.fn();
const mockIsApiKeyPrincipal = vi.fn();
const mockIsSessionPrincipal = vi.fn();
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
	CATALOG_API_COLUMNS: 'id,name',
	searchCatalog: mockSearchCatalog,
	getCatalogDropdown: mockGetCatalogDropdown,
	getPublicCatalog: mockGetPublicCatalog
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
	isSessionPrincipal: mockIsSessionPrincipal
}));

vi.mock('$lib/supabase-admin', () => ({
	createAdminClient: mockCreateAdminClient
}));

let buildCanonicalCatalogResponse: typeof import('./catalogResource').buildCanonicalCatalogResponse;
let buildLegacyAppCatalogResponse: typeof import('./catalogResource').buildLegacyAppCatalogResponse;
let buildLegacyExternalCatalogResponse: typeof import('./catalogResource').buildLegacyExternalCatalogResponse;

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
	mockGetPublicCatalog.mockResolvedValue([]);
	mockSearchCatalog.mockResolvedValue({
		data: [sampleCatalogItem],
		count: 1,
		filtersApplied: {}
	});

	({
		buildCanonicalCatalogResponse,
		buildLegacyAppCatalogResponse,
		buildLegacyExternalCatalogResponse
	} = await import('./catalogResource'));
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

	it('prefers canonical price_per_lb query params for per-pound price filtering', async () => {
		mockResolvePrincipal.mockResolvedValue({
			isAuthenticated: false,
			primaryAppRole: null,
			apiPlan: null
		});
		mockIsApiKeyPrincipal.mockReturnValue(false);
		mockIsSessionPrincipal.mockReturnValue(false);

		await buildCanonicalCatalogResponse(
			makeEvent(
				'https://app.test/v1/catalog?price_per_lb_min=7.25&price_per_lb_max=8.5&cost_lb_min=1&cost_lb_max=2'
			)
		);

		expect(mockSearchCatalog).toHaveBeenCalledWith(
			{ kind: 'session-client' },
			expect.objectContaining({
				pricePerLbMin: 7.25,
				pricePerLbMax: 8.5
			})
		);
	});

	it('maps deprecated cost_lb query params onto price_per_lb filtering for compatibility', async () => {
		mockResolvePrincipal.mockResolvedValue({
			isAuthenticated: false,
			primaryAppRole: null,
			apiPlan: null
		});
		mockIsApiKeyPrincipal.mockReturnValue(false);
		mockIsSessionPrincipal.mockReturnValue(false);

		await buildCanonicalCatalogResponse(
			makeEvent('https://app.test/v1/catalog?cost_lb_min=6.5&cost_lb_max=7.75')
		);

		expect(mockSearchCatalog).toHaveBeenCalledWith(
			{ kind: 'session-client' },
			expect.objectContaining({
				pricePerLbMin: 6.5,
				pricePerLbMax: 7.75
			})
		);
	});

	it('lets member sessions request wholesale-visible catalog data with the same contract', async () => {
		mockResolvePrincipal.mockResolvedValue({
			isAuthenticated: true,
			primaryAppRole: 'member',
			apiPlan: 'viewer',
			session: { access_token: 'cookie-token' }
		});
		mockIsApiKeyPrincipal.mockReturnValue(false);
		mockIsSessionPrincipal.mockReturnValue(true);

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

	it('treats bearer-authenticated requests as public-only for canonical page visibility decisions', async () => {
		mockResolvePrincipal.mockResolvedValue({
			isAuthenticated: true,
			primaryAppRole: 'member',
			apiPlan: 'viewer',
			session: null
		});
		mockIsApiKeyPrincipal.mockReturnValue(false);
		mockIsSessionPrincipal.mockReturnValue(true);

		const response = await buildCanonicalCatalogResponse(
			makeEvent('https://app.test/v1/catalog?showWholesale=true')
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.meta.access.publicOnly).toBe(true);
		expect(body.meta.access.showWholesale).toBe(false);
		expect(mockSearchCatalog).toHaveBeenCalledWith(
			{ kind: 'session-client' },
			expect.objectContaining({
				publicOnly: true,
				showWholesale: false,
				wholesaleOnly: false
			})
		);
	});

	it('applies api-key rate limits and row limits while keeping the canonical response shape', async () => {
		const apiKeyPrincipal = {
			isAuthenticated: true,
			primaryAppRole: 'viewer',
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

describe('buildLegacyAppCatalogResponse', () => {
	it('returns the legacy array shape for unpaginated requests without reparsing a Response', async () => {
		mockResolvePrincipal.mockResolvedValue({
			isAuthenticated: true,
			primaryAppRole: 'member',
			apiPlan: 'viewer',
			session: { access_token: 'cookie-token' }
		});
		mockIsApiKeyPrincipal.mockReturnValue(false);
		mockIsSessionPrincipal.mockReturnValue(true);

		const response = await buildLegacyAppCatalogResponse(makeEvent('https://app.test/api/catalog'));
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual([expect.objectContaining({ id: 1, name: 'Ethiopia Sidamo Grade 1' })]);
		expect(response.headers.get('X-Purveyors-Canonical-Resource')).toBe('/v1/catalog');
		expect(mockSearchCatalog).toHaveBeenCalledWith(
			{ kind: 'session-client' },
			expect.objectContaining({
				stockedOnly: true,
				publicOnly: false,
				showWholesale: false,
				limit: undefined,
				offset: undefined
			})
		);
	});

	it('preserves the legacy paginated shape for compatibility consumers', async () => {
		mockResolvePrincipal.mockResolvedValue({
			isAuthenticated: false,
			primaryAppRole: null,
			apiPlan: null
		});
		mockIsApiKeyPrincipal.mockReturnValue(false);
		mockIsSessionPrincipal.mockReturnValue(false);

		const response = await buildLegacyAppCatalogResponse(
			makeEvent('https://app.test/api/catalog?page=2&limit=10')
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual({
			data: [expect.objectContaining({ id: 1, name: 'Ethiopia Sidamo Grade 1' })],
			pagination: expect.objectContaining({ page: 2, limit: 10 })
		});
		expect(response.headers.get('X-Purveyors-Canonical-Resource')).toBe('/v1/catalog');
	});
});

describe('buildLegacyExternalCatalogResponse', () => {
	it('preserves the legacy external auth requirement', async () => {
		mockRequireApiKeyAccess.mockRejectedValue(new MockAuthError('API key authentication required'));

		const response = await buildLegacyExternalCatalogResponse(
			makeEvent('https://app.test/api/catalog-api'),
			{ requestPath: '/api/catalog-api' }
		);
		const body = await response.json();

		expect(response.status).toBe(401);
		expect(body).toEqual({
			error: 'Authentication required',
			message: 'API key authentication required'
		});
	});

	it('restores the legacy external projection, ordering, and fresh-cache metadata', async () => {
		const apiKeyPrincipal = {
			apiKeyId: 'key-1',
			apiPlan: 'viewer'
		};
		mockRequireApiKeyAccess.mockResolvedValue(apiKeyPrincipal);
		mockGetPublicCatalog.mockResolvedValue([
			{ id: 2, name: 'Zulu', extra: 'ignore-me' },
			{ id: 1, name: 'Alpha', public_coffee: true }
		]);

		const response = await buildLegacyExternalCatalogResponse(
			makeEvent('https://app.test/api/catalog-api', {
				Authorization: 'Bearer pk_live_valid'
			}),
			{ requestPath: '/api/catalog-api' }
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(mockGetPublicCatalog).toHaveBeenCalledWith({ kind: 'admin-client' }, 'id,name');
		expect(body.data).toEqual([
			{ id: 1, name: 'Alpha' },
			{ id: 2, name: 'Zulu' }
		]);
		expect(body.total).toBe(2);
		expect(body.total_available).toBe(2);
		expect(body.limited).toBe(false);
		expect(body.limit).toBe(25);
		expect(body.tier).toBe('viewer');
		expect(body.cached).toBe(false);
		expect(body).not.toHaveProperty('cache_timestamp');
		expect(body).toHaveProperty('last_updated');
		expect(body.api_version).toBe('1.0');
		expect(response.headers.get('X-RateLimit-Limit')).toBe('200');
		expect(response.headers.get('X-Purveyors-Canonical-Resource')).toBe('/v1/catalog');
		expect(mockLogApiUsage).toHaveBeenCalledWith(
			'key-1',
			'/api/catalog-api',
			200,
			expect.any(Number),
			undefined,
			undefined
		);
	});

	it('reuses the legacy cache and applies row limiting on cached responses', async () => {
		const apiKeyPrincipal = {
			apiKeyId: 'key-1',
			apiPlan: 'viewer'
		};
		mockRequireApiKeyAccess.mockResolvedValue(apiKeyPrincipal);
		mockGetApiRowLimit.mockReturnValue(1);
		mockGetPublicCatalog.mockResolvedValue([
			{ id: 2, name: 'Zulu' },
			{ id: 1, name: 'Alpha' }
		]);

		await buildLegacyExternalCatalogResponse(
			makeEvent('https://app.test/api/catalog-api', {
				Authorization: 'Bearer pk_live_valid'
			}),
			{ requestPath: '/api/catalog-api' }
		);
		const cachedResponse = await buildLegacyExternalCatalogResponse(
			makeEvent('https://app.test/api/catalog-api', {
				Authorization: 'Bearer pk_live_valid'
			}),
			{ requestPath: '/api/catalog-api' }
		);
		const body = await cachedResponse.json();

		expect(mockGetPublicCatalog).toHaveBeenCalledTimes(1);
		expect(body.data).toEqual([{ id: 1, name: 'Alpha' }]);
		expect(body.total).toBe(1);
		expect(body.total_available).toBe(2);
		expect(body.limited).toBe(true);
		expect(body.limit).toBe(1);
		expect(body.cached).toBe(true);
		expect(body).toHaveProperty('cache_timestamp');
		expect(body).not.toHaveProperty('last_updated');
	});
});
