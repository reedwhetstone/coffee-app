import { describe, expect, it, beforeEach, vi } from 'vitest';

let GET: typeof import('./+server').GET;

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();
	({ GET } = await import('./+server'));
});

describe('/api/catalog-api legacy redirect', () => {
	it('returns a 308 permanent redirect to /v1/catalog', async () => {
		try {
			await GET({
				url: new URL('https://app.test/api/catalog-api'),
				request: new Request('https://app.test/api/catalog-api'),
				locals: {}
			} as Parameters<NonNullable<typeof GET>>[0]);
			// Should not reach here — redirect throws
			expect.unreachable('Expected redirect to be thrown');
		} catch (error) {
			// SvelteKit redirect throws an object with status and location
			expect(error).toHaveProperty('status', 308);
			expect(error).toHaveProperty('location', 'https://app.test/v1/catalog');
		}
	});

	it('forwards query parameters to the redirected URL', async () => {
		try {
			await GET({
				url: new URL('https://app.test/api/catalog-api?page=2&limit=10&source=sweet_marias'),
				request: new Request(
					'https://app.test/api/catalog-api?page=2&limit=10&source=sweet_marias'
				),
				locals: {}
			} as Parameters<NonNullable<typeof GET>>[0]);
			expect.unreachable('Expected redirect to be thrown');
		} catch (error) {
			expect(error).toHaveProperty('status', 308);
			expect(error).toHaveProperty(
				'location',
				'https://app.test/v1/catalog?page=2&limit=10&source=sweet_marias'
			);
		}
	});

	it('handles requests with no query parameters', async () => {
		try {
			await GET({
				url: new URL('https://app.test/api/catalog-api'),
				request: new Request('https://app.test/api/catalog-api'),
				locals: {}
			} as Parameters<NonNullable<typeof GET>>[0]);
			expect.unreachable('Expected redirect to be thrown');
		} catch (error) {
			expect(error).toHaveProperty('status', 308);
			expect(error).toHaveProperty('location', 'https://app.test/v1/catalog');
		}
	});
});
