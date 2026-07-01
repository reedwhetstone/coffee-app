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
		data: {
			data: [{ id: 1 }, { id: 2 }],
			pagination: { page: 1, limit: 15, total: 2 },
			meta: {}
		},
		response: new Response(null, { status: 200 })
	});
	mockCreateParchmentServerClient.mockResolvedValue({
		catalog: { list: mockCatalogList }
	});

	({ GET } = await import('./+server'));
});

describe('/api/catalog route', () => {
	it('proxies the caller credential to Parchment', async () => {
		await GET(makeEvent('https://app.test/api/catalog?page=2&limit=10'));

		expect(mockCreateParchmentServerClient).toHaveBeenCalledWith(expect.anything(), {
			mode: 'session'
		});
		expect(mockCatalogList).toHaveBeenCalledWith(
			expect.objectContaining({ page: '2', limit: '10' })
		);
	});

	it('unwraps the canonical envelope into the legacy paginated shape', async () => {
		const response = await GET(makeEvent('https://app.test/api/catalog'));

		expect(response.status).toBe(200);
		expect(response.headers.get('X-Purveyors-Canonical-Resource')).toBe('/v1/catalog');
		expect(await response.json()).toEqual({
			data: [{ id: 1 }, { id: 2 }],
			pagination: { page: 1, limit: 15, total: 2 }
		});
	});

	it('returns a bare data array when Parchment omits pagination', async () => {
		mockCatalogList.mockResolvedValue({
			data: { data: [{ id: 3 }], pagination: null, meta: {} },
			response: new Response(null, { status: 200 })
		});

		const response = await GET(makeEvent('https://app.test/api/catalog'));

		expect(await response.json()).toEqual([{ id: 3 }]);
	});

	it('relays upstream error bodies and status codes with the canonical resource header', async () => {
		mockCatalogList.mockResolvedValue({
			error: { error: 'Catalog schema unavailable', message: 'unavailable' },
			response: new Response(null, { status: 503 })
		});

		const response = await GET(makeEvent('https://app.test/api/catalog'));

		expect(response.status).toBe(503);
		expect(response.headers.get('X-Purveyors-Canonical-Resource')).toBe('/v1/catalog');
		expect(await response.json()).toEqual({
			error: 'Catalog schema unavailable',
			message: 'unavailable'
		});
	});
});
