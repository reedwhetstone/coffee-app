import { describe, expect, it, beforeEach, vi } from 'vitest';

let GET: typeof import('./+server').GET;

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();
	({ GET } = await import('./+server'));
});

describe('/api/catalog-api legacy redirect', () => {
	it('returns a 308 permanent redirect to /v1/catalog', async () => {
		const response = await GET({
			url: new URL('https://app.test/api/catalog-api'),
			request: new Request('https://app.test/api/catalog-api'),
			locals: {}
		} as Parameters<NonNullable<typeof GET>>[0]);
		expect(response.status).toBe(308);
		expect(response.headers.get('Location')).toBe('https://app.test/v1/catalog');
	});

	it('forwards query parameters to the redirected URL', async () => {
		const response = await GET({
			url: new URL('https://app.test/api/catalog-api?page=2&limit=10&source=sweet_marias'),
			request: new Request(
				'https://app.test/api/catalog-api?page=2&limit=10&source=sweet_marias'
			),
			locals: {}
		} as Parameters<NonNullable<typeof GET>>[0]);
		expect(response.status).toBe(308);
		expect(response.headers.get('Location')).toBe(
			'https://app.test/v1/catalog?page=2&limit=10&source=sweet_marias'
		);
	});

	it('handles requests with no query parameters', async () => {
		const response = await GET({
			url: new URL('https://app.test/api/catalog-api'),
			request: new Request('https://app.test/api/catalog-api'),
			locals: {}
		} as Parameters<NonNullable<typeof GET>>[0]);
		expect(response.status).toBe(308);
		expect(response.headers.get('Location')).toBe('https://app.test/v1/catalog');
	});
});
