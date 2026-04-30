import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatAllowedValues, PUBLIC_CATALOG_SORT_FIELDS } from '$lib/catalog/publicQueryContract';
import { MAX_CATALOG_PAGE_LIMIT } from '$lib/constants/catalog';

const mockSearchCatalog = vi.fn();
const mockSearchCatalogDropdown = vi.fn();
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
	searchCatalogDropdown: mockSearchCatalogDropdown,
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
const SORT_FIELD_EXPECTED = formatAllowedValues(PUBLIC_CATALOG_SORT_FIELDS);

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
	processing_base_method: 'Washed',
	fermentation_type: 'None Stated',
	process_additives: ['none'],
	process_additive_detail: null,
	fermentation_duration_hours: null,
	processing_notes: 'Washed process disclosed by supplier label',
	processing_disclosure_level: 'label_only',
	processing_confidence: 0.85,
	processing_evidence: { schema_version: 1 },
	processing_evidence_available: true,
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
	mockSearchCatalogDropdown.mockResolvedValue({
		data: [],
		count: 0
	});
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
				fields: 'resource',
				limit: 15,
				offset: 0
			})
		);
	});

	it('applies canonical listing defaults for anonymous requests when page and limit are omitted', async () => {
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
		expect(body.pagination).toMatchObject({
			page: 1,
			limit: 100,
			total: 250,
			totalPages: 3,
			hasNext: true,
			hasPrev: false
		});
		expect(mockSearchCatalog).toHaveBeenCalledWith(
			{ kind: 'session-client' },
			expect.objectContaining({
				stockedFilter: true,
				publicOnly: true,
				country: undefined,
				processing: undefined,
				name: undefined,
				limit: 100,
				offset: 0,
				orderBy: 'arrival_date',
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
		expect(body.pagination).toMatchObject({
			page: 1,
			limit: 3,
			total: 1137,
			totalPages: 379,
			hasNext: true,
			hasPrev: false
		});
	});

	it('adds a provenance-aware process summary without exposing raw evidence', async () => {
		mockResolvePrincipal.mockResolvedValue({
			isAuthenticated: false,
			primaryAppRole: null,
			apiPlan: null
		});
		mockIsApiKeyPrincipal.mockReturnValue(false);
		mockIsSessionPrincipal.mockReturnValue(false);

		const response = await buildCanonicalCatalogResponse(makeEvent('https://app.test/v1/catalog'));
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.data[0]).toMatchObject({
			processing: 'Washed',
			processing_base_method: 'Washed',
			fermentation_type: 'None Stated',
			process_additives: ['none'],
			process: {
				base_method: 'Washed',
				fermentation_type: 'None Stated',
				additives: ['none'],
				additive_detail: null,
				fermentation_duration_hours: null,
				drying_method: 'Patio',
				notes: 'Washed process disclosed by supplier label',
				disclosure_level: 'label_only',
				confidence: 0.85,
				evidence_available: true
			}
		});
		expect(body.data[0].processing_evidence).toBeUndefined();
		expect(body.data[0].processing_evidence_available).toBeUndefined();
		expect(body.data[0].coffee_user).toBeUndefined();
	});

	it('uses the projected evidence availability boolean when raw evidence is not selected', async () => {
		mockResolvePrincipal.mockResolvedValue({
			isAuthenticated: false,
			primaryAppRole: null,
			apiPlan: null
		});
		mockIsApiKeyPrincipal.mockReturnValue(false);
		mockIsSessionPrincipal.mockReturnValue(false);
		mockSearchCatalog.mockResolvedValue({
			data: [
				{
					...sampleCatalogItem,
					processing_evidence: undefined,
					processing_evidence_available: true
				}
			],
			count: 1,
			filtersApplied: {}
		});

		const response = await buildCanonicalCatalogResponse(makeEvent('https://app.test/v1/catalog'));
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.data[0].process.evidence_available).toBe(true);
		expect(body.data[0].processing_evidence).toBeUndefined();
		expect(body.data[0].processing_evidence_available).toBeUndefined();
	});

	it('preserves null process metadata instead of filling fake placeholders', async () => {
		mockResolvePrincipal.mockResolvedValue({
			isAuthenticated: false,
			primaryAppRole: null,
			apiPlan: null
		});
		mockIsApiKeyPrincipal.mockReturnValue(false);
		mockIsSessionPrincipal.mockReturnValue(false);
		mockSearchCatalog.mockResolvedValue({
			data: [
				{
					...sampleCatalogItem,
					processing_base_method: null,
					fermentation_type: null,
					process_additives: null,
					process_additive_detail: null,
					fermentation_duration_hours: null,
					processing_notes: null,
					processing_disclosure_level: null,
					processing_confidence: null,
					processing_evidence: null,
					processing_evidence_available: false
				}
			],
			count: 1,
			filtersApplied: {}
		});

		const response = await buildCanonicalCatalogResponse(makeEvent('https://app.test/v1/catalog'));
		const body = await response.json();

		expect(body.data[0].process).toEqual({
			base_method: null,
			fermentation_type: null,
			additives: null,
			additive_detail: null,
			fermentation_duration_hours: null,
			drying_method: 'Patio',
			notes: null,
			disclosure_level: null,
			confidence: null,
			evidence_available: false
		});
	});

	it('coerces missing process projection columns to null when resource queries fall back to full rows', async () => {
		mockResolvePrincipal.mockResolvedValue({
			isAuthenticated: false,
			primaryAppRole: null,
			apiPlan: null
		});
		mockIsApiKeyPrincipal.mockReturnValue(false);
		mockIsSessionPrincipal.mockReturnValue(false);
		mockSearchCatalog.mockResolvedValue({
			data: [
				{
					...sampleCatalogItem,
					processing_base_method: undefined,
					fermentation_type: undefined,
					process_additives: undefined,
					process_additive_detail: undefined,
					fermentation_duration_hours: undefined,
					drying_method: undefined,
					processing_notes: undefined,
					processing_disclosure_level: undefined,
					processing_confidence: undefined,
					processing_evidence: undefined,
					processing_evidence_available: false
				}
			],
			count: 1,
			filtersApplied: {}
		});

		const response = await buildCanonicalCatalogResponse(makeEvent('https://app.test/v1/catalog'));
		const body = await response.json();

		expect(body.data[0].process).toEqual({
			base_method: null,
			fermentation_type: null,
			additives: null,
			additive_detail: null,
			fermentation_duration_hours: null,
			drying_method: null,
			notes: null,
			disclosure_level: null,
			confidence: null,
			evidence_available: false
		});
	});

	it('preserves explicit anonymous pagination limits up to the shared max page size', async () => {
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
			makeEvent(`https://app.test/v1/catalog?limit=${MAX_CATALOG_PAGE_LIMIT}`)
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.pagination).toMatchObject({
			page: 1,
			limit: MAX_CATALOG_PAGE_LIMIT,
			total: 1137,
			totalPages: 2,
			hasNext: true,
			hasPrev: false
		});
		expect(mockSearchCatalog).toHaveBeenCalledWith(
			{ kind: 'session-client' },
			expect.objectContaining({
				limit: MAX_CATALOG_PAGE_LIMIT,
				offset: 0,
				orderBy: 'arrival_date',
				orderDirection: 'desc'
			})
		);
	});

	it.each([MAX_CATALOG_PAGE_LIMIT + 100, MAX_CATALOG_PAGE_LIMIT * 2])(
		'rejects oversized limit=%i so pagination metadata cannot lie about truncated responses',
		async (limit) => {
			mockResolvePrincipal.mockResolvedValue({
				isAuthenticated: false,
				primaryAppRole: null,
				apiPlan: null
			});
			mockIsApiKeyPrincipal.mockReturnValue(false);
			mockIsSessionPrincipal.mockReturnValue(false);

			const response = await buildCanonicalCatalogResponse(
				makeEvent(`https://app.test/v1/catalog?limit=${limit}`)
			);
			const body = await response.json();

			expect(response.status).toBe(400);
			expect(body).toEqual({
				error: 'Invalid query parameter',
				message: `Query parameter "limit" must use positive integer less than or equal to ${MAX_CATALOG_PAGE_LIMIT} format`,
				details: {
					parameter: 'limit',
					value: String(limit),
					expected: `positive integer less than or equal to ${MAX_CATALOG_PAGE_LIMIT}`
				}
			});
			expect(mockSearchCatalog).not.toHaveBeenCalled();
		}
	);

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
		['processing_confidence_min', 'high', 'number'],
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

	it('supports broader public filters for anonymous callers', async () => {
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

		expect(response.status).toBe(200);
		expect(body.meta.auth.kind).toBe('anonymous');
		expect(mockSearchCatalog).toHaveBeenCalledWith(
			{ kind: 'session-client' },
			expect.objectContaining({
				publicOnly: true,
				stockedDate: '2026-03-01',
				stockedDays: 30
			})
		);
	});

	it('rejects anonymous processing transparency filters before the catalog data layer', async () => {
		mockResolvePrincipal.mockResolvedValue({
			isAuthenticated: false,
			authKind: 'anonymous',
			primaryAppRole: null,
			apiPlan: null
		});
		mockIsApiKeyPrincipal.mockReturnValue(false);
		mockIsSessionPrincipal.mockReturnValue(false);

		const response = await buildCanonicalCatalogResponse(
			makeEvent('https://app.test/v1/catalog?processing_base_method=Natural')
		);
		const body = await response.json();

		expect(response.status).toBe(401);
		expect(body).toMatchObject({
			error: 'Authentication required',
			message: 'Structured process filters require a member account.',
			code: 'auth_required',
			deniedParams: ['processing_base_method'],
			requiredCapability: 'canUseProcessFacets'
		});
		expect(mockSearchCatalog).not.toHaveBeenCalled();
	});

	it('rejects viewer session processing transparency filters before the catalog data layer', async () => {
		mockResolvePrincipal.mockResolvedValue({
			isAuthenticated: true,
			authKind: 'session',
			session: { access_token: 'viewer-token' },
			primaryAppRole: 'viewer',
			apiPlan: 'viewer'
		});
		mockIsApiKeyPrincipal.mockReturnValue(false);
		mockIsSessionPrincipal.mockReturnValue(true);

		const response = await buildCanonicalCatalogResponse(
			makeEvent('https://app.test/v1/catalog?processing_base_method=Natural')
		);
		const body = await response.json();

		expect(response.status).toBe(403);
		expect(body).toMatchObject({
			error: 'Insufficient permissions',
			message: 'Structured process filters are available to members and paid API tiers.',
			code: 'entitlement_required',
			deniedParams: ['processing_base_method'],
			requiredCapability: 'canUseProcessFacets'
		});
		expect(mockSearchCatalog).not.toHaveBeenCalled();
	});

	it('does not deny anonymous requests for empty process transparency params', async () => {
		mockResolvePrincipal.mockResolvedValue({
			isAuthenticated: false,
			primaryAppRole: null,
			apiPlan: null
		});
		mockIsApiKeyPrincipal.mockReturnValue(false);
		mockIsSessionPrincipal.mockReturnValue(false);

		const response = await buildCanonicalCatalogResponse(
			makeEvent(
				'https://app.test/v1/catalog?processing_base_method=&fermentation_type=&process_additive=&processing_disclosure_level='
			)
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.meta.auth.kind).toBe('anonymous');
		expect(mockSearchCatalog).toHaveBeenCalled();
	});

	it('passes member processing transparency filters through to the catalog data layer', async () => {
		mockResolvePrincipal.mockResolvedValue({
			isAuthenticated: true,
			authKind: 'session',
			session: { access_token: 'member-token' },
			primaryAppRole: 'member',
			apiPlan: 'viewer'
		});
		mockIsApiKeyPrincipal.mockReturnValue(false);
		mockIsSessionPrincipal.mockReturnValue(true);

		const response = await buildCanonicalCatalogResponse(
			makeEvent(
				'https://app.test/v1/catalog?processing=Anaerobic&processing_base_method=Natural&fermentation_type=Anaerobic&process_additive=hops&has_additives=true&processing_disclosure_level=high_detail&processing_confidence_min=0.8'
			)
		);

		expect(response.status).toBe(200);
		expect(mockSearchCatalog).toHaveBeenCalledWith(
			{ kind: 'session-client' },
			expect.objectContaining({
				processing: 'Anaerobic',
				processingBaseMethod: 'Natural',
				fermentationType: 'Anaerobic',
				processAdditive: 'hops',
				hasAdditives: true,
				processingDisclosureLevel: 'high_detail',
				processingConfidenceMin: 0.8
			})
		);
	});

	it('rejects malformed has_additives values so unknown is not collapsed into false', async () => {
		mockResolvePrincipal.mockResolvedValue({
			isAuthenticated: false,
			primaryAppRole: null,
			apiPlan: null
		});
		mockIsApiKeyPrincipal.mockReturnValue(false);
		mockIsSessionPrincipal.mockReturnValue(false);

		const response = await buildCanonicalCatalogResponse(
			makeEvent('https://app.test/v1/catalog?has_additives=unknown')
		);
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.details).toEqual({
			parameter: 'has_additives',
			value: 'unknown',
			expected: 'true or false'
		});
		expect(mockSearchCatalog).not.toHaveBeenCalled();
	});

	it('rejects out-of-range processing confidence filters', async () => {
		mockResolvePrincipal.mockResolvedValue({
			isAuthenticated: false,
			primaryAppRole: null,
			apiPlan: null
		});
		mockIsApiKeyPrincipal.mockReturnValue(false);
		mockIsSessionPrincipal.mockReturnValue(false);

		const response = await buildCanonicalCatalogResponse(
			makeEvent('https://app.test/v1/catalog?processing_confidence_min=1.5')
		);
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.details).toEqual({
			parameter: 'processing_confidence_min',
			value: '1.5',
			expected: 'number between 0 and 1'
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

	it.each([
		['limit', 'abc', 'positive integer'],
		['page', 'zero', 'positive integer'],
		['price_per_lb_min', 'cheap', 'number'],
		['score_value_max', 'high', 'number']
	])(
		'rejects invalid %s value %s with a structured 400 response',
		async (parameter, value, expected) => {
			mockResolvePrincipal.mockResolvedValue({
				isAuthenticated: false,
				primaryAppRole: null,
				apiPlan: null
			});
			mockIsApiKeyPrincipal.mockReturnValue(false);
			mockIsSessionPrincipal.mockReturnValue(false);

			const response = await buildCanonicalCatalogResponse(
				makeEvent(`https://app.test/v1/catalog?${parameter}=${value}`)
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
		}
	);

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

	it('supports ids, dropdown fields, and deep paging for anonymous callers', async () => {
		mockResolvePrincipal.mockResolvedValue({
			isAuthenticated: false,
			primaryAppRole: null,
			apiPlan: null
		});
		mockIsApiKeyPrincipal.mockReturnValue(false);
		mockIsSessionPrincipal.mockReturnValue(false);
		mockGetCatalogDropdown.mockResolvedValue([{ id: 7, name: 'Dropdown Coffee' }]);

		const idsResponse = await buildCanonicalCatalogResponse(
			makeEvent('https://app.test/v1/catalog?ids=1&page=2&limit=10')
		);
		const dropdownResponse = await buildCanonicalCatalogResponse(
			makeEvent('https://app.test/v1/catalog?fields=dropdown')
		);

		expect(idsResponse.status).toBe(200);
		expect(mockSearchCatalog).toHaveBeenCalledWith(
			{ kind: 'session-client' },
			expect.objectContaining({
				publicOnly: true,
				coffeeIds: [1],
				limit: 10,
				offset: 10
			})
		);
		expect(dropdownResponse.status).toBe(200);
		expect(mockGetCatalogDropdown).toHaveBeenCalled();
	});

	it('routes paginated dropdown requests through the dropdown helper and preserves pagination metadata', async () => {
		mockResolvePrincipal.mockResolvedValue({
			isAuthenticated: false,
			primaryAppRole: null,
			apiPlan: null
		});
		mockIsApiKeyPrincipal.mockReturnValue(false);
		mockIsSessionPrincipal.mockReturnValue(false);
		mockSearchCatalogDropdown.mockResolvedValue({
			data: [{ id: 7, name: 'Dropdown Coffee', source: 'sweet_marias', stocked: true }],
			count: 42
		});

		const response = await buildCanonicalCatalogResponse(
			makeEvent('https://app.test/v1/catalog?fields=dropdown&page=2&limit=10')
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.data).toEqual([
			expect.objectContaining({ id: 7, name: 'Dropdown Coffee', source: 'sweet_marias' })
		]);
		expect(body.pagination).toEqual({
			page: 2,
			limit: 10,
			total: 42,
			totalPages: 5,
			hasNext: true,
			hasPrev: true
		});
		expect(mockSearchCatalogDropdown).toHaveBeenCalledWith(
			{ kind: 'session-client' },
			expect.objectContaining({
				stockedFilter: true,
				publicOnly: true,
				limit: 10,
				offset: 10
			})
		);
		expect(mockGetCatalogDropdown).not.toHaveBeenCalled();
		expect(mockSearchCatalog).not.toHaveBeenCalled();
	});

	it('keeps paginated dropdown responses on the reduced projection for anonymous callers', async () => {
		mockResolvePrincipal.mockResolvedValue({
			isAuthenticated: false,
			primaryAppRole: null,
			apiPlan: null
		});
		mockIsApiKeyPrincipal.mockReturnValue(false);
		mockIsSessionPrincipal.mockReturnValue(false);
		mockSearchCatalogDropdown.mockResolvedValue({
			data: [
				{
					id: 7,
					source: 'sweet_marias',
					name: 'Dropdown Coffee',
					stocked: true,
					cost_lb: 7.5,
					price_per_lb: 7.5,
					price_tiers: null,
					public_coffee: true
				}
			],
			count: 40
		});

		const response = await buildCanonicalCatalogResponse(
			makeEvent('https://app.test/v1/catalog?fields=dropdown&limit=2')
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.pagination).toMatchObject({ page: 1, limit: 2, total: 40, totalPages: 20 });
		expect(body.data[0]).toEqual({
			id: 7,
			source: 'sweet_marias',
			name: 'Dropdown Coffee',
			stocked: true,
			cost_lb: 7.5,
			price_per_lb: 7.5,
			price_tiers: null,
			public_coffee: true
		});
		expect(mockSearchCatalogDropdown).toHaveBeenCalledWith(
			{ kind: 'session-client' },
			expect.objectContaining({
				stockedFilter: true,
				publicOnly: true,
				limit: 2,
				offset: 0
			})
		);
		expect(mockGetCatalogDropdown).not.toHaveBeenCalled();
		expect(mockSearchCatalog).not.toHaveBeenCalled();
	});

	it('keeps fields=dropdown working after strict enum validation', async () => {
		mockResolvePrincipal.mockResolvedValue({
			isAuthenticated: false,
			primaryAppRole: null,
			apiPlan: null
		});
		mockIsApiKeyPrincipal.mockReturnValue(false);
		mockIsSessionPrincipal.mockReturnValue(false);
		mockGetCatalogDropdown.mockResolvedValue([{ id: 7, name: 'Dropdown Coffee' }]);

		const response = await buildCanonicalCatalogResponse(
			makeEvent('https://app.test/v1/catalog?fields=dropdown')
		);

		expect(response.status).toBe(200);
		expect(mockGetCatalogDropdown).toHaveBeenCalledWith(
			{ kind: 'session-client' },
			expect.objectContaining({ stockedFilter: true, publicOnly: true })
		);
	});

	it('keeps api-key paginated dropdown responses reduced and preserves row caps', async () => {
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
		mockSearchCatalogDropdown.mockResolvedValue({
			data: [
				{
					id: 7,
					source: 'sweet_marias',
					name: 'Dropdown Coffee',
					stocked: true,
					cost_lb: 7.5,
					price_per_lb: 7.5,
					price_tiers: null,
					public_coffee: true
				}
			],
			count: 40
		});

		const response = await buildCanonicalCatalogResponse(
			makeEvent('https://app.test/v1/catalog?fields=dropdown&page=1&limit=50', {
				Authorization: 'Bearer pk_live_valid'
			})
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.meta.auth.kind).toBe('api-key');
		expect(body.pagination).toMatchObject({ page: 1, limit: 25, total: 40, totalPages: 2 });
		expect(mockSearchCatalogDropdown).toHaveBeenCalledWith(
			{ kind: 'admin-client' },
			expect.objectContaining({
				stockedFilter: true,
				publicOnly: true,
				limit: 25,
				offset: 0
			})
		);
		expect(response.headers.get('X-RateLimit-Limit')).toBe('200');
		expect(response.headers.get('X-RateLimit-Remaining')).toBe('199');
	});

	it('rejects API Green processing transparency filters before the catalog data layer', async () => {
		const apiKeyPrincipal = {
			isAuthenticated: true,
			authKind: 'api-key',
			primaryAppRole: 'viewer',
			apiPlan: 'viewer',
			apiKeyId: 'key-1'
		};

		mockResolvePrincipal.mockResolvedValue(apiKeyPrincipal);
		mockIsApiKeyPrincipal.mockReturnValue(true);
		mockIsSessionPrincipal.mockReturnValue(false);
		mockRequireApiKeyAccess.mockResolvedValue(apiKeyPrincipal);

		const response = await buildCanonicalCatalogResponse(
			makeEvent('https://app.test/v1/catalog?processing_base_method=Natural', {
				Authorization: 'Bearer pk_live_valid'
			})
		);
		const body = await response.json();

		expect(response.status).toBe(403);
		expect(body).toMatchObject({
			error: 'Insufficient permissions',
			message: 'Structured process filters are available to members and paid API tiers.',
			code: 'entitlement_required',
			deniedParams: ['processing_base_method'],
			requiredCapability: 'canUseProcessFacets'
		});
		expect(mockSearchCatalog).not.toHaveBeenCalled();
	});

	it('lets paid API tiers use processing transparency filters', async () => {
		const apiKeyPrincipal = {
			isAuthenticated: true,
			authKind: 'api-key',
			primaryAppRole: 'viewer',
			apiPlan: 'member',
			apiKeyId: 'key-1'
		};

		mockResolvePrincipal.mockResolvedValue(apiKeyPrincipal);
		mockIsApiKeyPrincipal.mockReturnValue(true);
		mockIsSessionPrincipal.mockReturnValue(false);
		mockRequireApiKeyAccess.mockResolvedValue(apiKeyPrincipal);
		mockGetApiRowLimit.mockReturnValue(-1);

		const response = await buildCanonicalCatalogResponse(
			makeEvent('https://app.test/v1/catalog?processing_base_method=Natural', {
				Authorization: 'Bearer pk_live_valid'
			})
		);

		expect(response.status).toBe(200);
		expect(mockSearchCatalog).toHaveBeenCalledWith(
			{ kind: 'admin-client' },
			expect.objectContaining({
				publicOnly: true,
				processingBaseMethod: 'Natural'
			})
		);
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
				orderBy: 'stocked_date',
				orderDirection: 'desc',
				publicOnly: true,
				stockedFilter: true
			})
		);
	});

	it('allows non-default public sort requests for anonymous callers', async () => {
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

		expect(response.status).toBe(200);
		expect(body.meta.auth.kind).toBe('anonymous');
		expect(mockSearchCatalog).toHaveBeenCalledWith(
			{ kind: 'session-client' },
			expect.objectContaining({
				publicOnly: true,
				orderBy: 'arrival_date',
				orderDirection: 'asc'
			})
		);
	});

	it('rejects malformed anonymous sortDirection values explicitly', async () => {
		mockResolvePrincipal.mockResolvedValue({
			isAuthenticated: false,
			primaryAppRole: null,
			apiPlan: null
		});
		mockIsApiKeyPrincipal.mockReturnValue(false);
		mockIsSessionPrincipal.mockReturnValue(false);

		const response = await buildCanonicalCatalogResponse(
			makeEvent('https://app.test/v1/catalog?sortDirection=descending')
		);
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body).toEqual({
			error: 'Invalid query parameter',
			message: 'Query parameter "sortDirection" must use asc or desc format',
			details: {
				parameter: 'sortDirection',
				value: 'descending',
				expected: 'asc or desc'
			}
		});
		expect(mockSearchCatalog).not.toHaveBeenCalled();
	});

	it.each([
		['fields', 'bogus', 'full or dropdown'],
		['stocked', 'maybe', 'true, false, or all'],
		['showWholesale', 'maybe', 'true or false'],
		['wholesaleOnly', 'maybe', 'true or false'],
		['sortField', 'bogus', SORT_FIELD_EXPECTED]
	])(
		'rejects malformed typed query parameter %s=%s with a structured 400 response',
		async (parameter, value, expected) => {
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
			expect(mockSearchCatalogDropdown).not.toHaveBeenCalled();
			expect(mockGetCatalogDropdown).not.toHaveBeenCalled();
		}
	);

	it('returns schema-unavailable instead of broadened data for authorized structured process schema lag', async () => {
		mockResolvePrincipal.mockResolvedValue({
			isAuthenticated: true,
			authKind: 'session',
			primaryAppRole: 'member',
			apiPlan: 'viewer',
			session: { access_token: 'member-token' }
		});
		mockIsApiKeyPrincipal.mockReturnValue(false);
		mockIsSessionPrincipal.mockReturnValue(true);
		const schemaError = new Error(
			'Structured process filters are unavailable because processing transparency columns are missing from the database schema.'
		);
		schemaError.name = 'CatalogSchemaUnavailableError';
		mockSearchCatalog.mockRejectedValueOnce(schemaError);

		const response = await buildCanonicalCatalogResponse(
			makeEvent('https://app.test/v1/catalog?processing_base_method=Natural')
		);
		const body = await response.json();

		expect(response.status).toBe(503);
		expect(body).toEqual({
			error: 'Catalog schema unavailable',
			message: schemaError.message
		});
	});

	it('viewer sessions keep the same broad public catalog parameter surface', async () => {
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
				isAuthenticated: true,
				primaryAppRole: 'viewer',
				apiPlan: null,
				session: { access_token: 'cookie-token' }
			});
			mockIsApiKeyPrincipal.mockReturnValue(false);
			mockIsSessionPrincipal.mockReturnValue(true);
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

		it('rejects invalid stocked values instead of silently defaulting to stocked-only', async () => {
			const response = await buildCanonicalCatalogResponse(
				makeEvent('https://app.test/v1/catalog?stocked=maybe&page=1&limit=10')
			);
			const body = await response.json();

			expect(response.status).toBe(400);
			expect(body.details).toEqual({
				parameter: 'stocked',
				value: 'maybe',
				expected: 'true, false, or all'
			});
			expect(mockSearchCatalog).not.toHaveBeenCalled();
		});
	});

	describe('origin query parameter', () => {
		beforeEach(() => {
			mockResolvePrincipal.mockResolvedValue({
				isAuthenticated: true,
				primaryAppRole: 'viewer',
				apiPlan: null,
				session: { access_token: 'cookie-token' }
			});
			mockIsApiKeyPrincipal.mockReturnValue(false);
			mockIsSessionPrincipal.mockReturnValue(true);
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

		it('passes repeated country params through as a multi-select filter', async () => {
			await buildCanonicalCatalogResponse(
				makeEvent('https://app.test/v1/catalog?country=Ethiopia&country=Kenya&page=1&limit=10')
			);
			expect(mockSearchCatalog).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({ country: ['Ethiopia', 'Kenya'] })
			);
		});
	});

	describe('dropdown path stocked filtering', () => {
		beforeEach(() => {
			mockResolvePrincipal.mockResolvedValue({
				isAuthenticated: true,
				primaryAppRole: 'viewer',
				apiPlan: null,
				session: { access_token: 'cookie-token' }
			});
			mockIsApiKeyPrincipal.mockReturnValue(false);
			mockIsSessionPrincipal.mockReturnValue(true);
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

		it('preserves processing transparency filters for member unpaginated dropdown requests', async () => {
			mockResolvePrincipal.mockResolvedValue({
				isAuthenticated: true,
				primaryAppRole: 'member',
				apiPlan: 'viewer',
				session: { access_token: 'member-token' }
			});

			await buildCanonicalCatalogResponse(
				makeEvent(
					'https://app.test/v1/catalog?fields=dropdown&processing_base_method=Natural&fermentation_type=Anaerobic&process_additive=hops&has_additives=true&processing_disclosure_level=high_detail&processing_confidence_min=0.8'
				)
			);

			expect(mockGetCatalogDropdown).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({
					stockedFilter: true,
					publicOnly: false,
					processingBaseMethod: 'Natural',
					fermentationType: 'Anaerobic',
					processAdditive: 'hops',
					hasAdditives: true,
					processingDisclosureLevel: 'high_detail',
					processingConfidenceMin: 0.8
				})
			);
			expect(mockSearchCatalogDropdown).not.toHaveBeenCalled();
		});

		it('preserves canonical filters and sorting for paginated dropdown requests', async () => {
			await buildCanonicalCatalogResponse(
				makeEvent(
					'https://app.test/v1/catalog?fields=dropdown&page=2&limit=10&origin=Africa&country=Ethiopia&source=sweet_maria&name=Sidamo&processing=Washed&sortField=name&sortDirection=asc'
				)
			);

			expect(mockSearchCatalogDropdown).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({
					stockedFilter: true,
					publicOnly: true,
					origin: 'Africa',
					country: 'Ethiopia',
					source: ['sweet_maria'],
					name: 'Sidamo',
					processing: 'Washed',
					orderBy: 'name',
					orderDirection: 'asc',
					limit: 10,
					offset: 10
				})
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
			isAuthenticated: true,
			primaryAppRole: 'viewer',
			apiPlan: null,
			session: { access_token: 'cookie-token' }
		});
		mockIsApiKeyPrincipal.mockReturnValue(false);
		mockIsSessionPrincipal.mockReturnValue(true);

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

	it.each([
		['sortField', 'bogus', SORT_FIELD_EXPECTED],
		['fields', 'bogus', 'full or dropdown']
	])(
		'preserves upstream %s validation failures for legacy callers',
		async (parameter, value, expected) => {
			mockResolvePrincipal.mockResolvedValue({
				isAuthenticated: true,
				primaryAppRole: 'member',
				apiPlan: 'viewer',
				session: { access_token: 'cookie-token' }
			});
			mockIsApiKeyPrincipal.mockReturnValue(false);
			mockIsSessionPrincipal.mockReturnValue(true);

			const response = await buildLegacyAppCatalogResponse(
				makeEvent(`https://app.test/api/catalog?${parameter}=${encodeURIComponent(value)}`)
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
		}
	);

	it('preserves oversized limit validation for the deprecated /api/catalog-api alias', async () => {
		mockResolvePrincipal.mockResolvedValue({
			isAuthenticated: true,
			primaryAppRole: 'member',
			apiPlan: 'viewer',
			session: { access_token: 'cookie-token' }
		});
		mockIsApiKeyPrincipal.mockReturnValue(false);
		mockIsSessionPrincipal.mockReturnValue(true);

		const response = await buildLegacyAppCatalogResponse(
			makeEvent(`https://app.test/api/catalog-api?limit=${MAX_CATALOG_PAGE_LIMIT + 100}`)
		);
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body).toEqual({
			error: 'Invalid query parameter',
			message: `Query parameter "limit" must use positive integer less than or equal to ${MAX_CATALOG_PAGE_LIMIT} format`,
			details: {
				parameter: 'limit',
				value: String(MAX_CATALOG_PAGE_LIMIT + 100),
				expected: `positive integer less than or equal to ${MAX_CATALOG_PAGE_LIMIT}`
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
