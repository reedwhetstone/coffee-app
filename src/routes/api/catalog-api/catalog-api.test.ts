import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRequireApiKeyAccess, mockCreateParchmentServerClient, mockCatalogList } = vi.hoisted(
	() => ({
		mockRequireApiKeyAccess: vi.fn(),
		mockCreateParchmentServerClient: vi.fn(),
		mockCatalogList: vi.fn()
	})
);

vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: mockCreateParchmentServerClient
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

import { AuthError } from '$lib/server/auth';
import { createParchmentServerClient } from '$lib/server/parchmentClient';

let GET: typeof import('./+server').GET;
const LEGACY_SUCCESSOR_LINK = '</v1/catalog>; rel="successor-version"';
const LEGACY_SUNSET = 'Thu, 31 Dec 2026 23:59:59 GMT';

function expectLegacyHeaders(response: Response) {
	expect(response.headers.get('Deprecation')).toBe('true');
	expect(response.headers.get('Link')).toBe(LEGACY_SUCCESSOR_LINK);
	expect(response.headers.get('Sunset')).toBe(LEGACY_SUNSET);
}

function makeEvent(url: string, init?: RequestInit, locals: Record<string, unknown> = {}) {
	return {
		url: new URL(url),
		request: new Request(url, init),
		fetch: vi.fn(),
		locals
	} as unknown as Parameters<NonNullable<typeof GET>>[0];
}

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();
	mockRequireApiKeyAccess.mockResolvedValue({ apiKeyId: 'key-1' });
	mockCatalogList.mockResolvedValue({
		data: { data: [], pagination: { total: 0 }, meta: {} },
		response: new Response(null, { status: 200 })
	});
	mockCreateParchmentServerClient.mockResolvedValue({
		catalog: { list: mockCatalogList }
	});
	({ GET } = await import('./+server'));
});

