import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateParchmentServerClient = vi.fn();
const mockResolvePrincipal = vi.fn();
const mockBriefsList = vi.fn();
const mockBriefCreate = vi.fn();
const mockBriefGet = vi.fn();
const mockBriefMatches = vi.fn();

vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: mockCreateParchmentServerClient
}));

vi.mock('$lib/server/principal', () => ({
	resolvePrincipal: mockResolvePrincipal
}));

let collection: typeof import('./+server');
let detail: typeof import('./[id]/+server');
let matches: typeof import('./[id]/matches/+server');

function makeEvent(url: string, init?: RequestInit, id = 'brief-id') {
	return {
		url: new URL(url),
		request: new Request(url, init),
		params: { id },
		fetch: vi.fn(),
		locals: {}
	} as never;
}

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();

	mockResolvePrincipal.mockResolvedValue({ isAuthenticated: true });

	mockBriefsList.mockResolvedValue({
		data: { data: [{ id: 'brief-id', name: 'Kenya AA' }], meta: {} },
		response: new Response(null, { status: 200 })
	});
	mockBriefCreate.mockResolvedValue({
		data: { data: { id: 'brief-id', name: 'Kenya AA' }, meta: {} },
		response: new Response(null, { status: 201 })
	});
	mockBriefGet.mockResolvedValue({
		data: { data: { id: 'brief-id', name: 'Kenya AA' }, meta: {} },
		response: new Response(null, { status: 200 })
	});
	mockBriefMatches.mockResolvedValue({
		data: { data: [], pagination: { total: 0 }, meta: {} },
		response: new Response(null, { status: 200 })
	});

	mockCreateParchmentServerClient.mockResolvedValue({
		procurement: {
			briefs: {
				list: mockBriefsList,
				create: mockBriefCreate,
				get: mockBriefGet,
				matches: mockBriefMatches
			}
		}
	});

	collection = await import('./+server');
	detail = await import('./[id]/+server');
	matches = await import('./[id]/matches/+server');
});

