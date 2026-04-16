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
	isSessionPrincipal: mockIsSessionPrincipal
}));

vi.mock('$lib/supabase-admin', () => ({
	createAdminClient: mockCreateAdminClient
}));

let buildCanonicalCatalogResponse: typeof import('./catalogResource').buildCanonicalCatalogResponse;
let buildLegacyAppCatalogResponse: typeof import('./catalogResource').buildLegacyAppCatalogResponse;

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

	({ buildCanonicalCatalogResponse, buildLegacyAppCatalogResponse } = await import(
		'./catalogResource'
	));
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
				stockedFilter: true,
				publicOnly: true,
				limit: 15,
				offset: 0
			})
		);
	});

	it('applies anonymous contract defaults when no explicit page or limit are provided', async () => {
		mockResolvePrincipal.mockResolvedValue({
			isAuthenticated: false,
			primaryAppRole: null,
			apiPlan: null
		});
		mockIsApiKeyPrincipal.mockReturnValue(false);
		mockIsSessionPrincipal.mockReturnValue(false);
		mockSearchCatalog.mockResolvedValue({
			data: [sampleCatalogItem],
			count: 250,
			filtersApplied: {}
		});

		const response = await buildCanonicalCatalogResponse(makeEvent('https://app.test/v1/catalog'));
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.meta.auth.kind).toBe('anonymous');
		expect(body.meta.access.publicOnly).toBe(true);
		expect(body.pagination).toMatchObject({ page: 1, limit: 15, total: 250, totalPages: 17 });
		expect(mockSearchCatalog).toHaveBeenCalledWith(
			{ kind: 'session-client' },
			expect.objectContaining({
				stockedFilter: true,
				publicOnly: true,
				country: undefined,
				processing: undefined,
				name: undefined,
				limit: 15,
				offset: 0,
				orderBy: 'stocked_date',
				orderDirection: 'desc'
			})
		);
	});

	it('keeps access.limited false for paginated requests when no row cap applies', async () => {
		mockResolvePrincipal.mockResolvedValue({
			isAuthenticated: false,
			primaryAppRole: null,
			apiPlan: null
		});
		mockIsApiKeyPrincipal.mockReturnValue(false);
		mockIsSessionPrincipal.mockReturnValue(false);
		mockSearchCatalog.mockResolvedValue({
			data: Array.from({ length: 3 }, (_, index) => ({
				...sampleCatalogItem,
				id: index + 1,
				name: `Coffee ${index + 1}`
			})),
			count: 1137,
			filtersApplied: {}
		});

		const response = await buildCanonicalCatalogResponse(
			makeEvent('https://app.test/v1/catalog?page=1&limit=3')
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.meta.access.rowLimit).toBeNull();
		expect(body.meta.access.limited).toBe(false);
		expect(body.pagination).toMatchObject({ page: 1, limit: 3, total: 1137, totalPages: 379 });
	});

	it('caps anonymous limits at 15 rows', async () => {
		mockResolvePrincipal.mockResolvedValue({
			isAuthenticated: false,
			primaryAppRole: null,
			apiPlan: null
		});
		mockIsApiKeyPrincipal.mockReturnValue(false);
		mockIsSessionPrincipal.mockReturnValue(false);
		mockSearchCatalog.mockResolvedValue({
			data: Array.from({ length: 15 }, (_, index) => ({
				...sampleCatalogItem,
				id: index + 1,
				name: `Coffee ${index + 1}`
			})),
			count: 1137,
			filtersApplied: {}
		});

		const response = await buildCanonicalCatalogResponse(
			makeEvent('https://app.test/v1/catalog?limit=500')
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.pagination).toMatchObject({ page: 1, limit: 15, total: 1137, totalPages: 76 });
		expect(mockSearchCatalog).toHaveBeenCalledWith(
			{ kind: 'session-client' },
			expect.objectContaining({
				limit: 15,
				offset: 0,
				orderBy: 'stocked_date',
				orderDirection: 'desc'
			})
		);
	});

	it.each([
		['page', 'abc', 'positive integer'],
		['page', '-1', 'positive integer'],
		['limit', '3.5', 'positive integer'],
		['score_value_min', 'seven', 'number'],
		['score_value_max', '88points', 'number'],
		['price_per_lb_min', 'cheap', 'number'],
		['price_per_lb_max', '12usd', 'number'],
		['cost_lb_min', 'legacy', 'number'],
		['cost_lb_max', 'legacy-max', 'number'],
		['stocked_days', 'thirty', 'positive integer']
	])('rejects invalid numeric query param %s=%s', async (parameter, value, expected) => {
		mockResolvePrincipal.mockResolvedValue({
			isAuthenticated: false,
			primaryAppRole: null,
			apiPlan: null
		});
		mockIsApiKeyPrincipal.mockReturnValue(false);
		mockIsSessionPrincipal.mockReturnValue(false);

		const response = await buildCanonicalCatalogResponse(
			makeEvent(`https://app.test/v1/catalog?${parameter}=${encodeURIComponent(value)}`)
		);
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body).toEqual({
			error: 'Invalid query parameter',
			message: `Query parameter "${parameter}" must use ${expected} format`,
			details: {
				parameter,
				value,
				expected
			}
		});
		expect(mockSearchCatalog).not.toHaveBeenCalled();
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

	it('rejects anonymous filters outside the public contract', async () => {
		mockResolvePrincipal.mockResolvedValue({
			isAuthenticated: false,
			primaryAppRole: null,
			apiPlan: null
		});
		mockIsApiKeyPrincipal.mockReturnValue(false);
		mockIsSessionPrincipal.mockReturnValue(false);

		const response = await buildCanonicalCatalogResponse(
			makeEvent('https://app.test/v1/catalog?stocked_date=2026-03-01&stocked_days=30')
		);
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body).toEqual({
			error: 'Anonymous catalog contract violation',
			message: 'Anonymous catalog requests only allow filters: country, processing, name',
			details: { parameter: 'stocked_date' }
		});
		expect(mockSearchCatalog).not.toHaveBeenCalled();
	});

	it('rejects invalid stocked_date values with a structured 400 response', async () => {
		mockResolvePrincipal.mockResolvedValue({
			isAuthenticated: false,
			primaryAppRole: null,
			apiPlan: null
		});
		mockIsApiKeyPrincipal.mockReturnValue(false);
		mockIsSessionPrincipal.mockReturnValue(false);

		const response = await buildCanonicalCatalogResponse(
			makeEvent('https://app.test/v1/catalog?stocked_date=30')
		);
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body).toEqual({
			error: 'Invalid query parameter',
			message: 'Query parameter "stocked_date" must use YYYY-MM-DD format',
			details: {
				parameter: 'stocked_date',
				value: '30',
				expected: 'YYYY-MM-DD'
			}
		});
		expect(mockSearchCatalog).not.toHaveBeenCalled();
	});

	it.each(['abc', '-1', '3.5', '0', '7abc'])(
		'rejects invalid stocked_days value %s with a structured 400 response',
		async (stockedDays) => {
			mockResolvePrincipal.mockResolvedValue({
				isAuthenticated: false,
				primaryAppRole: null,
				apiPlan: null
			});
			mockIsApiKeyPrincipal.mockReturnValue(false);
			mockIsSessionPrincipal.mockReturnValue(false);

			const response = await buildCanonicalCatalogResponse(
				makeEvent(`https://app.test/v1/catalog?stocked_days=${stockedDays}`)
			);
			const body = await response.json();

			expect(response.status).toBe(400);
			expect(body).toEqual({
				error: 'Invalid query parameter',
				message: 'Query parameter "stocked_days" must use positive integer format',
				details: {
					parameter: 'stocked_days',
					value: stockedDays,
					expected: 'positive integer'
				}
			});
			expect(mockSearchCatalog).not.toHaveBeenCalled();
		}
	);

	it('rejects anonymous ids, dropdown fields, and deep paging', async () => {
		mockResolvePrincipal.mockResolvedValue({
			isAuthenticated: false,
			primaryAppRole: null,
			apiPlan: null
		});
		mockIsApiKeyPrincipal.mockReturnValue(false);
		mockIsSessionPrincipal.mockReturnValue(false);

		await expect(
			buildCanonicalCatalogResponse(makeEvent('https://app.test/v1/catalog?ids=1'))
		).resolves.toMatchObject({ status: 400 });
		await expect(
			buildCanonicalCatalogResponse(makeEvent('https://app.test/v1/catalog?fields=dropdown'))
		).resolves.toMatchObject({ status: 400 });
		await expect(
			buildCanonicalCatalogResponse(makeEvent('https://app.test/v1/catalog?page=2'))
		).resolves.toMatchObject({ status: 400 });
	});

	it('allows anonymous callers to explicitly request the default stocked_date desc sort', async () => {
		mockResolvePrincipal.mockResolvedValue({
			isAuthenticated: false,
			primaryAppRole: null,
			apiPlan: null
		});
		mockIsApiKeyPrincipal.mockReturnValue(false);
		mockIsSessionPrincipal.mockReturnValue(false);

		const response = await buildCanonicalCatalogResponse(
			makeEvent('https://app.test/v1/catalog?sortField=stocked_date&sortDirection=desc')
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.meta.auth.kind).toBe('anonymous');
		expect(mockSearchCatalog).toHaveBeenCalledWith(
			{ kind: 'session-client' },
			expect.objectContaining({
				sortField: 'stocked_date',
				sortDirection: 'desc',
				publicOnly: true,
				stockedFilter: true
			})
		);
	});

	it('rejects non-default anonymous sort requests', async () => {
		mockResolvePrincipal.mockResolvedValue({
			isAuthenticated: false,
			primaryAppRole: null,
			apiPlan: null
		});
		mockIsApiKeyPrincipal.mockReturnValue(false);
		mockIsSessionPrincipal.mockReturnValue(false);

		const response = await buildCanonicalCatalogResponse(
			makeEvent('https://app.test/v1/catalog?sortField=arrival_date&sortDirection=asc')
		);
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body).toEqual({
			error: 'Anonymous catalog contract violation',
			message: 'Anonymous catalog requests only support the default sort stocked_date desc',
			details: { parameter: 'sortField' }
		});
		expect(mockSearchCatalog).not.toHaveBeenCalled();
	});

	it('viewer sessions keep the broader catalog parameter surface while anonymous callers stay teaser-only', async () => {
		mockResolvePrincipal.mockResolvedValue({
			isAuthenticated: true,
			primaryAppRole: 'viewer',
			apiPlan: null,
			session: { access_token: 'cookie-token' }
		});
		mockIsApiKeyPrincipal.mockReturnValue(false);
		mockIsSessionPrincipal.mockReturnValue(true);

		const response = await buildCanonicalCatalogResponse(
			makeEvent(
				'https://app.test/v1/catalog?page=2&limit=10&score_value_min=84&price_per_lb_min=7.25&stocked_days=30&sortField=arrival_date&sortDirection=asc'
			)
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.meta.auth.kind).toBe('session');
		expect(body.meta.access.publicOnly).toBe(true);
		expect(body.pagination).toMatchObject({ page: 2, limit: 10 });
		expect(mockSearchCatalog).toHaveBeenCalledWith(
			{ kind: 'session-client' },
			expect.objectContaining({
				publicOnly: true,
				stockedFilter: true,
				scoreValueMin: 84,
				pricePerLbMin: 7.25,
				stockedDays: 30,
				orderBy: 'arrival_date',
				orderDirection: 'asc',
				limit: 10,
				offset: 10
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
		expect(response.headers.get('X-RateLimit-Reset')).toBe('1774569600');
		expect(mockSearchCatalog).toHaveBeenCalledWith(
			{ kind: 'admin-client' },
			expect.objectContaining({
				stockedFilter: true,
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

	it('keeps access.limited false when a row-capped response still fits within the cap', async () => {
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
			data: Array.from({ length: 10 }, (_, index) => ({
				...sampleCatalogItem,
				id: index + 1,
				name: `Coffee ${index + 1}`
			})),
			count: 10,
			filtersApplied: {}
		});

		const response = await buildCanonicalCatalogResponse(
			makeEvent('https://app.test/v1/catalog', {
				Authorization: 'Bearer pk_live_valid'
			})
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.meta.access.rowLimit).toBe(25);
		expect(body.meta.access.limited).toBe(false);
		expect(body.pagination).toMatchObject({ page: 1, limit: 25, total: 10, totalPages: 1 });
	});

	it('preserves HTTP 401 for invalid bearer tokens', async () => {
		mockResolvePrincipal.mockResolvedValue({
			isAuthenticated: false,
			primaryAppRole: null,
			apiPlan: null
		});
		mockIsApiKeyPrincipal.mockReturnValue(false);
		mockIsSessionPrincipal.mockReturnValue(false);

		const response = await buildCanonicalCatalogResponse(
			makeEvent('https://app.test/v1/catalog', {
				Authorization: 'Bearer definitely_invalid'
			})
		);
		const body = await response.json();

		expect(response.status).toBe(401);
		expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
		expect(body).toEqual({
			error: 'Authentication required',
			message: 'Authentication required'
		});
	});

	it('preserves HTTP 429 and rate-limit headers for capped api-key requests', async () => {
		const resetTime = new Date('2026-03-28T00:00:00Z');
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
		mockCheckRateLimit.mockResolvedValue({
			allowed: false,
			limit: 200,
			remaining: 0,
			resetTime,
			retryAfter: 3600
		});

		const response = await buildCanonicalCatalogResponse(
			makeEvent('https://app.test/v1/catalog', {
				Authorization: 'Bearer pk_live_valid'
			})
		);
		const body = await response.json();

		expect(response.status).toBe(429);
		expect(response.headers.get('X-RateLimit-Limit')).toBe('200');
		expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
		expect(response.headers.get('X-RateLimit-Reset')).toBe(
			Math.floor(resetTime.getTime() / 1000).toString()
		);
		expect(response.headers.get('Retry-After')).toBe('3600');
		expect(body).toEqual({
			error: 'Rate limit exceeded',
			message: 'API rate limit exceeded for your subscription plan',
			limit: 200,
			remaining: 0,
			resetTime: resetTime.toISOString()
		});
		expect(mockLogApiUsage).toHaveBeenCalledWith(
			'key-1',
			'/v1/catalog',
			429,
			expect.any(Number),
			undefined,
			undefined
		);
	});

	describe('stocked query parameter', () => {
		beforeEach(() => {
			mockResolvePrincipal.mockResolvedValue({
				isAuthenticated: false,
				primaryAppRole: null,
				apiPlan: null
			});
			mockIsApiKeyPrincipal.mockReturnValue(false);
			mockIsSessionPrincipal.mockReturnValue(false);
		});

		it('passes stockedFilter=true to searchCatalog when stocked=true is set', async () => {
			await buildCanonicalCatalogResponse(
				makeEvent('https://app.test/v1/catalog?stocked=true&page=1&limit=10')
			);
			expect(mockSearchCatalog).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({ stockedFilter: true })
			);
		});

		it('passes stockedFilter=true when no stocked param is provided (backward compat default)', async () => {
			await buildCanonicalCatalogResponse(makeEvent('https://app.test/v1/catalog?page=1&limit=10'));
			expect(mockSearchCatalog).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({ stockedFilter: true })
			);
		});

		it('passes stockedFilter=false to searchCatalog when stocked=false is set', async () => {
			await buildCanonicalCatalogResponse(
				makeEvent('https://app.test/v1/catalog?stocked=false&page=1&limit=10')
			);
			expect(mockSearchCatalog).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({ stockedFilter: false })
			);
		});

		it('passes stockedFilter=null to searchCatalog when stocked=all is set', async () => {
			await buildCanonicalCatalogResponse(
				makeEvent('https://app.test/v1/catalog?stocked=all&page=1&limit=10')
			);
			expect(mockSearchCatalog).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({ stockedFilter: null })
			);
		});
	});

	describe('origin query parameter', () => {
		beforeEach(() => {
			mockResolvePrincipal.mockResolvedValue({
				isAuthenticated: false,
				primaryAppRole: null,
				apiPlan: null
			});
			mockIsApiKeyPrincipal.mockReturnValue(false);
			mockIsSessionPrincipal.mockReturnValue(false);
		});

		it('passes origin to searchCatalog when origin param is set', async () => {
			await buildCanonicalCatalogResponse(
				makeEvent('https://app.test/v1/catalog?origin=Ethiopia&page=1&limit=10')
			);
			expect(mockSearchCatalog).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({ origin: 'Ethiopia' })
			);
		});

		it('passes origin=Africa for continent-level matching', async () => {
			await buildCanonicalCatalogResponse(
				makeEvent('https://app.test/v1/catalog?origin=Africa&page=1&limit=10')
			);
			expect(mockSearchCatalog).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({ origin: 'Africa' })
			);
		});

		it('does not pass origin when param is absent', async () => {
			await buildCanonicalCatalogResponse(
				makeEvent('https://app.test/v1/catalog?country=Ethiopia&page=1&limit=10')
			);
			expect(mockSearchCatalog).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({ origin: undefined })
			);
		});

		it('supports both origin and country params simultaneously', async () => {
			await buildCanonicalCatalogResponse(
				makeEvent('https://app.test/v1/catalog?origin=Africa&country=Ethiopia&page=1&limit=10')
			);
			expect(mockSearchCatalog).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({ origin: 'Africa', country: 'Ethiopia' })
			);
		});
	});

	describe('dropdown path stocked filtering', () => {
		beforeEach(() => {
			mockResolvePrincipal.mockResolvedValue({
				isAuthenticated: false,
				primaryAppRole: null,
				apiPlan: null
			});
			mockIsApiKeyPrincipal.mockReturnValue(false);
			mockIsSessionPrincipal.mockReturnValue(false);
		});

		it('passes stockedFilter=true to getCatalogDropdown when stocked=true is set', async () => {
			await buildCanonicalCatalogResponse(
				makeEvent('https://app.test/v1/catalog?fields=dropdown&stocked=true')
			);
			expect(mockGetCatalogDropdown).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({ stockedFilter: true })
			);
		});

		it('passes stockedFilter=true to getCatalogDropdown when no stocked param provided (backward compat)', async () => {
			await buildCanonicalCatalogResponse(makeEvent('https://app.test/v1/catalog?fields=dropdown'));
			expect(mockGetCatalogDropdown).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({ stockedFilter: true })
			);
		});

		it('passes stockedFilter=false to getCatalogDropdown when stocked=false is set', async () => {
			await buildCanonicalCatalogResponse(
				makeEvent('https://app.test/v1/catalog?fields=dropdown&stocked=false')
			);
			expect(mockGetCatalogDropdown).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({ stockedFilter: false })
			);
		});

		it('passes stockedFilter=null to getCatalogDropdown when stocked=all is set', async () => {
			await buildCanonicalCatalogResponse(
				makeEvent('https://app.test/v1/catalog?fields=dropdown&stocked=all')
			);
			expect(mockGetCatalogDropdown).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({ stockedFilter: null })
			);
		});
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
				stockedFilter: true,
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

	it('preserves upstream auth failures for legacy callers', async () => {
		mockResolvePrincipal.mockResolvedValue({
			isAuthenticated: false,
			primaryAppRole: null,
			apiPlan: null
		});
		mockIsApiKeyPrincipal.mockReturnValue(false);
		mockIsSessionPrincipal.mockReturnValue(false);

		const response = await buildLegacyAppCatalogResponse(
			makeEvent('https://app.test/api/catalog-api', {
				Authorization: 'Bearer definitely_invalid'
			})
		);
		const body = await response.json();

		expect(response.status).toBe(401);
		expect(body).toEqual({
			error: 'Authentication required',
			message: 'Authentication required'
		});
	});

	it('preserves upstream query validation failures for legacy callers', async () => {
		mockResolvePrincipal.mockResolvedValue({
			isAuthenticated: true,
			primaryAppRole: 'member',
			apiPlan: 'viewer',
			session: { access_token: 'cookie-token' }
		});
		mockIsApiKeyPrincipal.mockReturnValue(false);
		mockIsSessionPrincipal.mockReturnValue(true);

		const response = await buildLegacyAppCatalogResponse(
			makeEvent('https://app.test/api/catalog?stocked_date=30')
		);
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body).toEqual({
			error: 'Invalid query parameter',
			message: 'Query parameter "stocked_date" must use YYYY-MM-DD format',
			details: {
				parameter: 'stocked_date',
				value: '30',
				expected: 'YYYY-MM-DD'
			}
		});
		expect(response.headers.get('X-Purveyors-Canonical-Resource')).toBeNull();
	});

	it('preserves upstream rate-limit failures for legacy callers', async () => {
		const resetTime = new Date('2026-03-28T00:00:00Z');
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
		mockCheckRateLimit.mockResolvedValue({
			allowed: false,
			limit: 200,
			remaining: 0,
			resetTime,
			retryAfter: 3600
		});

		const response = await buildLegacyAppCatalogResponse(
			makeEvent('https://app.test/api/catalog-api', {
				Authorization: 'Bearer pk_live_valid'
			})
		);
		const body = await response.json();

		expect(response.status).toBe(429);
		expect(response.headers.get('X-RateLimit-Limit')).toBe('200');
		expect(body).toEqual({
			error: 'Rate limit exceeded',
			message: 'API rate limit exceeded for your subscription plan',
			limit: 200,
			remaining: 0,
			resetTime: resetTime.toISOString()
		});
	});
});