describe('/api/catalog-api legacy delegate', () => {
	it('requires an API key before proxying to Parchment', async () => {
		const response = await GET(makeEvent('https://app.test/api/catalog-api'));

		expect(mockRequireApiKeyAccess).toHaveBeenCalledWith(expect.anything(), {
			requiredPlan: 'viewer',
			requiredScope: 'catalog:read'
		});
		expect(mockCreateParchmentServerClient).toHaveBeenCalledWith(expect.anything(), {
			mode: 'session'
		});
		expect(mockCatalogList).toHaveBeenCalledTimes(1);
		expect(response.status).toBe(200);
	});

	it('adds deprecation headers to successful responses', async () => {
		const response = await GET(makeEvent('https://app.test/api/catalog-api'));

		expectLegacyHeaders(response);
	});

	it('forwards the caller query params to Parchment', async () => {
		await GET(makeEvent('https://app.test/api/catalog-api?page=2&limit=10&source=sweet_marias'));

		expect(mockCatalogList).toHaveBeenCalledWith(
			expect.objectContaining({ page: '2', limit: '10', source: 'sweet_marias' })
		);
	});

	it('returns a legacy 401 response with deprecation headers when no API key is present', async () => {
		mockRequireApiKeyAccess.mockRejectedValue(new AuthError('API key authentication required'));

		const response = await GET(makeEvent('https://app.test/api/catalog-api'));

		expect(createParchmentServerClient).not.toHaveBeenCalled();
		expect(response.status).toBe(401);
		expectLegacyHeaders(response);
		expect(await response.json()).toEqual({
			error: 'Authentication required',
			message: 'API key authentication required'
		});
	});

	it('returns 401 for session-only callers without proxying and preserves legacy headers', async () => {
		mockRequireApiKeyAccess.mockRejectedValue(new AuthError('API key authentication required'));

		const response = await GET(
			makeEvent(
				'https://app.test/api/catalog-api',
				{ headers: { Cookie: 'sb-access-token=session-cookie' } },
				{
					principal: {
						isAuthenticated: true,
						primaryAppRole: 'member',
						apiPlan: null,
						session: { access_token: 'session-cookie' }
					}
				}
			)
		);

		expect(createParchmentServerClient).not.toHaveBeenCalled();
		expect(response.status).toBe(401);
		expectLegacyHeaders(response);
		expect(await response.json()).toEqual({
			error: 'Authentication required',
			message: 'API key authentication required'
		});
	});

	it('returns a legacy 403 response with deprecation headers when the API key lacks catalog access', async () => {
		mockRequireApiKeyAccess.mockRejectedValue(new AuthError('Insufficient API scope', 403));

		const response = await GET(makeEvent('https://app.test/api/catalog-api'));

		expect(createParchmentServerClient).not.toHaveBeenCalled();
		expect(response.status).toBe(403);
		expectLegacyHeaders(response);
		expect(await response.json()).toEqual({
			error: 'Insufficient permissions',
			message: 'Insufficient API scope'
		});
	});

	it('relays upstream error status and body while still adding deprecation headers', async () => {
		mockCatalogList.mockResolvedValue({
			error: {
				error: 'Invalid query parameter',
				message: 'Query parameter "stocked_date" must use YYYY-MM-DD format'
			},
			response: new Response(null, { status: 400 })
		});

		const response = await GET(makeEvent('https://app.test/api/catalog-api?stocked_date=30'));

		expect(response.status).toBe(400);
		expectLegacyHeaders(response);
		expect(await response.json()).toEqual({
			error: 'Invalid query parameter',
			message: 'Query parameter "stocked_date" must use YYYY-MM-DD format'
		});
	});

	it('relays upstream 429 responses and rate-limit headers while adding deprecation headers', async () => {
		mockCatalogList.mockResolvedValue({
			error: { error: 'Rate limit exceeded', message: 'Too many requests' },
			response: new Response(null, {
				status: 429,
				headers: { 'X-RateLimit-Limit': '200' }
			})
		});

		const response = await GET(makeEvent('https://app.test/api/catalog-api'));

		expect(response.status).toBe(429);
		expectLegacyHeaders(response);
		expect(response.headers.get('X-RateLimit-Limit')).toBe('200');
		expect(await response.json()).toEqual({
			error: 'Rate limit exceeded',
			message: 'Too many requests'
		});
	});

	it('returns a JSON 503 with legacy headers when Parchment is unconfigured', async () => {
		const configError = new Error('PARCHMENT_API_BASE_URL is not configured');
		configError.name = 'ParchmentConfigError';
		mockCreateParchmentServerClient.mockRejectedValue(configError);

		const response = await GET(makeEvent('https://app.test/api/catalog-api'));

		expect(response.status).toBe(503);
		expectLegacyHeaders(response);
		expect(await response.json()).toEqual({
			error: 'Catalog schema unavailable',
			message: 'PARCHMENT_API_BASE_URL is not configured'
		});
	});

	it('returns a JSON 500 with legacy headers when the upstream fetch rejects', async () => {
		mockCatalogList.mockRejectedValue(new Error('network down'));

		const response = await GET(makeEvent('https://app.test/api/catalog-api'));

		expect(response.status).toBe(500);
		expectLegacyHeaders(response);
		expect(await response.json()).toEqual({
			error: 'Failed to fetch catalog data',
			message: 'Internal server error'
		});
	});

	it('rejects anonymous callers because the legacy alias is intentionally API-key-only', async () => {
		mockRequireApiKeyAccess.mockRejectedValue(new AuthError('API key authentication required'));

		const response = await GET(makeEvent('https://app.test/api/catalog-api'));

		expect(response.status).toBe(401);
		expect(createParchmentServerClient).not.toHaveBeenCalled();
		expect(response.headers.get('Deprecation')).toBe('true');
		expect(response.headers.get('Link')).toContain('/v1/catalog');
		expect(await response.json()).toEqual({
			error: 'Authentication required',
			message: 'API key authentication required'
		});
	});
});