describe('/v1/procurement/briefs collection route', () => {
	it('proxies the list with the caller credential and relays the response', async () => {
		const response = await collection.GET(makeEvent('https://app.test/v1/procurement/briefs'));

		expect(mockCreateParchmentServerClient).toHaveBeenCalledWith(expect.anything(), {
			mode: 'session'
		});
		expect(mockBriefsList).toHaveBeenCalledTimes(1);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			data: [{ id: 'brief-id', name: 'Kenya AA' }],
			meta: {}
		});
	});

	it('advertises deprecation/sunset migration headers pointing at the canonical Parchment surface', async () => {
		const response = await collection.GET(makeEvent('https://app.test/v1/procurement/briefs'));

		expect(response.headers.get('Deprecation')).toBe('true');
		expect(response.headers.get('Link')).toBe(
			'<https://api.purveyors.io/v1/procurement/briefs>; rel="successor-version"'
		);
		expect(response.headers.get('Sunset')).toBe('Thu, 31 Dec 2026 23:59:59 GMT');
	});

	it('forwards the JSON request body to Parchment on create and relays the 201', async () => {
		const body = { name: 'Kenya AA', criteria: { country: 'Kenya' } };
		const response = await collection.POST(
			makeEvent('https://app.test/v1/procurement/briefs', {
				method: 'POST',
				body: JSON.stringify(body),
				headers: { 'content-type': 'application/json' }
			})
		);

		expect(mockBriefCreate).toHaveBeenCalledWith(body);
		expect(response.status).toBe(201);
		expect(await response.json()).toEqual({ data: { id: 'brief-id', name: 'Kenya AA' }, meta: {} });
	});

	it('returns a 400 without calling Parchment when the create body is not valid JSON', async () => {
		const response = await collection.POST(
			makeEvent('https://app.test/v1/procurement/briefs', {
				method: 'POST',
				body: 'not json{',
				headers: { 'content-type': 'application/json' }
			})
		);

		expect(mockBriefCreate).not.toHaveBeenCalled();
		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: 'Invalid request',
			message: 'Request body must be valid JSON'
		});
		// Migration headers are still advertised on the error path.
		expect(response.headers.get('Deprecation')).toBe('true');
	});

	it('relays upstream validation/entitlement errors verbatim on create', async () => {
		mockBriefCreate.mockResolvedValue({
			error: { error: 'Invalid criteria', message: 'unsupported field' },
			response: new Response(null, { status: 400 })
		});

		const response = await collection.POST(
			makeEvent('https://app.test/v1/procurement/briefs', {
				method: 'POST',
				body: JSON.stringify({ name: 'x', criteria: { nope: true } }),
				headers: { 'content-type': 'application/json' }
			})
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: 'Invalid criteria',
			message: 'unsupported field'
		});
	});

	it('relays a 402/403 entitlement response from Parchment verbatim on create', async () => {
		mockBriefCreate.mockResolvedValue({
			error: { error: 'Insufficient permissions', message: 'member plan required' },
			response: new Response(null, { status: 403 })
		});

		const response = await collection.POST(
			makeEvent('https://app.test/v1/procurement/briefs', {
				method: 'POST',
				body: JSON.stringify({ name: 'x', criteria: {} }),
				headers: { 'content-type': 'application/json' }
			})
		);

		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({
			error: 'Insufficient permissions',
			message: 'member plan required'
		});
	});

	it('rejects a present-but-invalid Authorization header with a 401 before proxying', async () => {
		mockResolvePrincipal.mockResolvedValue({ isAuthenticated: false });

		const response = await collection.GET(
			makeEvent('https://app.test/v1/procurement/briefs', {
				headers: { Authorization: 'Bearer expired' }
			})
		);

		expect(mockCreateParchmentServerClient).not.toHaveBeenCalled();
		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({
			error: 'Authentication required',
			message: 'Authentication required'
		});
	});

	it('returns a JSON 503 with migration headers when Parchment is unconfigured', async () => {
		const configError = new Error('PARCHMENT_API_BASE_URL is not configured');
		configError.name = 'ParchmentConfigError';
		mockCreateParchmentServerClient.mockRejectedValue(configError);

		const response = await collection.GET(makeEvent('https://app.test/v1/procurement/briefs'));

		expect(response.status).toBe(503);
		expect(response.headers.get('Deprecation')).toBe('true');
		expect(await response.json()).toEqual({
			error: 'Sourcing briefs unavailable',
			message: 'PARCHMENT_API_BASE_URL is not configured'
		});
	});

	it('returns a JSON 500 without leaking the error when the upstream fetch rejects', async () => {
		mockBriefsList.mockRejectedValue(new Error('network down'));

		const response = await collection.GET(makeEvent('https://app.test/v1/procurement/briefs'));

		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({
			error: 'Failed to serve sourcing brief request',
			message: 'Internal server error'
		});
	});

	it('relays upstream rate-limit headers', async () => {
		mockBriefsList.mockResolvedValue({
			data: { data: [], meta: {} },
			response: new Response(null, {
				status: 200,
				headers: { 'X-RateLimit-Remaining': '24' }
			})
		});

		const response = await collection.GET(makeEvent('https://app.test/v1/procurement/briefs'));

		expect(response.headers.get('X-RateLimit-Remaining')).toBe('24');
	});
});

describe('/v1/procurement/briefs/[id] detail route', () => {
	it('proxies the brief id with the caller credential and relays the response', async () => {
		const response = await detail.GET(makeEvent('https://app.test/v1/procurement/briefs/brief-id'));

		expect(mockBriefGet).toHaveBeenCalledWith('brief-id');
		expect(response.status).toBe(200);
		expect(response.headers.get('Link')).toBe(
			'<https://api.purveyors.io/v1/procurement/briefs/brief-id>; rel="successor-version"'
		);
	});

	it('relays a 404 for a brief the caller does not own', async () => {
		mockBriefGet.mockResolvedValue({
			error: { error: 'Not found', message: 'Sourcing brief not found' },
			response: new Response(null, { status: 404 })
		});

		const response = await detail.GET(makeEvent('https://app.test/v1/procurement/briefs/brief-id'));

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({
			error: 'Not found',
			message: 'Sourcing brief not found'
		});
	});
});

describe('/v1/procurement/briefs/[id]/matches route', () => {
	it('forwards page/limit pagination to Parchment and relays the response', async () => {
		const response = await matches.GET(
			makeEvent('https://app.test/v1/procurement/briefs/brief-id/matches?page=2&limit=10')
		);

		expect(mockBriefMatches).toHaveBeenCalledWith('brief-id', { page: 2, limit: 10 });
		expect(response.status).toBe(200);
		expect(response.headers.get('Link')).toBe(
			'<https://api.purveyors.io/v1/procurement/briefs/brief-id/matches>; rel="successor-version"'
		);
	});

	it('forwards non-numeric pagination values as-is so Parchment validates them', async () => {
		await matches.GET(
			makeEvent('https://app.test/v1/procurement/briefs/brief-id/matches?page=abc')
		);

		expect(mockBriefMatches).toHaveBeenCalledWith('brief-id', { page: 'abc' });
	});
});
