import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatAllowedValues, PUBLIC_CATALOG_SORT_FIELDS } from '$lib/catalog/publicQueryContract';

const { mockBuildCanonicalCatalogResponse, mockRequireApiKeyAccess } = vi.hoisted(() => ({
	mockBuildCanonicalCatalogResponse: vi.fn(),
	mockRequireApiKeyAccess: vi.fn()
}));

vi.mock('$lib/server/catalogResource', () => ({
	buildCanonicalCatalogResponse: mockBuildCanonicalCatalogResponse
}));

vi.mock('$lib/server/auth', () => {
	class MockAuthError extends Error {
		status: number;

		constructor(message: string, status = 401) {
			super(message);
			this.name = 'AuthError';
			this.status = status;
		}
	}

	return {
		AuthError: MockAuthError,
		requireApiKeyAccess: mockRequireApiKeyAccess
	};
});

import { AuthError, requireApiKeyAccess } from '$lib/server/auth';
import { buildCanonicalCatalogResponse } from '$lib/server/catalogResource';

let GET: typeof import('./+server').GET;
const LEGACY_SUCCESSOR_LINK = '</v1/catalog>; rel="successor-version"';
const LEGACY_SUNSET = 'Thu, 31 Dec 2026 23:59:59 GMT';
const SORT_FIELD_EXPECTED = formatAllowedValues(PUBLIC_CATALOG_SORT_FIELDS);

function expectLegacyHeaders(response: Response) {
	expect(response.headers.get('Deprecation')).toBe('true');
	expect(response.headers.get('Link')).toBe(LEGACY_SUCCESSOR_LINK);
	expect(response.headers.get('Sunset')).toBe(LEGACY_SUNSET);
}

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();
	({ GET } = await import('./+server'));
	mockRequireApiKeyAccess.mockResolvedValue({ apiKeyId: 'key-1' });
});

