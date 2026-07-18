import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFacets = vi.fn();
const mockCreateParchmentServerClient = vi.fn(async () => ({
	catalog: { facets: mockFacets }
}));
const mockResolveCatalogCredentialMode = vi.fn();
const mockResolvePrincipal = vi.fn();

vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: mockCreateParchmentServerClient,
	resolveCatalogCredentialMode: mockResolveCatalogCredentialMode
}));

vi.mock('$lib/server/principal', () => ({
	resolvePrincipal: mockResolvePrincipal
}));

let GET: typeof import('./+server').GET;

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();
	mockResolvePrincipal.mockResolvedValue({ isAuthenticated: false });
	mockResolveCatalogCredentialMode.mockReturnValue('public-demo');
	({ GET } = await import('./+server'));
});

function makeEvent(url: string, init?: RequestInit) {
	return {
		url: new URL(url),
		request: new Request(url, init),
		locals: {}
	} as unknown as Parameters<NonNullable<typeof GET>>[0];
}

describe('/api/catalog/filters', () => {
	it('returns the Parchment facet values payload', async () => {
		mockFacets.mockResolvedValue({
			data: { values: { sources: ['A', 'B'], processing: ['Natural', 'Washed'] } },
			error: null
		});

		const response = await GET(makeEvent('https://app.test/api/catalog/filters'));

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			sources: ['A', 'B'],
			processing: ['Natural', 'Washed']
		});
		// Access-aware gating (premium metadata, visibility) is enforced by
		// Parchment now, so the endpoint just forwards the request.
		expect(mockCreateParchmentServerClient).toHaveBeenCalledWith(expect.anything(), {
			mode: 'public-demo',
			preferHandling: 'lenient'
		});
		expect(mockFacets).toHaveBeenCalledWith(
			expect.objectContaining({ stocked: 'true', showWholesale: 'true' })
		);
	});

	it('uses session mode for authenticated website facet callers', async () => {
		mockResolveCatalogCredentialMode.mockReturnValue('session');
		mockFacets.mockResolvedValue({ data: { values: {} }, error: null });

		await GET(makeEvent('https://app.test/api/catalog/filters'));

		expect(mockCreateParchmentServerClient).toHaveBeenCalledWith(expect.anything(), {
			mode: 'session',
			preferHandling: 'lenient'
		});
	});

	it('forwards the wholesale view params to Parchment', async () => {
		mockFacets.mockResolvedValue({ data: { values: {} }, error: null });

		await GET(
			makeEvent('https://app.test/api/catalog/filters?showWholesale=true&wholesaleOnly=true')
		);

		expect(mockFacets).toHaveBeenCalledWith(
			expect.objectContaining({ showWholesale: 'true', wholesaleOnly: 'true' })
		);
	});

	it('normalizes contradictory wholesale-only facet scope flags', async () => {
		mockFacets.mockResolvedValue({ data: { values: {} }, error: null });

		await GET(
			makeEvent('https://app.test/api/catalog/filters?showWholesale=false&wholesaleOnly=true')
		);

		expect(mockFacets).toHaveBeenCalledWith(
			expect.objectContaining({ showWholesale: 'true', wholesaleOnly: 'true' })
		);
	});

	it('preserves hobbyist-only visibility explicitly', async () => {
		mockFacets.mockResolvedValue({ data: { values: {} }, error: null });

		await GET(makeEvent('https://app.test/api/catalog/filters?showWholesale=false'));

		const query = mockFacets.mock.calls[0][0];
		expect(query).toMatchObject({ showWholesale: 'false' });
		expect(query).not.toHaveProperty('wholesaleOnly');
	});

	it('returns 500 when Parchment returns an error envelope', async () => {
		mockFacets.mockResolvedValue({
			data: undefined,
			error: { error: { code: 'schema_unavailable' } }
		});

		const response = await GET(makeEvent('https://app.test/api/catalog/filters'));

		expect(response.status).toBe(500);
	});

	it('rejects a present-but-invalid Authorization header before proxying', async () => {
		mockResolvePrincipal.mockResolvedValue({ isAuthenticated: false });

		const response = await GET(
			makeEvent('https://app.test/api/catalog/filters', {
				headers: { Authorization: 'Bearer definitely_invalid' }
			})
		);

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({
			error: 'Authentication required',
			message: 'Authentication required'
		});
		expect(mockCreateParchmentServerClient).not.toHaveBeenCalled();
		expect(mockFacets).not.toHaveBeenCalled();
	});

	it('returns an empty object when Parchment omits values', async () => {
		mockFacets.mockResolvedValue({ data: {}, error: null });

		const response = await GET(makeEvent('https://app.test/api/catalog/filters'));

		expect(await response.json()).toEqual({});
	});
});
