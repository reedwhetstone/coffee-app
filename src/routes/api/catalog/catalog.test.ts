import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockBuildLegacyAppCatalogResponse = vi.fn();

vi.mock('$lib/server/catalogResource', () => ({
	buildLegacyAppCatalogResponse: mockBuildLegacyAppCatalogResponse
}));

let GET: typeof import('./+server').GET;

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();
	({ GET } = await import('./+server'));
});

describe('/api/catalog route', () => {
	it('delegates to the legacy app compatibility builder', async () => {
		const expected = new Response(JSON.stringify([{ id: 1 }]), { status: 200 });
		mockBuildLegacyAppCatalogResponse.mockResolvedValue(expected);

		const response = await GET({
			url: new URL('https://app.test/api/catalog'),
			request: new Request('https://app.test/api/catalog'),
			locals: {}
		} as Parameters<NonNullable<typeof GET>>[0]);

		expect(response).toBe(expected);
		expect(mockBuildLegacyAppCatalogResponse).toHaveBeenCalledWith(expect.anything(), {
			requestPath: '/api/catalog'
		});
	});
});
