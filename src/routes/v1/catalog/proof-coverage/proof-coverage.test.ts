import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockBuildCatalogProofCoverageResponse = vi.fn();

vi.mock('$lib/server/catalogResource', () => ({
	buildCatalogProofCoverageResponse: mockBuildCatalogProofCoverageResponse
}));

let GET: typeof import('./+server').GET;

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();
	({ GET } = await import('./+server'));
});

describe('/v1/catalog/proof-coverage route', () => {
	it('delegates to the shared proof coverage builder', async () => {
		const expected = new Response(JSON.stringify({ ok: true }), { status: 200 });
		mockBuildCatalogProofCoverageResponse.mockResolvedValue(expected);

		const response = await GET({
			url: new URL('https://app.test/v1/catalog/proof-coverage?stocked=true'),
			request: new Request('https://app.test/v1/catalog/proof-coverage?stocked=true'),
			locals: {}
		} as Parameters<NonNullable<typeof GET>>[0]);

		expect(response).toBe(expected);
		expect(mockBuildCatalogProofCoverageResponse).toHaveBeenCalledWith(expect.anything(), {
			requestPath: '/v1/catalog/proof-coverage'
		});
	});
});
