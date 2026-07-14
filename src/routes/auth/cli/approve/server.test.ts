import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateParchmentServerClient = vi.fn();
const mockApprove = vi.fn();

vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: mockCreateParchmentServerClient
}));

let POST: typeof import('./+server').POST;

const TOKEN = 'signed.request.token'.padEnd(80, 'x');
const AUTHED = {
	session: { access_token: 'session-token' },
	user: { id: 'user-1', email: 'user@example.com' }
};

function makeEvent(
	options: {
		authenticated?: boolean;
		bodyToken?: string;
		cookieToken?: string | null;
		contentType?: string;
	} = {}
) {
	const {
		authenticated = true,
		bodyToken = TOKEN,
		cookieToken = TOKEN,
		contentType = 'application/json'
	} = options;
	const url = new URL('https://www.purveyors.io/auth/cli/approve');
	return {
		url,
		request: new Request(url, {
			method: 'POST',
			headers: { 'content-type': contentType },
			body: JSON.stringify({ request: bodyToken })
		}),
		cookies: {
			get: vi.fn().mockReturnValue(cookieToken),
			set: vi.fn(),
			delete: vi.fn()
		},
		locals: {
			safeGetSession: vi
				.fn()
				.mockResolvedValue(authenticated ? AUTHED : { session: null, user: null })
		}
	};
}

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();
	mockApprove.mockResolvedValue({
		data: { requestId: '11111111-1111-4111-8111-111111111111', approved: true },
		response: new Response(null, { status: 200 })
	});
	mockCreateParchmentServerClient.mockResolvedValue({ cliAuth: { approve: mockApprove } });
	({ POST } = await import('./+server'));
});

describe('POST /auth/cli/approve', () => {
	it('approves an Origin-less JSON request bound to the HttpOnly request cookie', async () => {
		const event = makeEvent();
		expect(event.request.headers.get('origin')).toBeNull();

		const response = await POST(event as never);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual({ approved: true, signedOut: false, terminal: true });
		expect(mockCreateParchmentServerClient).toHaveBeenCalledWith(event, { mode: 'session' });
		expect(mockApprove).toHaveBeenCalledWith({ requestToken: TOKEN });
		expect(event.cookies.delete).toHaveBeenCalledWith('purveyors_cli_auth_request', {
			path: '/auth/cli'
		});
		expect(JSON.stringify(body)).not.toContain('apiKey');
	});

	it('rejects a missing or mismatched request cookie before session or Parchment access', async () => {
		for (const cookieToken of [null, 'different-request']) {
			const event = makeEvent({ cookieToken });
			const response = await POST(event as never);
			expect(response.status).toBe(403);
			expect(event.locals.safeGetSession).not.toHaveBeenCalled();
		}
		expect(mockCreateParchmentServerClient).not.toHaveBeenCalled();
	});

	it('requires non-simple JSON content so cross-site browsers must preflight', async () => {
		const event = makeEvent({ contentType: 'text/plain' });
		const response = await POST(event as never);

		expect(response.status).toBe(415);
		expect(event.locals.safeGetSession).not.toHaveBeenCalled();
		expect(mockCreateParchmentServerClient).not.toHaveBeenCalled();
	});

	it('preserves the request and directs an expired session back through login', async () => {
		const event = makeEvent({ authenticated: false });
		const response = await POST(event as never);
		const body = await response.json();

		expect(response.status).toBe(401);
		expect(body).toMatchObject({
			approved: false,
			signedOut: true,
			terminal: false,
			redirectTo: `/auth?next=${encodeURIComponent('/auth/cli')}`
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

	it('preserves the request on transient upstream failures', async () => {
		mockApprove.mockResolvedValueOnce({
			error: { error: { code: 'internal_error', message: 'sensitive detail' } },
			response: new Response(null, { status: 503 })
		});
		const event = makeEvent();
		const response = await POST(event as never);
		const body = await response.json();

		expect(response.status).toBe(503);
		expect(body).toMatchObject({ approved: false, signedOut: false, terminal: false });
		expect(event.cookies.set).toHaveBeenCalled();
		expect(JSON.stringify(body)).not.toContain('sensitive detail');
	});

	it('clears the binding and returns a safe terminal failure for consumed requests', async () => {
		mockApprove.mockResolvedValueOnce({
			error: { error: { code: 'request_consumed', message: 'sensitive detail' } },
			response: new Response(null, { status: 410 })
		});
		const event = makeEvent();
		const response = await POST(event as never);
		const body = await response.json();

		expect(response.status).toBe(410);
		expect(body).toMatchObject({ approved: false, terminal: true });
		expect(event.cookies.delete).toHaveBeenCalled();
		expect(JSON.stringify(body)).not.toContain('sensitive detail');
	});
});
