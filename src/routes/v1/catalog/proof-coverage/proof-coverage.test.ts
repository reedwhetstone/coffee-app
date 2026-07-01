import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateParchmentServerClient = vi.fn();
const mockProofCoverage = vi.fn();

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

	mockProofCoverage.mockResolvedValue({
		data: { meta: {}, coverage: { overall: [] } },
		response: new Response(null, { status: 200 })
	});
	mockCreateParchmentServerClient.mockResolvedValue({
		catalog: { proofCoverage: mockProofCoverage }
	});

	({ GET } = await import('./+server'));
});

describe('/v1/catalog/proof-coverage route', () => {
	it('proxies the caller credential to Parchment and relays the aggregate', async () => {
		const response = await GET(makeEvent('https://app.test/v1/catalog/proof-coverage'));

		expect(mockCreateParchmentServerClient).toHaveBeenCalledWith(expect.anything(), {
			mode: 'session'
		});
		// The canonical proofCoverage() surface takes no query args: coverage scope
		// and any stocked/filter narrowing are owned by Parchment, so the route
		// forwards nothing and the aggregate is relayed verbatim.
		expect(mockProofCoverage).toHaveBeenCalledTimes(1);
		expect(mockProofCoverage).toHaveBeenCalledWith();
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ meta: {}, coverage: { overall: [] } });
	});

	it('adds deprecation, successor-version, and sunset headers', async () => {
		const response = await GET(makeEvent('https://app.test/v1/catalog/proof-coverage'));

		expect(response.headers.get('Deprecation')).toBe('true');
		expect(response.headers.get('Link')).toContain('/v1/catalog/proof-coverage');
		expect(response.headers.get('Link')).toContain('rel="successor-version"');
		expect(response.headers.get('Sunset')).toBe('Thu, 31 Dec 2026 23:59:59 GMT');
	});

	it('relays upstream error bodies and status codes', async () => {
		mockProofCoverage.mockResolvedValue({
			error: { error: 'Catalog schema unavailable', message: 'unavailable' },
			response: new Response(null, { status: 503 })
		});

		const response = await GET(makeEvent('https://app.test/v1/catalog/proof-coverage'));

		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({
			error: 'Catalog schema unavailable',
			message: 'unavailable'
		});
	});
});
