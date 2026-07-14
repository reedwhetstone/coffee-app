import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateParchmentServerClient = vi.fn();
const mockInspect = vi.fn();
const mockApprove = vi.fn();

vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: mockCreateParchmentServerClient
}));

let route: typeof import('./+page.server');

const TOKEN = 'signed.request.token'.padEnd(80, 'x');
const AUTHED = {
	session: { access_token: 'session-token' },
	user: { id: 'user-1', email: 'user@example.com' }
};
const UNAUTHED = { session: null, user: null };

function makeEvent(options: { authenticated?: boolean; requestToken?: string | null } = {}) {
	const { authenticated = true, requestToken = TOKEN } = options;
	const url = new URL('https://purveyors.io/auth/cli');
	if (requestToken !== null) url.searchParams.set('request', requestToken);

	return {
		url,
		request: new Request(url, { method: 'GET' }),
		fetch: vi.fn(),
		setHeaders: vi.fn(),
		locals: {
			safeGetSession: vi.fn().mockResolvedValue(authenticated ? AUTHED : UNAUTHED)
		}
	};
}

function makeActionEvent(requestToken = TOKEN, authenticated = true) {
	const event = makeEvent({ authenticated, requestToken });
	const form = new FormData();
	form.set('request', requestToken);
	return {
		...event,
		request: new Request('https://purveyors.io/auth/cli?/approve', {
			method: 'POST',
			body: form
		})
	};
}

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();

	mockInspect.mockResolvedValue({
		data: {
			requestId: '11111111-1111-4111-8111-111111111111',
			machineName: 'roaster-host',
			expiresAt: '2026-07-14T03:00:00.000Z',
			scopes: ['catalog:read', 'inventory:read', 'inventory:write']
		},
		response: new Response(null, { status: 200 })
	});
	mockApprove.mockResolvedValue({
		data: {
			requestId: '11111111-1111-4111-8111-111111111111',
			approved: true
		},
		response: new Response(null, { status: 200 })
	});
	mockCreateParchmentServerClient.mockResolvedValue({
		cliAuth: { inspect: mockInspect, approve: mockApprove }
	});

	route = await import('./+page.server');
});

describe('load /auth/cli', () => {
	it('inspects the signed request server-side and exposes only consent-safe details', async () => {
		const event = makeEvent();
		const result = await route.load(event as never);

		expect(mockCreateParchmentServerClient).toHaveBeenCalledWith(event, { mode: 'anonymous' });
		expect(mockInspect).toHaveBeenCalledWith({ requestToken: TOKEN });
		expect(result).toEqual({
			requestToken: TOKEN,
			request: {
				machineName: 'roaster-host',
				expiresAt: '2026-07-14T03:00:00.000Z',
				scopes: ['catalog:read', 'inventory:read', 'inventory:write']
			},
			failure: null
		});
		expect(JSON.stringify(result)).not.toContain('apiKey');
		expect(event.setHeaders).toHaveBeenCalledWith({
			'cache-control': 'no-store',
			'referrer-policy': 'no-referrer',
			'content-security-policy': "frame-ancestors 'none'",
			'x-frame-options': 'DENY'
		});
	});

	it('sends an unauthenticated user through the existing login and preserves only this request', async () => {
		await expect(route.load(makeEvent({ authenticated: false }) as never)).rejects.toMatchObject({
			status: 303,
			location: `/auth?next=${encodeURIComponent(`/auth/cli?request=${encodeURIComponent(TOKEN)}`)}`
		});
		expect(mockInspect).toHaveBeenCalledWith({ requestToken: TOKEN });
	});

	it('renders a safe failure for a missing or invalid request without offering approval', async () => {
		const missing = await route.load(makeEvent({ requestToken: null }) as never);
		expect(missing).toMatchObject({
			request: null,
			failure: { title: 'Invalid sign-in request' }
		});

		mockInspect.mockResolvedValueOnce({
			error: { error: { code: 'request_expired', message: 'sensitive upstream detail' } },
			response: new Response(null, { status: 410 })
		});
		const expired = await route.load(makeEvent() as never);
		expect(expired).toEqual({
			request: null,
			failure: {
				title: 'Sign-in request expired',
				message: 'This request has expired or was already used. Start a new login from the CLI.'
			}
		});
		expect(JSON.stringify(expired)).not.toContain('sensitive upstream detail');
	});

	it('renders temporary-unavailability copy for any upstream 5xx inspection failure', async () => {
		mockInspect.mockResolvedValueOnce({
			error: { error: { code: 'internal_error', message: 'sensitive upstream detail' } },
			response: new Response(null, { status: 502 })
		});

		const result = await route.load(makeEvent() as never);
		expect(result).toEqual({
			request: null,
			failure: {
				title: 'CLI sign-in is temporarily unavailable',
				message: 'Purveyors could not verify this request right now. Please try again shortly.'
			}
		});
		expect(JSON.stringify(result)).not.toContain('sensitive upstream detail');
	});

	it('builds a same-origin return path without accepting an external next target', () => {
		const malicious = 'token?next=https://attacker.example';
		const next = route._buildCliAuthNextPath(malicious);

		expect(next).toBe(`/auth/cli?request=${encodeURIComponent(malicious)}`);
		expect(new URL(next, 'https://purveyors.io').origin).toBe('https://purveyors.io');
	});
});

describe('approve action', () => {
	it('requires an explicit POST action and forwards the current session to Parchment', async () => {
		const event = makeActionEvent();
		const result = await route.actions.approve(event as never);

		expect(mockCreateParchmentServerClient).toHaveBeenCalledWith(event, { mode: 'session' });
		expect(mockApprove).toHaveBeenCalledWith({ requestToken: TOKEN });
		expect(result).toEqual({ approved: true, signedOut: false, terminal: true });
		expect(JSON.stringify(result)).not.toContain('apiKey');
	});

	it('returns a signed-out approval safely to the same request after login', async () => {
		await expect(
			route.actions.approve(makeActionEvent(TOKEN, false) as never)
		).rejects.toMatchObject({
			status: 303,
			location: `/auth?next=${encodeURIComponent(`/auth/cli?request=${encodeURIComponent(TOKEN)}`)}`
		});
		expect(mockApprove).not.toHaveBeenCalled();
	});

	it('turns expired or already-invalid approval requests into terminal safe failures', async () => {
		mockApprove.mockResolvedValueOnce({
			error: { error: { code: 'request_consumed', message: 'sensitive detail' } },
			response: new Response(null, { status: 410 })
		});

		const result = await route.actions.approve(makeActionEvent() as never);
		expect(result).toMatchObject({
			status: 410,
			data: {
				approved: false,
				terminal: true,
				error: expect.stringContaining('no longer available')
			}
		});
		expect(JSON.stringify(result)).not.toContain('sensitive detail');
	});
});
