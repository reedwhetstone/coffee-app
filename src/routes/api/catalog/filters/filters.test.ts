import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFacets = vi.fn();
const mockTaxonomies = vi.fn();
const mockGrades = vi.fn();
const mockList = vi.fn();
const mockCreateParchmentServerClient = vi.fn(async () => ({
	catalog: { facets: mockFacets, taxonomies: mockTaxonomies, grades: mockGrades, list: mockList }
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

	describe('with counts=1', () => {
		const countsUrl =
			'https://app.test/api/catalog/filters?counts=1&country=Kenya&price_per_lb_max=8&variety_code=bourbon';

		beforeEach(() => {
			mockFacets.mockResolvedValue({
				data: {
					values: { countries: ['Kenya'] },
					facets: { countries: [{ value: 'Kenya', count: 85 }] }
				},
				error: null
			});
			mockTaxonomies.mockResolvedValue({
				data: {
					data: {
						varieties: [{ code: 'bourbon', label: 'Bourbon', parent_code: null }],
						species: [],
						drying_methods: []
					}
				},
				error: null
			});
			mockGrades.mockResolvedValue({
				data: {
					data: [
						{
							code: 'KE:AA',
							label: 'Kenya AA',
							description: "Kenya's largest standard screen grade.",
							dimensions: ['size'],
							sort_order: 100,
							active: true
						}
					]
				},
				error: null
			});
			mockList.mockResolvedValue({ data: { data: [], pagination: { total: 10 } }, error: null });
		});

		it('returns options and counts under the request filters, leaving entitlement to Parchment', async () => {
			const response = await GET(makeEvent(countsUrl));

			expect(response.status).toBe(200);
			const body = await response.json();
			expect(body.facets.countries).toEqual([{ value: 'Kenya', count: 85 }]);
			expect(body.values.countries).toEqual(['Kenya']);
			expect(body).not.toHaveProperty('vocabulary');
			// The request's filters are forwarded as sent; lenient handling lets
			// Parchment drop the ones this caller may not use, as it does for the rows.
			expect(mockCreateParchmentServerClient).toHaveBeenCalledWith(expect.anything(), {
				mode: 'public-demo',
				preferHandling: 'lenient'
			});
			expect(mockFacets).toHaveBeenCalledWith({
				stocked: 'true',
				showWholesale: 'true',
				country: 'Kenya',
				pricePerLbMax: '8',
				varietyCode: 'bourbon'
			});
			expect(mockTaxonomies).not.toHaveBeenCalled();
		});

		it('adds the vocabulary and standardized counts for a member session', async () => {
			mockResolveCatalogCredentialMode.mockReturnValue('session');
			mockResolvePrincipal.mockResolvedValue({
				isAuthenticated: true,
				authKind: 'session',
				primaryAppRole: 'member',
				apiPlan: 'viewer'
			});

			const response = await GET(makeEvent(countsUrl));

			const body = await response.json();
			expect(body.vocabulary.varieties).toEqual([
				{ code: 'bourbon', label: 'Bourbon', parent_code: null }
			]);
			expect(body.unstandardizedVarietyCount).toBe(0);
			expect(body.grades).toEqual([
				{
					code: 'KE:AA',
					label: 'Kenya AA',
					description: "Kenya's largest standard screen grade.",
					dimensions: ['size'],
					sort_order: 100
				}
			]);
			expect(mockFacets).toHaveBeenCalledWith(
				expect.objectContaining({ include: 'taxonomy,grading', varietyCode: 'bourbon' })
			);
			expect(response.headers.get('cache-control')).toContain('no-store');
		});

		it('does not ask for the standardized counts for a signed-in free account', async () => {
			mockResolvePrincipal.mockResolvedValue({
				isAuthenticated: true,
				authKind: 'session',
				primaryAppRole: 'viewer',
				apiPlan: 'viewer'
			});

			const response = await GET(makeEvent(countsUrl));

			const body = await response.json();
			expect(body).not.toHaveProperty('vocabulary');
			expect(body).not.toHaveProperty('grades');
			expect(mockFacets).toHaveBeenCalledWith(
				expect.not.objectContaining({ include: expect.anything() })
			);
			expect(mockTaxonomies).not.toHaveBeenCalled();
			expect(mockGrades).not.toHaveBeenCalled();
		});

		it('returns 500 when the counts cannot be read', async () => {
			mockFacets.mockResolvedValue({
				data: undefined,
				error: { error: { code: 'invalid_query' } }
			});
			const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

			const response = await GET(makeEvent(countsUrl));

			expect(response.status).toBe(500);
			consoleError.mockRestore();
		});
	});
});
