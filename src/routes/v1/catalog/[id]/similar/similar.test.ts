import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreateParchmentServerClient, mockCatalogSimilar, mockCreateAdminClient } = vi.hoisted(
	() => ({
		mockCreateParchmentServerClient: vi.fn(),
		mockCatalogSimilar: vi.fn(),
		mockCreateAdminClient: vi.fn()
	})
);

vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: mockCreateParchmentServerClient
}));

vi.mock('$lib/supabase-admin', () => ({
	createAdminClient: mockCreateAdminClient
}));

let GET: typeof import('./+server').GET;

const successBody = {
	data: {
		target: { id: 1182, name: 'Ethiopia Guji Natural' },
		groups: { canonical_candidates: [], similar_recommendations: [] },
		matches: []
	},
	meta: {
		resource: 'catalog-similarity',
		namespace: '/v1/catalog/{id}/similar',
		version: 'v1',
		status: 'beta'
	}
};

function makeEvent(url: string, init: { id?: string; headers?: HeadersInit } = {}) {
	return {
		url: new URL(url),
		params: { id: init.id ?? '1182' },
		request: new Request(url, { headers: init.headers }),
		fetch: vi.fn(),
		locals: {}
	} as unknown as Parameters<NonNullable<typeof GET>>[0];
}

function expectLegacyHeaders(response: Response) {
	expect(response.headers.get('Deprecation')).toBe('true');
	expect(response.headers.get('Link')).toBe(
		'<https://api.purveyors.io/v1/catalog/{id}/similar>; rel="successor-version"'
	);
	expect(response.headers.get('Sunset')).toBe('Thu, 31 Dec 2026 23:59:59 GMT');
}

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();

	mockCatalogSimilar.mockResolvedValue({
		data: successBody,
		response: new Response(null, { status: 200 })
	});
	mockCreateParchmentServerClient.mockResolvedValue({
		catalog: { similar: mockCatalogSimilar }
	});

	({ GET } = await import('./+server'));
});

describe('/v1/catalog/[id]/similar route', () => {
	it('proxies valid requests to Parchment with the caller credential mode and valid query params', async () => {
		const response = await GET(
			makeEvent(
				'https://app.test/v1/catalog/1182/similar?limit=5&stocked_only=false&mode=likely_same&threshold=0.8&ignored=value'
			)
		);

		expect(mockCreateParchmentServerClient).toHaveBeenCalledWith(expect.anything(), {
			mode: 'session',
			preferHandling: 'inherit'
		});
		expect(mockCatalogSimilar).toHaveBeenCalledWith('1182', {
			threshold: '0.8',
			limit: 5,
			stocked_only: 'false',
			mode: 'likely_same'
		});
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual(successBody);
		expectLegacyHeaders(response);
		expect(mockCreateAdminClient).not.toHaveBeenCalled();
	});

	it('normalizes valid numeric ids before forwarding', async () => {
		await GET(makeEvent('https://app.test/v1/catalog/0001182/similar', { id: '0001182' }));

		expect(mockCatalogSimilar).toHaveBeenCalledWith('1182', {});
	});

	it.each(['abc', '0', '2147483648', '999999999999', '9007199254740992'])(
		'returns 400 before proxying for invalid catalog id %s',
		async (id) => {
			const response = await GET(makeEvent(`https://app.test/v1/catalog/${id}/similar`, { id }));
			const body = await response.json();

			expect(response.status).toBe(400);
			expect(body).toMatchObject({
				error: 'Invalid query parameter',
				details: { parameter: 'id', value: id }
			});
			expect(mockCreateParchmentServerClient).not.toHaveBeenCalled();
			expect(mockCatalogSimilar).not.toHaveBeenCalled();
			expectLegacyHeaders(response);
		}
	);

	it('relays upstream 401 bodies instead of handling anonymous auth locally', async () => {
		const upstreamBody = {
			error: 'Authentication required',
			message: 'Similar coffee matching requires authentication.'
		};
		mockCatalogSimilar.mockResolvedValue({
			error: upstreamBody,
			response: new Response(null, { status: 401 })
		});

		const response = await GET(makeEvent('https://app.test/v1/catalog/1182/similar'));

		expect(mockCatalogSimilar).toHaveBeenCalledWith('1182', {});
		expect(response.status).toBe(401);
		expect(await response.json()).toEqual(upstreamBody);
		expectLegacyHeaders(response);
	});

	it('relays upstream 403 bodies for entitlement failures', async () => {
		const upstreamBody = {
			error: 'Insufficient permissions',
			message: 'Similar coffee matching is available to members and paid API tiers.',
			code: 'entitlement_required'
		};
		mockCatalogSimilar.mockResolvedValue({
			error: upstreamBody,
			response: new Response(null, { status: 403 })
		});

		const response = await GET(
			makeEvent('https://app.test/v1/catalog/1182/similar', {
				headers: { Authorization: 'Bearer pk_test_denied' }
			})
		);

		expect(response.status).toBe(403);
		expect(await response.json()).toEqual(upstreamBody);
		expectLegacyHeaders(response);
	});

	it('relays upstream error status, body, and rate-limit headers', async () => {
		const upstreamBody = {
			error: 'Rate limit exceeded',
			message: 'API rate limit exceeded for your subscription plan'
		};
		mockCatalogSimilar.mockResolvedValue({
			error: upstreamBody,
			response: new Response(null, {
				status: 429,
				headers: {
					'X-RateLimit-Limit': '100',
					'X-RateLimit-Remaining': '0',
					'X-RateLimit-Reset': '1782864000',
					'Retry-After': '3600'
				}
			})
		});

		const response = await GET(makeEvent('https://app.test/v1/catalog/1182/similar'));

		expect(response.status).toBe(429);
		expect(await response.json()).toEqual(upstreamBody);
		expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
		expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
		expect(response.headers.get('X-RateLimit-Reset')).toBe('1782864000');
		expect(response.headers.get('Retry-After')).toBe('3600');
		expectLegacyHeaders(response);
	});

	it('returns a JSON 503 when Parchment is unconfigured', async () => {
		const configError = new Error('PARCHMENT_API_BASE_URL is not configured');
		configError.name = 'ParchmentConfigError';
		mockCreateParchmentServerClient.mockRejectedValue(configError);

		const response = await GET(makeEvent('https://app.test/v1/catalog/1182/similar'));

		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({
			error: 'Catalog schema unavailable',
			message: 'PARCHMENT_API_BASE_URL is not configured'
		});
		expectLegacyHeaders(response);
	});

	it('returns a JSON 500 when the upstream fetch rejects', async () => {
		mockCatalogSimilar.mockRejectedValue(new Error('network down'));

		const response = await GET(makeEvent('https://app.test/v1/catalog/1182/similar'));

		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({
			error: 'Failed to fetch similar coffees',
			message: 'Internal server error'
		});
		expectLegacyHeaders(response);
	});
});
