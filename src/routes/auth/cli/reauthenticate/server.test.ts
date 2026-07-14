import { beforeEach, describe, expect, it, vi } from 'vitest';

let POST: typeof import('./+server').POST;

const TOKEN = 'signed.request.token'.padEnd(80, 'x');
const AUTHED = {
	session: { access_token: 'session-token' },
	user: { id: 'user-1', email: 'user@example.com' }
};

function makeEvent(options: { authenticated?: boolean; cookieToken?: string | null } = {}) {
	const { authenticated = true, cookieToken = TOKEN } = options;
	const url = new URL('https://www.purveyors.io/auth/cli/reauthenticate');
	return {
		url,
		request: new Request(url, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: '{}'
		}),
		cookies: { get: vi.fn().mockReturnValue(cookieToken) },
		locals: {
			safeGetSession: vi
				.fn()
				.mockResolvedValue(authenticated ? AUTHED : { session: null, user: null }),
			supabase: { auth: { signOut: vi.fn().mockResolvedValue({ error: null }) } }
		}
	};
}

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();
	({ POST } = await import('./+server'));
});

describe('POST /auth/cli/reauthenticate', () => {
	it('requires the request-bound cookie before signing out', async () => {
		const event = makeEvent({ cookieToken: null });
		const response = await POST(event as never);

		expect(response.status).toBe(403);
		expect(event.locals.safeGetSession).not.toHaveBeenCalled();
		expect(event.locals.supabase.auth.signOut).not.toHaveBeenCalled();
	});

	it('signs out an active session and returns the preserved login destination', async () => {
		const event = makeEvent();
		const response = await POST(event as never);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(event.locals.supabase.auth.signOut).toHaveBeenCalledTimes(1);
		expect(body).toEqual({ redirectTo: `/auth?next=${encodeURIComponent('/auth/cli')}` });
	});

	it('returns directly to login when the local session is already absent', async () => {
		const event = makeEvent({ authenticated: false });
		const response = await POST(event as never);

		expect(response.status).toBe(200);
		expect(event.locals.supabase.auth.signOut).not.toHaveBeenCalled();
	});
});
