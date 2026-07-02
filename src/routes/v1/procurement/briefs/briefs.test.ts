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

// Fully mock the principal module (mirrors the catalog proxy test) to avoid its
// transitive Supabase-admin load. isSessionPrincipal / isTrustedMutationRequest are
// reimplemented faithfully here so the CSRF guard's origin logic is still exercised
// end-to-end; only resolvePrincipal is a spy.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
vi.mock('$lib/server/principal', () => ({
	resolvePrincipal: mockResolvePrincipal,
	isSessionPrincipal: (principal: { authKind?: string }) => principal?.authKind === 'session',
	isTrustedMutationRequest: (
		event: { url: URL; request: Request },
		principal: { authKind?: string }
	) => {
		const isSession = principal?.authKind === 'session';
		if (!isSession || SAFE_METHODS.has(event.request.method.toUpperCase())) {
			return true;
		}
		const origin = event.request.headers.get('origin');
		if (!origin) return true;
		return origin === event.url.origin;
	}
}));

let collection: typeof import('./+server');
let detail: typeof import('./[id]/+server');
let matches: typeof import('./[id]/matches/+server');

const ANONYMOUS = { authKind: 'anonymous', isAuthenticated: false } as never;
const SESSION_MEMBER = { authKind: 'session', isAuthenticated: true } as never;

// Build a lightweight request object rather than `new Request`: the WHATWG Request
// header guard silently strips forbidden headers like `Origin`, which the CSRF test
// must set. A directly-constructed Headers uses the "none" guard and keeps it.
function makeEvent(url: string, init?: RequestInit, id = 'brief-id') {
	const headers = new Headers((init?.headers as HeadersInit) ?? {});
	const body = init?.body;
	const request = {
		method: (init?.method ?? 'GET').toUpperCase(),
		headers,
		json: async () => JSON.parse(typeof body === 'string' ? body : String(body))
	};
	return {
		url: new URL(url),
		request,
		params: { id },
		fetch: vi.fn(),
		locals: {}
	} as never;
}

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();

	mockResolvePrincipal.mockResolvedValue(ANONYMOUS);

	mockBriefsList.mockResolvedValue({
		data: { data: [{ id: 'b1' }], meta: {} },
		response: new Response(null, { status: 200 })
	});
	mockBriefCreate.mockResolvedValue({
		data: { data: { id: 'b1' }, meta: {} },
		response: new Response(null, { status: 201 })
	});
	mockBriefGet.mockResolvedValue({
		data: { data: { id: 'b1' }, meta: {} },
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

describe('GET /v1/procurement/briefs', () => {
	it('forwards the caller credential to Parchment and relays the body + rate-limit headers', async () => {
		mockBriefsList.mockResolvedValue({
			data: { data: [{ id: 'b1' }], meta: {} },
			response: new Response(null, { status: 200, headers: { 'X-RateLimit-Remaining': '24' } })
		});

		const response = await collection.GET(makeEvent('https://app.test/v1/procurement/briefs'));

		expect(mockCreateParchmentServerClient).toHaveBeenCalledWith(expect.anything(), {
			mode: 'session',
			preferHandling: 'inherit'
		});
		expect(mockBriefsList).toHaveBeenCalledTimes(1);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ data: [{ id: 'b1' }], meta: {} });
		expect(response.headers.get('X-RateLimit-Remaining')).toBe('24');
	});

	it('relays upstream error bodies and status codes verbatim', async () => {
		mockBriefsList.mockResolvedValue({
			error: { error: 'Insufficient permissions', message: 'member plan required' },
			response: new Response(null, { status: 403 })
		});

		const response = await collection.GET(makeEvent('https://app.test/v1/procurement/briefs'));

		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({
			error: 'Insufficient permissions',
			message: 'member plan required'
		});
	});

	it('rejects a present-but-invalid Authorization header with 401 before proxying', async () => {
		const response = await collection.GET(
			makeEvent('https://app.test/v1/procurement/briefs', {
				headers: { Authorization: 'Bearer nope' }
			})
		);

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual(
			expect.objectContaining({ error: 'Authentication required' })
		);
		expect(mockCreateParchmentServerClient).not.toHaveBeenCalled();
		expect(mockBriefsList).not.toHaveBeenCalled();
	});

	it('returns a JSON 503 when Parchment is unconfigured', async () => {
		const configError = new Error('PARCHMENT_API_BASE_URL is not configured');
		configError.name = 'ParchmentConfigError';
		mockCreateParchmentServerClient.mockRejectedValue(configError);

		const response = await collection.GET(makeEvent('https://app.test/v1/procurement/briefs'));

		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({
			error: 'Procurement unavailable',
			message: 'PARCHMENT_API_BASE_URL is not configured'
		});
	});
});

