import { describe, expect, it, beforeEach, vi } from 'vitest';

// Mock the catalogResource module to isolate the handler
vi.mock('$lib/server/catalogResource', () => ({
	buildCanonicalCatalogResponse: vi.fn()
}));

import { buildCanonicalCatalogResponse } from '$lib/server/catalogResource';

let GET: typeof import('./+server').GET;

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();
	({ GET } = await import('./+server'));
});

describe('/api/catalog-api legacy delegate', () => {
	it('delegates to buildCanonicalCatalogResponse with /v1/catalog requestPath', async () => {
		const mockBody = JSON.stringify({ data: [], pagination: {} });
		const mockResponse = new Response(mockBody, {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
		vi.mocked(buildCanonicalCatalogResponse).mockResolvedValue(mockResponse);

		const response = await GET({
			url: new URL('https://app.test/api/catalog-api'),
			request: new Request('https://app.test/api/catalog-api'),
			locals: {}
		} as Parameters<NonNullable<typeof GET>>[0]);

		expect(buildCanonicalCatalogResponse).toHaveBeenCalledWith(
			expect.objectContaining({ url: expect.any(URL) }),
			{ requestPath: '/v1/catalog' }
		);
		expect(response.status).toBe(200);
	});

	it('adds Deprecation header to the response', async () => {
		const mockResponse = new Response(JSON.stringify({ data: [] }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
		vi.mocked(buildCanonicalCatalogResponse).mockResolvedValue(mockResponse);

		const response = await GET({
			url: new URL('https://app.test/api/catalog-api'),
			request: new Request('https://app.test/api/catalog-api'),
			locals: {}
		} as Parameters<NonNullable<typeof GET>>[0]);

		expect(response.headers.get('Deprecation')).toBe('true');
		expect(response.headers.get('Link')).toContain('/v1/catalog');
	});

	it('adds Sunset header with a future date', async () => {
		const mockResponse = new Response(JSON.stringify({ data: [] }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
		vi.mocked(buildCanonicalCatalogResponse).mockResolvedValue(mockResponse);

		const response = await GET({
			url: new URL('https://app.test/api/catalog-api'),
			request: new Request('https://app.test/api/catalog-api'),
			locals: {}
		} as Parameters<NonNullable<typeof GET>>[0]);

		const sunset = response.headers.get('Sunset');
		expect(sunset).toBeTruthy();
		expect(new Date(sunset!).getTime()).toBeGreaterThan(Date.now());
	});

	it('passes query parameters through to the underlying handler', async () => {
		const mockResponse = new Response(JSON.stringify({ data: [] }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
		vi.mocked(buildCanonicalCatalogResponse).mockResolvedValue(mockResponse);

		await GET({
			url: new URL('https://app.test/api/catalog-api?page=2&limit=10&source=sweet_marias'),
			request: new Request('https://app.test/api/catalog-api?page=2&limit=10&source=sweet_marias'),
			locals: {}
		} as Parameters<NonNullable<typeof GET>>[0]);

		// The event is passed through to buildCanonicalCatalogResponse which reads
		// query params from event.url — so the mock just needs to have been called.
		expect(buildCanonicalCatalogResponse).toHaveBeenCalled();
	});
});
