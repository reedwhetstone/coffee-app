import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateParchmentServerClient = vi.fn();
const mockPriceIndexList = vi.fn();

vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: mockCreateParchmentServerClient
}));

let GET: typeof import('./+server').GET;

function makeEvent(url: string, init?: RequestInit) {
	return {
		url: new URL(url),
		request: new Request(url, init),
		fetch: vi.fn(),
		locals: {}
	} as unknown as Parameters<NonNullable<typeof GET>>[0];
}

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();

	mockPriceIndexList.mockResolvedValue({
		data: { data: [{ origin: 'Ethiopia' }], pagination: { total: 1 }, meta: {} },
		response: new Response(null, { status: 200 })
	});
	mockCreateParchmentServerClient.mockResolvedValue({
		priceIndex: { list: mockPriceIndexList }
	});

	({ GET } = await import('./+server'));
});

describe('/v1/price-index route', () => {
	it('proxies the caller credential to Parchment and relays the response', async () => {
		const response = await GET(
			makeEvent('https://app.test/v1/price-index?page=2&limit=10&origin=Ethiopia')
		);

		expect(mockCreateParchmentServerClient).toHaveBeenCalledWith(expect.anything(), {
			mode: 'session',
			preferHandling: 'inherit'
		});
		expect(mockPriceIndexList).toHaveBeenCalledWith(
			expect.objectContaining({ page: '2', limit: '10', origin: 'Ethiopia' })
		);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			data: [{ origin: 'Ethiopia' }],
			pagination: { total: 1 },
			meta: {}
		});
	});

	it('forwards filter query params to Parchment without reshaping them', async () => {
		await GET(
			makeEvent('https://app.test/v1/price-index?process=Washed&grade=A&wholesale=true&from=2026-01-01')
		);

		expect(mockPriceIndexList).toHaveBeenCalledWith(
			expect.objectContaining({
				process: 'Washed',
				grade: 'A',
				wholesale: 'true',
				from: '2026-01-01'
			})
		);
	});

	it('advertises deprecation/sunset migration headers pointing at the canonical Parchment surface', async () => {
		const response = await GET(makeEvent('https://app.test/v1/price-index'));

		expect(response.headers.get('Deprecation')).toBe('true');
		expect(response.headers.get('Link')).toBe(
			'<https://api.purveyors.io/v1/price-index>; rel="successor-version"'
		);
		expect(response.headers.get('Sunset')).toBe('Thu, 31 Dec 2026 23:59:59 GMT');
	});

	it('returns a JSON 503 with migration headers when Parchment is unconfigured', async () => {
		const configError = new Error('PARCHMENT_API_BASE_URL is not configured');
		configError.name = 'ParchmentConfigError';
		mockCreateParchmentServerClient.mockRejectedValue(configError);

		const response = await GET(makeEvent('https://app.test/v1/price-index'));

		expect(response.status).toBe(503);
		expect(response.headers.get('Deprecation')).toBe('true');
		expect(await response.json()).toEqual({
			error: 'Price index unavailable',
			message: 'PARCHMENT_API_BASE_URL is not configured'
		});
	});

	it('returns a JSON 500 without leaking the error when the upstream fetch rejects', async () => {
		mockPriceIndexList.mockRejectedValue(new Error('network down'));

		const response = await GET(makeEvent('https://app.test/v1/price-index'));

		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({
			error: 'Failed to fetch price index data',
			message: 'Internal server error'
		});
	});

	it('relays upstream error bodies and status codes', async () => {
		mockPriceIndexList.mockResolvedValue({
			error: { error: 'Insufficient permissions', message: 'ppiAccess required' },
			response: new Response(null, { status: 403 })
		});

		const response = await GET(makeEvent('https://app.test/v1/price-index'));

		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({
			error: 'Insufficient permissions',
			message: 'ppiAccess required'
		});
	});

	it('relays upstream rate-limit headers', async () => {
		mockPriceIndexList.mockResolvedValue({
			data: { data: [], pagination: { total: 0 }, meta: {} },
			response: new Response(null, {
				status: 200,
				headers: { 'X-RateLimit-Remaining': '24' }
			})
		});

		const response = await GET(makeEvent('https://app.test/v1/price-index'));

		expect(response.headers.get('X-RateLimit-Remaining')).toBe('24');
	});
});
