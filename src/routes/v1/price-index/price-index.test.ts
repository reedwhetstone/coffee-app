import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockBuildCanonicalPriceIndexResponse = vi.fn();

vi.mock('$lib/server/priceIndexResource', () => ({
	buildCanonicalPriceIndexResponse: mockBuildCanonicalPriceIndexResponse
}));

let GET: typeof import('./+server').GET;

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();
	({ GET } = await import('./+server'));
});

describe('/v1/price-index route', () => {
	it('delegates to the shared canonical price-index builder', async () => {
		const expected = new Response(JSON.stringify({ ok: true }), { status: 200 });
		mockBuildCanonicalPriceIndexResponse.mockResolvedValue(expected);

		const response = await GET({
			url: new URL('https://app.test/v1/price-index'),
			request: new Request('https://app.test/v1/price-index'),
			locals: {}
		} as Parameters<NonNullable<typeof GET>>[0]);

		expect(response).toBe(expected);
		expect(mockBuildCanonicalPriceIndexResponse).toHaveBeenCalledWith(expect.anything(), {
			requestPath: '/v1/price-index'
		});
	});
});
