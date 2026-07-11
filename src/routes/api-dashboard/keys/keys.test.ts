import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Route tests for the API-key dashboard surfaces after the #40 repoint.
 *
 * The dashboard no longer mints/lists/revokes keys locally — it forwards the
 * caller's session credential to Parchment via the SDK. These tests mock
 * `createParchmentServerClient` (mirroring the catalog/procurement proxy tests)
 * and assert: the session guard still blocks unauthenticated callers, the SDK is
 * called with `mode: 'session'`, the raw key is relayed once on create, list rows
 * are mapped to the snake_case shape the page renders, and deactivate calls
 * `revoke(id)`.
 */

const mockCreateParchmentServerClient = vi.fn();
const mockApiKeysList = vi.fn();
const mockApiKeysCreate = vi.fn();
const mockApiKeysRevoke = vi.fn();

vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: mockCreateParchmentServerClient
}));

let generate: typeof import('./generate/+server');
let deactivate: typeof import('./deactivate/+server');
let page: typeof import('./+page.server');

const AUTHED = {
	session: { access_token: 'tok' },
	user: { id: 'user-1', email: 'user@test.dev' }
};
const UNAUTHED = { session: null, user: null };

function makeEvent(init: { method?: string; body?: unknown; session?: unknown } = {}) {
	const { method = 'POST', body, session = AUTHED } = init;
	const request = {
		method,
		headers: new Headers({ 'content-type': 'application/json' }),
		json: async () => body
	};
	return {
		url: new URL('https://app.test/api-dashboard/keys'),
		request,
		fetch: vi.fn(),
		locals: {
			safeGetSession: vi.fn().mockResolvedValue(session)
		}
	} as never;
}

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();

	mockApiKeysList.mockResolvedValue({
		data: {
			data: [
				{
					id: 'key-1',
					name: 'Prod',
					createdAt: '2026-01-01T00:00:00Z',
					lastUsedAt: '2026-02-01T00:00:00Z',
					isActive: true,
					scopes: ['catalog:read']
				}
			]
		},
		response: new Response(null, { status: 200 })
	});
	mockApiKeysCreate.mockResolvedValue({
		data: {
			apiKey: 'pk_live_rawsecret',
			key: {
				id: 'key-2',
				name: 'New',
				createdAt: '2026-03-01T00:00:00Z',
				lastUsedAt: null,
				isActive: true,
				scopes: ['catalog:read']
			}
		},
		response: new Response(null, { status: 201 })
	});
	mockApiKeysRevoke.mockResolvedValue({
		data: {
			key: {
				id: 'key-1',
				name: 'Prod',
				createdAt: '2026-01-01T00:00:00Z',
				lastUsedAt: null,
				isActive: false,
				scopes: ['catalog:read']
			}
		},
		response: new Response(null, { status: 200 })
	});

	mockCreateParchmentServerClient.mockResolvedValue({
		apiKeys: {
			list: mockApiKeysList,
			create: mockApiKeysCreate,
			revoke: mockApiKeysRevoke
		}
	});

	generate = await import('./generate/+server');
	deactivate = await import('./deactivate/+server');
	page = await import('./+page.server');
});

describe('POST /api-dashboard/keys/generate', () => {
	it('forwards the name to Parchment and relays the raw key exactly once', async () => {
		const response = await generate.POST(makeEvent({ body: { name: '  Prod  ' } }));

		expect(mockCreateParchmentServerClient).toHaveBeenCalledWith(expect.anything(), {
			mode: 'session'
		});
		// trimmed name forwarded
		expect(mockApiKeysCreate).toHaveBeenCalledWith({ name: 'Prod' });
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			success: true,
			apiKey: 'pk_live_rawsecret',
			message: 'API key created successfully'
		});
	});

	it('rejects an unauthenticated caller with 401 before touching Parchment', async () => {
		const response = await generate.POST(makeEvent({ body: { name: 'x' }, session: UNAUTHED }));

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual(
			expect.objectContaining({ success: false, error: 'Authentication required' })
		);
		expect(mockCreateParchmentServerClient).not.toHaveBeenCalled();
		expect(mockApiKeysCreate).not.toHaveBeenCalled();
	});

	it('rejects a missing/blank name with 400 before touching Parchment', async () => {
		const response = await generate.POST(makeEvent({ body: { name: '   ' } }));

		expect(response.status).toBe(400);
		expect(mockApiKeysCreate).not.toHaveBeenCalled();
	});

	it('relays Parchment error status and message', async () => {
		mockApiKeysCreate.mockResolvedValue({
			error: { error: { code: 'forbidden', message: 'API key plan required' } },
			response: new Response(null, { status: 403 })
		});

		const response = await generate.POST(makeEvent({ body: { name: 'x' } }));

		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({
			success: false,
			error: 'API key plan required'
		});
	});
});

