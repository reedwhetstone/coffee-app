import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFacets = vi.fn();
const mockCreateParchmentServerClient = vi.fn(async () => ({
	catalog: { facets: mockFacets }
}));

vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: mockCreateParchmentServerClient
}));

let GET: typeof import('./+server').GET;

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();
	({ GET } = await import('./+server'));
});

function makeEvent(url: string) {
	return { url: new URL(url) } as unknown as Parameters<NonNullable<typeof GET>>[0];
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
		expect(mockFacets).toHaveBeenCalledWith(expect.objectContaining({ stocked: 'true' }));
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

	it('does not forward wholesale params that were not requested', async () => {
		mockFacets.mockResolvedValue({ data: { values: {} }, error: null });

		await GET(makeEvent('https://app.test/api/catalog/filters'));

		const query = mockFacets.mock.calls[0][0];
		expect(query).not.toHaveProperty('showWholesale');
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

	it('returns an empty object when Parchment omits values', async () => {
		mockFacets.mockResolvedValue({ data: {}, error: null });

		const response = await GET(makeEvent('https://app.test/api/catalog/filters'));

		expect(await response.json()).toEqual({});
	});
});