describe('POST /v1/procurement/briefs', () => {
	function postEvent(body: string, init: RequestInit = {}) {
		return makeEvent('https://app.test/v1/procurement/briefs', {
			method: 'POST',
			headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
			body
		});
	}

	it('forwards the parsed body to Parchment and relays the 201 response', async () => {
		mockResolvePrincipal.mockResolvedValue(SESSION_MEMBER);
		const payload = { name: 'Ethiopia naturals', criteria: { country: 'Ethiopia' } };

		const response = await collection.POST(postEvent(JSON.stringify(payload)));

		expect(mockBriefCreate).toHaveBeenCalledWith(payload);
		expect(response.status).toBe(201);
		expect(await response.json()).toEqual({ data: { id: 'b1' }, meta: {} });
	});

	it('blocks a cross-site cookie-session POST with 403 BEFORE any proxy call', async () => {
		mockResolvePrincipal.mockResolvedValue(SESSION_MEMBER);

		const response = await collection.POST(
			postEvent(JSON.stringify({ name: 'x', criteria: {} }), {
				headers: { origin: 'https://evil.test' }
			})
		);

		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({
			error: 'Insufficient permissions',
			message: 'Cross-site session mutation blocked'
		});
		// The guard must run before the SDK is ever constructed or called.
		expect(mockCreateParchmentServerClient).not.toHaveBeenCalled();
		expect(mockBriefCreate).not.toHaveBeenCalled();
	});

	it('returns the historical 400 shape for an unparseable JSON body', async () => {
		mockResolvePrincipal.mockResolvedValue(SESSION_MEMBER);

		const response = await collection.POST(postEvent('not json{'));

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: 'Invalid request',
			message: 'request body must be valid JSON'
		});
		expect(mockBriefCreate).not.toHaveBeenCalled();
	});

	it('rejects a present-but-invalid Authorization header with 401 before the CSRF guard', async () => {
		const response = await collection.POST(
			postEvent(JSON.stringify({ name: 'x', criteria: {} }), {
				headers: { Authorization: 'Bearer nope' }
			})
		);

		expect(response.status).toBe(401);
		expect(mockBriefCreate).not.toHaveBeenCalled();
	});

	it('rejects an anonymous create with 401 before parsing the body, even when the body is malformed', async () => {
		// Anonymous default (beforeEach) + unparseable body. Auth is resolved before
		// the body is parsed, so a gated create yields the auth-first 401 rather than
		// leaking a body-validation 400. Guards the P2 auth-first contract regression.
		const response = await collection.POST(postEvent('not json{'));

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual(
			expect.objectContaining({ error: 'Authentication required' })
		);
		expect(mockCreateParchmentServerClient).not.toHaveBeenCalled();
		expect(mockBriefCreate).not.toHaveBeenCalled();
	});
});

describe('GET /v1/procurement/briefs/:id', () => {
	it('forwards the id to Parchment and relays the response', async () => {
		const response = await detail.GET(
			makeEvent('https://app.test/v1/procurement/briefs/b1', undefined, 'b1')
		);

		expect(mockBriefGet).toHaveBeenCalledWith('b1');
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ data: { id: 'b1' }, meta: {} });
	});

	it('relays an upstream 404 body verbatim', async () => {
		mockBriefGet.mockResolvedValue({
			error: { error: 'Not found', message: 'Sourcing brief not found' },
			response: new Response(null, { status: 404 })
		});

		const response = await detail.GET(
			makeEvent('https://app.test/v1/procurement/briefs/missing', undefined, 'missing')
		);

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({
			error: 'Not found',
			message: 'Sourcing brief not found'
		});
	});
});

describe('GET /v1/procurement/briefs/:id/matches', () => {
	it('forwards page/limit and the id to Parchment', async () => {
		const response = await matches.GET(
			makeEvent(
				'https://app.test/v1/procurement/briefs/b1/matches?page=2&limit=10',
				undefined,
				'b1'
			)
		);

		expect(mockBriefMatches).toHaveBeenCalledWith('b1', { page: 2, limit: 10 });
		expect(response.status).toBe(200);
	});

	it('omits absent paging params from the forwarded query', async () => {
		await matches.GET(
			makeEvent('https://app.test/v1/procurement/briefs/b1/matches', undefined, 'b1')
		);

		expect(mockBriefMatches).toHaveBeenCalledWith('b1', {});
	});
});
