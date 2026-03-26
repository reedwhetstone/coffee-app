import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockBuildCanonicalCatalogResponse = vi.fn();

vi.mock('$lib/server/catalogResource', () => ({
	buildCanonicalCatalogResponse: mockBuildCanonicalCatalogResponse
}));

let GET: typeof import('./+server').GET;

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();
	({ GET } = await import('./+server'));
});

describe('/v1/catalog route', () => {
	it('delegates to the shared canonical catalog builder', async () => {
		const expected = new Response(JSON.stringify({ ok: true }), { status: 200 });
		mockBuildCanonicalCatalogResponse.mockResolvedValue(expected);

		const response = await GET({
			url: new URL('https://app.test/v1/catalog'),
			request: new Request('https://app.test/v1/catalog'),
			locals: {}
		} as Parameters<NonNullable<typeof GET>>[0]);

		expect(response).toBe(expected);
		expect(mockBuildCanonicalCatalogResponse).toHaveBeenCalledWith(expect.anything(), {
			requestPath: '/v1/catalog'
		});
	});
});
