import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockBuildLegacyExternalCatalogResponse = vi.fn();

vi.mock('$lib/server/catalogResource', () => ({
	buildLegacyExternalCatalogResponse: mockBuildLegacyExternalCatalogResponse
}));

let GET: typeof import('./+server').GET;

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();
	({ GET } = await import('./+server'));
});

describe('/api/catalog-api route', () => {
	it('delegates to the legacy external compatibility builder', async () => {
		const expected = new Response(JSON.stringify({ data: [{ id: 1 }] }), {
			status: 200,
			headers: {
				'X-RateLimit-Limit': '200'
			}
		});
		mockBuildLegacyExternalCatalogResponse.mockResolvedValue(expected);

		const response = await GET({
			url: new URL('https://app.test/api/catalog-api'),
			request: new Request('https://app.test/api/catalog-api'),
			locals: {}
		} as Parameters<NonNullable<typeof GET>>[0]);

		expect(response).toBe(expected);
		expect(mockBuildLegacyExternalCatalogResponse).toHaveBeenCalledWith(expect.anything(), {
			requestPath: '/api/catalog-api'
		});
	});
});
