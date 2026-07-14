import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateParchmentServerClient = vi.fn();
const mockInspect = vi.fn();
const mockApprove = vi.fn();
const mockSignOut = vi.fn();

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
		cookies: {
			get: vi.fn(),
			set: vi.fn(),
			delete: vi.fn()
		},
		locals: {
			safeGetSession: vi.fn().mockResolvedValue(authenticated ? AUTHED : UNAUTHED),
			supabase: { auth: { signOut: mockSignOut } }
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

function makeActionLoadEvent(action = '/approve', requestToken = TOKEN, authenticated = true) {
	const event = makeEvent({ authenticated, requestToken: null });
	event.url.search = `?${action}`;
	event.cookies.get.mockReturnValue(requestToken);
	return event;
}

function makeReauthenticateActionEvent(authenticated = true) {
	const event = makeEvent({ authenticated, requestToken: null });
	event.cookies.get.mockReturnValue(TOKEN);
	event.request = new Request('https://purveyors.io/auth/cli?/reauthenticate', {
		method: 'POST'
	});
	return event;
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
	mockSignOut.mockResolvedValue({ error: null });
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
		const event = makeEvent({ authenticated: false });
		await expect(route.load(event as never)).rejects.toMatchObject({
			status: 303,
			location: `/auth?next=${encodeURIComponent('/auth/cli')}`
		});
		expect(event.cookies.set).toHaveBeenCalledWith('purveyors_cli_auth_request', TOKEN, {
			httpOnly: true,
			maxAge: 600,
			path: '/auth/cli',
			sameSite: 'lax',
			secure: true
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

	it('keeps the request cookie and retryable copy for rate-limited inspection', async () => {
		const event = makeEvent({ requestToken: null });
		event.cookies.get.mockReturnValue(TOKEN);
		mockInspect.mockResolvedValueOnce({
			error: { error: { code: 'rate_limited', message: 'sensitive upstream detail' } },
			response: new Response(null, { status: 429 })
		});

		const result = await route.load(event as never);

		expect(result).toEqual({
			request: null,
			failure: {
				title: 'CLI sign-in is temporarily unavailable',
				message: 'Purveyors could not verify this request right now. Please try again shortly.'
			}
		});
		expect(event.cookies.delete).not.toHaveBeenCalled();
		expect(JSON.stringify(result)).not.toContain('sensitive upstream detail');
	});

	it('reads the request token from the server-only cookie after login', async () => {
		const event = makeEvent({ requestToken: null });
		event.cookies.get.mockReturnValue(TOKEN);

		const result = await route.load(event as never);

		expect(mockInspect).toHaveBeenCalledWith({ requestToken: TOKEN });
		expect(result).toMatchObject({ requestToken: TOKEN, request: { machineName: 'roaster-host' } });
		expect(event.cookies.delete).toHaveBeenCalledWith('purveyors_cli_auth_request', {
			path: '/auth/cli'
		});
	});

	it('keeps the cookie when cookie-backed inspection is temporarily unavailable', async () => {
		const event = makeEvent({ requestToken: null });
		event.cookies.get.mockReturnValue(TOKEN);
		mockInspect.mockResolvedValueOnce({
			error: { error: { code: 'internal_error', message: 'sensitive upstream detail' } },
			response: new Response(null, { status: 503 })
		});

		const result = await route.load(event as never);

		expect(result).toMatchObject({
			request: null,
			failure: { title: 'CLI sign-in is temporarily unavailable' }
		});
		expect(event.cookies.delete).not.toHaveBeenCalled();
	});

	it('keeps the request cookie during the load that follows a retryable approval failure', async () => {
		const event = makeActionLoadEvent();

		const result = await route.load(event as never);

		expect(result).toMatchObject({ requestToken: TOKEN, request: { machineName: 'roaster-host' } });
		expect(event.cookies.delete).not.toHaveBeenCalled();
	});

	it('keeps the request cookie during the load that follows a reauthentication failure', async () => {
		const event = makeActionLoadEvent('/reauthenticate');

		const result = await route.load(event as never);

		expect(result).toMatchObject({ requestToken: TOKEN, request: { machineName: 'roaster-host' } });
		expect(event.cookies.delete).not.toHaveBeenCalled();
	});
});

describe('reauthenticate action', () => {
	it('requires the CLI request cookie and signs out through an explicit POST action', async () => {
		const event = makeReauthenticateActionEvent();

		await expect(route.actions.reauthenticate(event as never)).rejects.toMatchObject({
			status: 303,
			location: `/auth?next=${encodeURIComponent('/auth/cli')}`
		});
		expect(event.cookies.get).toHaveBeenCalledWith('purveyors_cli_auth_request');
		expect(mockSignOut).toHaveBeenCalledTimes(1);
		expect(event.cookies.delete).not.toHaveBeenCalledWith('purveyors_cli_auth_request', {
			path: '/auth/cli'
		});
	});

	it('does not sign out without the preserved CLI request cookie', async () => {
		const event = makeReauthenticateActionEvent();
		event.cookies.get.mockReturnValue(undefined);

		const result = await route.actions.reauthenticate(event as never);

		expect(result).toMatchObject({
			status: 400,
			data: { signedOut: false, terminal: true }
		});
		expect(mockSignOut).not.toHaveBeenCalled();
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
		const event = makeActionEvent(TOKEN, false);
		await expect(route.actions.approve(event as never)).rejects.toMatchObject({
			status: 303,
			location: `/auth?next=${encodeURIComponent('/auth/cli')}`
		});
		expect(event.cookies.set).toHaveBeenCalledWith('purveyors_cli_auth_request', TOKEN, {
			httpOnly: true,
			maxAge: 600,
			path: '/auth/cli',
			sameSite: 'lax',
			secure: true
		});
		expect(mockApprove).not.toHaveBeenCalled();
	});

	it('stores the request server-side when the approval session expires', async () => {
		mockApprove.mockResolvedValueOnce({
			error: { error: { code: 'session_expired', message: 'sensitive detail' } },
			response: new Response(null, { status: 401 })
		});
		const event = makeActionEvent();

		const result = await route.actions.approve(event as never);

		expect(result).toMatchObject({
			status: 401,
			data: { approved: false, signedOut: true, terminal: false }
		});
		expect(event.cookies.set).toHaveBeenCalledWith('purveyors_cli_auth_request', TOKEN, {
			httpOnly: true,
			maxAge: 600,
			path: '/auth/cli',
			sameSite: 'lax',
			secure: true
		});
	});

	it('stores the request server-side for transient approval failures', async () => {
		mockApprove.mockResolvedValueOnce({
			error: { error: { code: 'internal_error', message: 'sensitive detail' } },
			response: new Response(null, { status: 503 })
		});
		const event = makeActionEvent();

		const result = await route.actions.approve(event as never);

		expect(result).toMatchObject({
			status: 503,
			data: { approved: false, signedOut: false, terminal: false }
		});
		expect(event.cookies.set).toHaveBeenCalledWith('purveyors_cli_auth_request', TOKEN, {
			httpOnly: true,
			maxAge: 600,
			path: '/auth/cli',
			sameSite: 'lax',
			secure: true
		});
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