describe('/api/catalog-api legacy delegate', () => {
	it('requires an API key before delegating to the canonical catalog handler', async () => {
		const mockBody = JSON.stringify({ data: [], pagination: {} });
		const mockResponse = new Response(mockBody, {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
		mockRequireApiKeyAccess.mockResolvedValue({ apiKeyId: 'key-1' });
		vi.mocked(buildCanonicalCatalogResponse).mockResolvedValue(mockResponse);

		const response = await GET({
			url: new URL('https://app.test/api/catalog-api'),
			request: new Request('https://app.test/api/catalog-api'),
			locals: {}
		} as unknown as Parameters<NonNullable<typeof GET>>[0]);

		expect(requireApiKeyAccess).toHaveBeenCalledWith(
			expect.objectContaining({ url: expect.any(URL) }),
			{
				requiredPlan: 'viewer',
				requiredScope: 'catalog:read'
			}
		);
		expect(buildCanonicalCatalogResponse).toHaveBeenCalledWith(
			expect.objectContaining({ url: expect.any(URL) }),
			{ requestPath: '/api/catalog-api' }
		);
		expect(mockRequireApiKeyAccess).toHaveBeenCalledWith(expect.anything(), {
			requiredPlan: 'viewer',
			requiredScope: 'catalog:read'
		});
		expect(response.status).toBe(200);
	});

	it('adds deprecation headers to successful responses', async () => {
		const mockResponse = new Response(JSON.stringify({ data: [] }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
		mockRequireApiKeyAccess.mockResolvedValue({ apiKeyId: 'key-1' });
		vi.mocked(buildCanonicalCatalogResponse).mockResolvedValue(mockResponse);

		const response = await GET({
			url: new URL('https://app.test/api/catalog-api'),
			request: new Request('https://app.test/api/catalog-api'),
			locals: {}
		} as unknown as Parameters<NonNullable<typeof GET>>[0]);

		expectLegacyHeaders(response);
	});

	it('returns a legacy 401 response with deprecation headers when no API key is present', async () => {
		mockRequireApiKeyAccess.mockRejectedValue(new AuthError('API key authentication required'));

		const response = await GET({
			url: new URL('https://app.test/api/catalog-api'),
			request: new Request('https://app.test/api/catalog-api'),
			locals: {}
		} as unknown as Parameters<NonNullable<typeof GET>>[0]);

		expect(buildCanonicalCatalogResponse).not.toHaveBeenCalled();
		expect(response.status).toBe(401);
		expectLegacyHeaders(response);
		expect(await response.json()).toEqual({
			error: 'Authentication required',
			message: 'API key authentication required'
		});
	});

	it('returns 401 for session-only callers without delegating and preserves legacy headers', async () => {
		mockRequireApiKeyAccess.mockRejectedValue(new AuthError('API key authentication required'));

		const response = await GET({
			url: new URL('https://app.test/api/catalog-api'),
			request: new Request('https://app.test/api/catalog-api', {
				headers: { Cookie: 'sb-access-token=session-cookie' }
			}),
			locals: {
				principal: {
					isAuthenticated: true,
					primaryAppRole: 'member',
					apiPlan: null,
					session: { access_token: 'session-cookie' }
				}
			}
		} as unknown as Parameters<NonNullable<typeof GET>>[0]);

		expect(buildCanonicalCatalogResponse).not.toHaveBeenCalled();
		expect(response.status).toBe(401);
		expectLegacyHeaders(response);
		expect(await response.json()).toEqual({
			error: 'Authentication required',
			message: 'API key authentication required'
		});
	});

	it('returns a legacy 403 response with deprecation headers when the API key lacks catalog access', async () => {
		mockRequireApiKeyAccess.mockRejectedValue(new AuthError('Insufficient API scope', 403));

		const response = await GET({
			url: new URL('https://app.test/api/catalog-api'),
			request: new Request('https://app.test/api/catalog-api'),
			locals: {}
		} as unknown as Parameters<NonNullable<typeof GET>>[0]);

		expect(buildCanonicalCatalogResponse).not.toHaveBeenCalled();
		expect(response.status).toBe(403);
		expectLegacyHeaders(response);
		expect(await response.json()).toEqual({
			error: 'Insufficient permissions',
			message: 'Insufficient API scope'
		});
	});

	it('preserves upstream 400 responses while still adding deprecation headers', async () => {
		const mockResponse = new Response(
			JSON.stringify({
				error: 'Invalid query parameter',
				message: 'Query parameter "stocked_date" must use YYYY-MM-DD format'
			}),
			{
				status: 400,
				headers: {
					'Content-Type': 'application/json; charset=utf-8'
				}
			}
		);
		vi.mocked(buildCanonicalCatalogResponse).mockResolvedValue(mockResponse);

		const response = await GET({
			url: new URL('https://app.test/api/catalog-api?stocked_date=30'),
			request: new Request('https://app.test/api/catalog-api?stocked_date=30'),
			locals: {}
		} as unknown as Parameters<NonNullable<typeof GET>>[0]);

		expect(response.status).toBe(400);
		expectLegacyHeaders(response);
		expect(await response.json()).toEqual({
			error: 'Invalid query parameter',
			message: 'Query parameter "stocked_date" must use YYYY-MM-DD format'
		});
	});

	it.each([
		['stocked_days', 'abc', 'positive integer'],
		['limit', 'abc', 'positive integer'],
		['price_per_lb_min', 'cheap', 'number'],
		['cost_lb_min', 'cheap', 'number'],
		['fields', 'bogus', 'full or dropdown'],
		['sortField', 'bogus', SORT_FIELD_EXPECTED]
	])(
		'preserves upstream %s 400 responses while still adding deprecation headers',
		async (parameter, value, expected) => {
			const mockResponse = new Response(
				JSON.stringify({
					error: 'Invalid query parameter',
					message: `Query parameter "${parameter}" must use ${expected} format`,
					details: {
						parameter,
						value,
						expected
					}
				}),
				{
					status: 400,
					headers: {
						'Content-Type': 'application/json; charset=utf-8'
					}
				}
			);
			vi.mocked(buildCanonicalCatalogResponse).mockResolvedValue(mockResponse);

			const response = await GET({
				url: new URL(`https://app.test/api/catalog-api?${parameter}=${value}`),
				request: new Request(`https://app.test/api/catalog-api?${parameter}=${value}`),
				locals: {}
			} as unknown as Parameters<NonNullable<typeof GET>>[0]);

			expect(response.status).toBe(400);
			expectLegacyHeaders(response);
			expect(await response.json()).toEqual({
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

	it('preserves upstream 429 responses while still adding deprecation headers', async () => {
		const mockResponse = new Response(
			JSON.stringify({ error: 'Rate limit exceeded', message: 'Too many requests' }),
			{
				status: 429,
				headers: {
					'Content-Type': 'application/json; charset=utf-8',
					'X-RateLimit-Limit': '200'
				}
			}
		);
		mockRequireApiKeyAccess.mockResolvedValue({ apiKeyId: 'key-1' });
		vi.mocked(buildCanonicalCatalogResponse).mockResolvedValue(mockResponse);

		const response = await GET({
			url: new URL('https://app.test/api/catalog-api'),
			request: new Request('https://app.test/api/catalog-api'),
			locals: {}
		} as unknown as Parameters<NonNullable<typeof GET>>[0]);

		expect(response.status).toBe(429);
		expectLegacyHeaders(response);
		expect(response.headers.get('X-RateLimit-Limit')).toBe('200');
		expect(await response.json()).toEqual({
			error: 'Rate limit exceeded',
			message: 'Too many requests'
		});
	});

	it('passes query parameters through to the underlying handler', async () => {
		const mockResponse = new Response(JSON.stringify({ data: [] }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
		mockRequireApiKeyAccess.mockResolvedValue({ apiKeyId: 'key-1' });
		vi.mocked(buildCanonicalCatalogResponse).mockResolvedValue(mockResponse);

		await GET({
			url: new URL('https://app.test/api/catalog-api?page=2&limit=10&source=sweet_marias'),
			request: new Request('https://app.test/api/catalog-api?page=2&limit=10&source=sweet_marias'),
			locals: {}
		} as unknown as Parameters<NonNullable<typeof GET>>[0]);

		expect(buildCanonicalCatalogResponse).toHaveBeenCalled();
	});

	it('rejects anonymous callers because the legacy alias is intentionally API-key-only', async () => {
		mockRequireApiKeyAccess.mockRejectedValue(new AuthError('API key authentication required'));

		const response = await GET({
			url: new URL('https://app.test/api/catalog-api'),
			request: new Request('https://app.test/api/catalog-api'),
			locals: {}
		} as unknown as Parameters<NonNullable<typeof GET>>[0]);

		expect(response.status).toBe(401);
		expect(buildCanonicalCatalogResponse).not.toHaveBeenCalled();
		expect(response.headers.get('Deprecation')).toBe('true');
		expect(response.headers.get('Link')).toContain('/v1/catalog');
		expect(await response.json()).toEqual({
			error: 'Authentication required',
			message: 'API key authentication required'
		});
	});

	it('preserves 403 authorization failures without delegating to the canonical multi-context route', async () => {
		mockRequireApiKeyAccess.mockRejectedValue(new AuthError('Insufficient API scope', 403));

		const response = await GET({
			url: new URL('https://app.test/api/catalog-api'),
			request: new Request('https://app.test/api/catalog-api', {
				headers: { Authorization: 'Bearer pk_live_limited' }
			}),
			locals: {}
		} as unknown as Parameters<NonNullable<typeof GET>>[0]);

		expect(response.status).toBe(403);
		expect(buildCanonicalCatalogResponse).not.toHaveBeenCalled();
		expect(await response.json()).toEqual({
			error: 'Insufficient permissions',
			message: 'Insufficient API scope'
		});
	});
});
