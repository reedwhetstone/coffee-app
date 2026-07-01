import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateParchmentServerClient = vi.fn();
const mockProofCoverage = vi.fn();
const mockResolvePrincipal = vi.fn();

vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: mockCreateParchmentServerClient
}));

vi.mock('$lib/server/principal', () => ({
	resolvePrincipal: mockResolvePrincipal
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

	mockResolvePrincipal.mockResolvedValue({ isAuthenticated: false });

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
		// (and any stocked/filter narrowing) is owned by Parchment and not accepted
		// here (verified live — scope filters are byte-identical no-ops), so the route
		// forwards nothing and the aggregate is relayed verbatim.
		expect(mockProofCoverage).toHaveBeenCalledTimes(1);
		expect(mockProofCoverage).toHaveBeenCalledWith();
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ meta: {}, coverage: { overall: [] } });
	});

	it('rejects a present-but-invalid Authorization header with 401 before proxying', async () => {
		const response = await GET(
			makeEvent('https://app.test/v1/catalog/proof-coverage', {
				headers: { Authorization: 'Bearer definitely_invalid' }
			})
		);

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual(
			expect.objectContaining({ error: 'Authentication required' })
		);
		expect(mockProofCoverage).not.toHaveBeenCalled();
	});

	it('does not advertise deprecation/sunset headers on the stable v1 route', async () => {
		const response = await GET(makeEvent('https://app.test/v1/catalog/proof-coverage'));

		expect(response.headers.get('Deprecation')).toBeNull();
		expect(response.headers.get('Link')).toBeNull();
		expect(response.headers.get('Sunset')).toBeNull();
	});

	it('returns a JSON 503 when Parchment is unconfigured instead of a generic 500', async () => {
		const configError = new Error('PARCHMENT_API_BASE_URL is not configured');
		configError.name = 'ParchmentConfigError';
		mockCreateParchmentServerClient.mockRejectedValue(configError);

		const response = await GET(makeEvent('https://app.test/v1/catalog/proof-coverage'));

		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({
			error: 'Catalog schema unavailable',
			message: 'PARCHMENT_API_BASE_URL is not configured'
		});
	});

	it('returns a JSON 500 when the upstream fetch rejects', async () => {
		mockProofCoverage.mockRejectedValue(new Error('network down'));

		const response = await GET(makeEvent('https://app.test/v1/catalog/proof-coverage'));

		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({
			error: 'Failed to fetch catalog data',
			message: 'Internal server error'
		});
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