describe('load /api-dashboard/keys', () => {
	it('maps Parchment rows onto the snake_case shape the page renders', async () => {
		const result = await page.load(makeEvent({ method: 'GET' }));

		expect(mockCreateParchmentServerClient).toHaveBeenCalledWith(expect.anything(), {
			mode: 'session'
		});
		expect(result).toEqual({
			apiKeys: [
				{
					id: 'key-1',
					name: 'Prod',
					is_active: true,
					created_at: '2026-01-01T00:00:00Z',
					last_used_at: '2026-02-01T00:00:00Z'
				}
			],
			user: { id: 'user-1', email: 'user@test.dev' }
		});
	});

	it('redirects an unauthenticated caller', async () => {
		await expect(page.load(makeEvent({ method: 'GET', session: UNAUTHED }))).rejects.toMatchObject({
			status: 303,
			location: '/'
		});
		expect(mockCreateParchmentServerClient).not.toHaveBeenCalled();
	});

	it('returns an empty list with an error message when Parchment fails', async () => {
		mockApiKeysList.mockResolvedValue({
			error: { error: { code: 'unavailable', message: 'down' } },
			response: new Response(null, { status: 503 })
		});

		const result = await page.load(makeEvent({ method: 'GET' }));

		expect(result).toEqual({ apiKeys: [], error: 'Failed to load API keys' });
	});

	it('returns the error state instead of a 500 when the Parchment client throws', async () => {
		// e.g. PARCHMENT_API_BASE_URL unset / SDK fetch rejects in preview or degraded upstream.
		mockCreateParchmentServerClient.mockRejectedValueOnce(
			new Error('PARCHMENT_API_BASE_URL is not set')
		);

		const result = await page.load(makeEvent({ method: 'GET' }));

		expect(result).toEqual({ apiKeys: [], error: 'Failed to load API keys' });
	});

	it('returns the error state when the list call rejects', async () => {
		mockApiKeysList.mockRejectedValueOnce(new Error('network down'));

		const result = await page.load(makeEvent({ method: 'GET' }));

		expect(result).toEqual({ apiKeys: [], error: 'Failed to load API keys' });
	});
});

describe('POST /api-dashboard/keys/deactivate', () => {
	it('calls revoke(id) for the requested key', async () => {
		const response = await deactivate.POST(makeEvent({ body: { keyId: 'key-1' } }));

		expect(mockApiKeysRevoke).toHaveBeenCalledWith('key-1');
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual(
			expect.objectContaining({ success: true, message: 'API key deactivated successfully' })
		);
	});

	it('rejects an unauthenticated caller with 401 before touching Parchment', async () => {
		const response = await deactivate.POST(
			makeEvent({ body: { keyId: 'key-1' }, session: UNAUTHED })
		);

		expect(response.status).toBe(401);
		expect(mockCreateParchmentServerClient).not.toHaveBeenCalled();
		expect(mockApiKeysRevoke).not.toHaveBeenCalled();
	});

	it('rejects a missing keyId with 400 before touching Parchment', async () => {
		const response = await deactivate.POST(makeEvent({ body: {} }));

		expect(response.status).toBe(400);
		expect(mockApiKeysRevoke).not.toHaveBeenCalled();
	});

	it('relays Parchment error status and message', async () => {
		mockApiKeysRevoke.mockResolvedValue({
			error: { error: { code: 'not_found', message: 'Key not found' } },
			response: new Response(null, { status: 404 })
		});

		const response = await deactivate.POST(makeEvent({ body: { keyId: 'nope' } }));

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ success: false, error: 'Key not found' });
	});
});
