import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateParchmentServerClient = vi.fn();
const mockCatalogList = vi.fn();

vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: mockCreateParchmentServerClient
}));

let GET: typeof import('./+server').GET;

function makeEvent(url: string) {
	return {
		url: new URL(url),
		request: new Request(url),
		fetch: vi.fn(),
		locals: {}
	} as unknown as Parameters<NonNullable<typeof GET>>[0];
}

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();

	mockCatalogList.mockResolvedValue({
		data: { data: [{ id: 1 }], pagination: { total: 1 }, meta: {} },
		response: new Response(null, { status: 200 })
	});
	mockCreateParchmentServerClient.mockResolvedValue({
		catalog: { list: mockCatalogList }
	});

	({ GET } = await import('./+server'));
});

describe('/v1/catalog route', () => {
	it('proxies the caller credential to Parchment and relays the response', async () => {
		const response = await GET(makeEvent('https://app.test/v1/catalog?page=2&limit=10'));

		expect(mockCreateParchmentServerClient).toHaveBeenCalledWith(expect.anything(), {
			mode: 'session'
		});
		expect(mockCatalogList).toHaveBeenCalledWith(
			expect.objectContaining({ page: '2', limit: '10' })
		);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			data: [{ id: 1 }],
			pagination: { total: 1 },
			meta: {}
		});
	});

	it('forwards repeated query params to Parchment as arrays without reshaping them', async () => {
		await GET(
			makeEvent('https://app.test/v1/catalog?source=sweet_marias&source=showroom&country=Ethiopia')
		);

		expect(mockCatalogList).toHaveBeenCalledWith(
			expect.objectContaining({
				source: ['sweet_marias', 'showroom'],
				country: 'Ethiopia'
			})
		);
	});

	it('adds deprecation, successor-version, and sunset headers', async () => {
		const response = await GET(makeEvent('https://app.test/v1/catalog'));

		expect(response.headers.get('Deprecation')).toBe('true');
		expect(response.headers.get('Link')).toContain('/v1/catalog');
		expect(response.headers.get('Link')).toContain('rel="successor-version"');
		expect(response.headers.get('Sunset')).toBe('Thu, 31 Dec 2026 23:59:59 GMT');
	});

	it('relays upstream error bodies and status codes', async () => {
		mockCatalogList.mockResolvedValue({
			error: { error: 'Catalog schema unavailable', message: 'unavailable' },
			response: new Response(null, { status: 503 })
		});

		const response = await GET(makeEvent('https://app.test/v1/catalog'));

		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({
			error: 'Catalog schema unavailable',
			message: 'unavailable'
		});
	});

	it('relays upstream rate-limit headers', async () => {
		mockCatalogList.mockResolvedValue({
			data: { data: [], pagination: { total: 0 }, meta: {} },
			response: new Response(null, {
				status: 200,
				headers: { 'X-RateLimit-Remaining': '24' }
			})
		});

		const response = await GET(makeEvent('https://app.test/v1/catalog'));

		expect(response.headers.get('X-RateLimit-Remaining')).toBe('24');
	});
});
