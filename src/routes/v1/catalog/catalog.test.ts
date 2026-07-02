import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateParchmentServerClient = vi.fn();
const mockCatalogList = vi.fn();
const mockResolvePrincipal = vi.fn();

vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: mockCreateParchmentServerClient
}));

vi.mock('$lib/server/principal', () => ({
	resolvePrincipal: mockResolvePrincipal
}));

let GET: typeof import('./+server').GET;

function makeEvent(url: string, init?: RequestInit) {
	return {
		url: new URL(url),
		request: new Request(url, init),
		fetch: vi.fn(),
		locals: {}
	} as unknown as Parameters<NonNullable<typeof GET>>[0];
}

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();

	// Default: caller is anonymous. The invalid-bearer guard only triggers when an
	// Authorization header is also present, so header-less proxy tests are unaffected.
	mockResolvePrincipal.mockResolvedValue({ isAuthenticated: false });

	mockCatalogList.mockResolvedValue({
		data: { data: [{ id: 1 }], pagination: { total: 1 }, meta: {} },
		response: new Response(null, { status: 200 })
	});
	mockCreateParchmentServerClient.mockResolvedValue({
		catalog: { list: mockCatalogList }
	});

	({ GET } = await import('./+server'));
});

describe('/v1/catalog route', () => {
	it('proxies the caller credential to Parchment and relays the response', async () => {
		const response = await GET(makeEvent('https://app.test/v1/catalog?page=2&limit=10'));

		expect(mockCreateParchmentServerClient).toHaveBeenCalledWith(expect.anything(), {
			mode: 'session',
			preferHandling: 'inherit'
		});
		expect(mockCatalogList).toHaveBeenCalledWith(
			expect.objectContaining({ page: '2', limit: '10' })
		);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			data: [{ id: 1 }],
			pagination: { total: 1 },
			meta: {}
		});
	});

	it('forwards repeated query params to Parchment as arrays without reshaping them', async () => {
		await GET(
			makeEvent('https://app.test/v1/catalog?source=sweet_marias&source=showroom&country=Ethiopia')
		);

		expect(mockCatalogList).toHaveBeenCalledWith(
			expect.objectContaining({
				source: ['sweet_marias', 'showroom'],
				country: 'Ethiopia'
			})
		);
	});

	it('rejects a present-but-invalid Authorization header with 401 before proxying', async () => {
		const response = await GET(
			makeEvent('https://app.test/v1/catalog', {
				headers: { Authorization: 'Bearer definitely_invalid' }
			})
		);

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual(
			expect.objectContaining({ error: 'Authentication required' })
		);
		expect(mockCatalogList).not.toHaveBeenCalled();
	});

	it('does not advertise deprecation/sunset headers on the stable v1 route', async () => {
		const response = await GET(makeEvent('https://app.test/v1/catalog'));

		expect(response.headers.get('Deprecation')).toBeNull();
		expect(response.headers.get('Link')).toBeNull();
		expect(response.headers.get('Sunset')).toBeNull();
	});

	it('returns a JSON 503 when Parchment is unconfigured instead of a generic 500', async () => {
		const configError = new Error('PARCHMENT_API_BASE_URL is not configured');
		configError.name = 'ParchmentConfigError';
		mockCreateParchmentServerClient.mockRejectedValue(configError);

		const response = await GET(makeEvent('https://app.test/v1/catalog'));

		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({
			error: 'Catalog schema unavailable',
			message: 'PARCHMENT_API_BASE_URL is not configured'
		});
	});

	it('returns a JSON 500 when the upstream fetch rejects', async () => {
		mockCatalogList.mockRejectedValue(new Error('network down'));

		const response = await GET(makeEvent('https://app.test/v1/catalog'));

		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({
			error: 'Failed to fetch catalog data',
			message: 'Internal server error'
		});
	});

	it('relays upstream error bodies and status codes', async () => {
		mockCatalogList.mockResolvedValue({
			error: { error: 'Catalog schema unavailable', message: 'unavailable' },
			response: new Response(null, { status: 503 })
		});

		const response = await GET(makeEvent('https://app.test/v1/catalog'));

		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({
			error: 'Catalog schema unavailable',
			message: 'unavailable'
		});
	});

	it('relays upstream rate-limit headers', async () => {
		mockCatalogList.mockResolvedValue({
			data: { data: [], pagination: { total: 0 }, meta: {} },
			response: new Response(null, {
				status: 200,
				headers: { 'X-RateLimit-Remaining': '24' }
			})
		});

		const response = await GET(makeEvent('https://app.test/v1/catalog'));

		expect(response.headers.get('X-RateLimit-Remaining')).toBe('24');
	});
});
