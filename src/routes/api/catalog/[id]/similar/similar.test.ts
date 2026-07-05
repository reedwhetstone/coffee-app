import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreateParchmentServerClient, mockCatalogSimilar } = vi.hoisted(() => ({
	mockCreateParchmentServerClient: vi.fn(),
	mockCatalogSimilar: vi.fn()
}));

vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: mockCreateParchmentServerClient
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

describe('/api/catalog/[id]/similar route', () => {
	it('proxies valid first-party requests to Parchment with valid query params', async () => {
		const response = await GET(
			makeEvent(
				'https://app.test/api/catalog/1182/similar?limit=5&stocked_only=false&mode=likely_same&threshold=0.8&ignored=value'
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
		expect(response.headers.get('Deprecation')).toBeNull();
		expect(response.headers.get('Sunset')).toBeNull();
		// Member-only similarity data must never be shared-cacheable (ADR-008).
		expect(response.headers.get('Cache-Control')).toBe('private, no-store');
	});

	it('normalizes valid numeric ids before forwarding', async () => {
		await GET(makeEvent('https://app.test/api/catalog/0001182/similar', { id: '0001182' }));

		expect(mockCatalogSimilar).toHaveBeenCalledWith('1182', {});
	});

	it.each(['abc', '0', '2147483648', '999999999999', '9007199254740992'])(
		'returns 400 before proxying for invalid catalog id %s',
		async (id) => {
			const response = await GET(makeEvent(`https://app.test/api/catalog/${id}/similar`, { id }));
			const body = await response.json();

			expect(response.status).toBe(400);
			expect(body).toMatchObject({
				error: 'Invalid query parameter',
				details: { parameter: 'id', value: id }
			});
			expect(mockCreateParchmentServerClient).not.toHaveBeenCalled();
			expect(mockCatalogSimilar).not.toHaveBeenCalled();
			expect(response.headers.get('Cache-Control')).toBe('private, no-store');
		}
	);

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

		const response = await GET(makeEvent('https://app.test/api/catalog/1182/similar'));

		expect(response.status).toBe(429);
		expect(await response.json()).toEqual(upstreamBody);
		expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
		expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
		expect(response.headers.get('X-RateLimit-Reset')).toBe('1782864000');
		expect(response.headers.get('Retry-After')).toBe('3600');
		// Relayed upstream errors stay private/no-store while preserving rate-limit headers.
		expect(response.headers.get('Cache-Control')).toBe('private, no-store');
	});

	it('returns a JSON 503 when Parchment is unconfigured', async () => {
		const configError = new Error('PARCHMENT_API_BASE_URL is not configured');
		configError.name = 'ParchmentConfigError';
		mockCreateParchmentServerClient.mockRejectedValue(configError);

		const response = await GET(makeEvent('https://app.test/api/catalog/1182/similar'));

		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({
			error: 'Catalog schema unavailable',
			message: 'PARCHMENT_API_BASE_URL is not configured'
		});
		expect(response.headers.get('Cache-Control')).toBe('private, no-store');
	});
});
