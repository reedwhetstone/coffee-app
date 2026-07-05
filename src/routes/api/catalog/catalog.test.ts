import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateParchmentServerClient = vi.fn();
const mockCatalogList = vi.fn();
const mockResolvePrincipal = vi.fn();
const mockResolveCatalogCredentialMode = vi.fn();

vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: mockCreateParchmentServerClient,
	resolveCatalogCredentialMode: mockResolveCatalogCredentialMode
}));

vi.mock('$lib/server/principal', () => ({
	isApiKeyPrincipal: (principal: { authKind?: string }) => principal.authKind === 'api-key',
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

	mockResolvePrincipal.mockResolvedValue({ isAuthenticated: false });
	mockResolveCatalogCredentialMode.mockReturnValue('public-demo');
	mockCatalogList.mockResolvedValue({
		data: {
			data: [{ id: 1 }, { id: 2 }],
			pagination: { page: 1, limit: 15, total: 2 },
			meta: { notices: [] }
		},
		response: new Response(null, { status: 200 })
	});
	mockCreateParchmentServerClient.mockResolvedValue({
		catalog: { list: mockCatalogList }
	});

	({ GET } = await import('./+server'));
});

describe('/api/catalog route', () => {
	it('proxies through the website credential lane to Parchment', async () => {
		await GET(makeEvent('https://app.test/api/catalog?page=2&limit=10'));

		expect(mockCreateParchmentServerClient).toHaveBeenCalledWith(expect.anything(), {
			mode: 'public-demo',
			preferHandling: 'lenient'
		});
		expect(mockCatalogList).toHaveBeenCalledWith(
			expect.objectContaining({ page: '2', limit: '10' })
		);
	});

	it('unwraps the canonical envelope into the legacy paginated shape', async () => {
		const response = await GET(makeEvent('https://app.test/api/catalog?page=1&limit=15'));

		expect(response.status).toBe(200);
		expect(response.headers.get('X-Purveyors-Canonical-Resource')).toBe('/v1/catalog');
		expect(await response.json()).toEqual({
			data: [{ id: 1 }, { id: 2 }],
			pagination: { page: 1, limit: 15, total: 2 },
			meta: { notices: [] }
		});
	});

	it('uses session mode for authenticated website catalog callers', async () => {
		mockResolveCatalogCredentialMode.mockReturnValue('session');
		mockResolvePrincipal.mockResolvedValue({ authKind: 'session', isAuthenticated: true });

		await GET(makeEvent('https://app.test/api/catalog?page=1&limit=15'));

		expect(mockCreateParchmentServerClient).toHaveBeenCalledWith(expect.anything(), {
			mode: 'session',
			preferHandling: 'lenient'
		});
	});

	it('preserves strict handling for API-key catalog callers', async () => {
		mockResolveCatalogCredentialMode.mockReturnValue('session');
		mockResolvePrincipal.mockResolvedValue({ authKind: 'api-key', isAuthenticated: true });

		await GET(
			makeEvent('https://app.test/api/catalog?page=1&limit=15', {
				headers: { Authorization: 'Bearer purvey_test_key' }
			})
		);

		expect(mockCreateParchmentServerClient).toHaveBeenCalledWith(expect.anything(), {
			mode: 'session',
			preferHandling: 'inherit'
		});
	});

	it('injects the max default limit for the legacy full-list contract when unparameterized', async () => {
		await GET(makeEvent('https://app.test/api/catalog'));

		expect(mockCatalogList).toHaveBeenCalledWith(expect.objectContaining({ limit: '1000' }));
	});

	it('does not override an explicit limit', async () => {
		await GET(makeEvent('https://app.test/api/catalog?limit=25'));

		expect(mockCatalogList).toHaveBeenCalledWith(expect.objectContaining({ limit: '25' }));
	});

	it('rejects a present-but-invalid Authorization header with 401 before proxying', async () => {
		const response = await GET(
			makeEvent('https://app.test/api/catalog', {
				headers: { Authorization: 'Bearer definitely_invalid' }
			})
		);

		expect(response.status).toBe(401);
		expect(response.headers.get('X-Purveyors-Canonical-Resource')).toBe('/v1/catalog');
		expect(await response.json()).toEqual({
			error: 'Authentication required',
			message: 'Authentication required'
		});
		expect(mockCreateParchmentServerClient).not.toHaveBeenCalled();
		expect(mockCatalogList).not.toHaveBeenCalled();
	});

	it('relays upstream error bodies and status codes with the canonical resource header', async () => {
		mockCatalogList.mockResolvedValue({
			error: { error: 'Catalog schema unavailable', message: 'unavailable' },
			response: new Response(null, { status: 503 })
		});

		const response = await GET(makeEvent('https://app.test/api/catalog'));

		expect(response.status).toBe(503);
		expect(response.headers.get('X-Purveyors-Canonical-Resource')).toBe('/v1/catalog');
		expect(await response.json()).toEqual({
			error: 'Catalog schema unavailable',
			message: 'unavailable'
		});
	});

	it('degrades to an empty catalog when Parchment is unconfigured', async () => {
		// The client factory throws ParchmentConfigError before any request when
		// PARCHMENT_API_BASE_URL is unset (e.g. CI/preview). The endpoint must not
		// hard-fail: it returns an empty catalog so first-party callers still load,
		// matching the catalog page's ParchmentConfigError degradation.
		const configError = new Error('PARCHMENT_API_BASE_URL is not configured');
		configError.name = 'ParchmentConfigError';
		mockCreateParchmentServerClient.mockRejectedValue(configError);

		const response = await GET(makeEvent('https://app.test/api/catalog'));

		expect(response.status).toBe(200);
		expect(response.headers.get('X-Purveyors-Canonical-Resource')).toBe('/v1/catalog');
		expect(await response.json()).toEqual({ data: [], pagination: null });
	});

	it('returns a JSON 500 with the canonical resource header when the upstream fetch rejects', async () => {
		mockCatalogList.mockRejectedValue(new Error('network down'));

		const response = await GET(makeEvent('https://app.test/api/catalog'));

		expect(response.status).toBe(500);
		expect(response.headers.get('X-Purveyors-Canonical-Resource')).toBe('/v1/catalog');
		expect(await response.json()).toEqual({
			error: 'Failed to fetch catalog data',
			message: 'Internal server error'
		});
	});
});

describe('/api/catalog session-aware cache headers', () => {
	it('serves anonymous callers the public, short-TTL policy and keys the cache on Cookie', async () => {
		mockResolvePrincipal.mockResolvedValue({ isAuthenticated: false });

		const response = await GET(makeEvent('https://app.test/api/catalog?limit=15'));

		expect(response.status).toBe(200);
		expect(response.headers.get('Cache-Control')).toBe(
			'public, s-maxage=60, stale-while-revalidate=300'
		);
		expect(response.headers.get('Vary') ?? '').toContain('Cookie');
	});

	it('forces private/no-store for an authenticated caller (the member-leak gate)', async () => {
		mockResolvePrincipal.mockResolvedValue({ isAuthenticated: true, authKind: 'session' });

		const response = await GET(makeEvent('https://app.test/api/catalog?limit=15'));

		expect(response.status).toBe(200);
		expect(response.headers.get('Cache-Control')).toBe('private, no-store');
		expect(response.headers.get('Vary') ?? '').not.toContain('Cookie');
	});

	it('never lets an error response be shared-cacheable', async () => {
		mockResolvePrincipal.mockResolvedValue({ isAuthenticated: false });
		mockCatalogList.mockRejectedValue(new Error('network down'));

		const response = await GET(makeEvent('https://app.test/api/catalog'));

		expect(response.status).toBe(500);
		expect(response.headers.get('Cache-Control')).toBe('private, no-store');
	});
});
