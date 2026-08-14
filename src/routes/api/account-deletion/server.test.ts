import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	class ParchmentConfigError extends Error {}
	return {
		request: vi.fn(),
		createParchmentServerClient: vi.fn(),
		ParchmentConfigError
	};
});

vi.mock('$lib/server/parchmentClient', () => ({
	ParchmentConfigError: mocks.ParchmentConfigError,
	createParchmentServerClient: mocks.createParchmentServerClient
}));

import { POST } from './+server';

const operation = {
	operationId: '9dc525f2-b855-4af1-9908-661f030e716c',
	status: 'accepted'
};

function makeEvent(
	options: {
		origin?: string | null;
		authorization?: string;
		contentType?: string;
		body?: unknown;
		authenticated?: boolean;
		assertion?: string;
	} = {}
) {
	const origin = options.origin === undefined ? 'https://app.test' : options.origin;
	const headers = new Map<string, string>();
	if (origin !== null) headers.set('origin', origin);
	if (options.authorization) headers.set('authorization', options.authorization);
	headers.set('content-type', options.contentType ?? 'application/json');

	return {
		request: {
			headers: { get: (name: string) => headers.get(name.toLowerCase()) ?? null },
			json: vi.fn().mockResolvedValue(options.body ?? { confirmation: 'DELETE MY ACCOUNT' })
		},
		url: new URL('https://app.test/api/account-deletion'),
		cookies: {
			get: vi.fn(() => options.assertion ?? 'signed-assertion'),
			set: vi.fn(),
			delete: vi.fn()
		},
		locals: {
			principal:
				options.authenticated === false
					? { authKind: 'anonymous', source: 'none', session: null, user: null }
					: {
							authKind: 'session',
							source: 'cookie-session',
							session: { access_token: 'session-token' },
							user: { id: 'user-1', email: 'owner@example.com' }
						}
		},
		fetch: vi.fn()
	} as never;
}

function upstreamError(status: number, code: string) {
	return {
		error: { error: { code, message: `${code} message` } },
		response: new Response(null, { status })
	};
}

describe('POST /api/account-deletion', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.request.mockResolvedValue({
			data: operation,
			response: new Response(null, { status: 202 })
		});
		mocks.createParchmentServerClient.mockResolvedValue({
			accountDeletion: { request: mocks.request }
		});
	});

	it('forwards exactly the signed assertion and clears it after first acceptance', async () => {
		const event = makeEvent() as unknown as {
			cookies: { set: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
		};

		const result = await POST(event as never);

		expect(result.status).toBe(202);
		expect(result.headers.get('cache-control')).toBe('no-store');
		expect(await result.json()).toEqual(operation);
		expect(mocks.createParchmentServerClient).toHaveBeenCalledWith(expect.anything(), {
			mode: 'session',
			preferHandling: 'inherit'
		});
		expect(mocks.request).toHaveBeenCalledWith({ assertion: 'signed-assertion' });
		expect(event.cookies.delete).toHaveBeenCalledWith('account_deletion_reauthenticated', {
			path: '/api/account-deletion'
		});
		expect(event.cookies.set).not.toHaveBeenCalled();
	});

	it('accepts a durable 200 replay and clears the assertion', async () => {
		mocks.request.mockResolvedValue({
			data: { ...operation, status: 'completed' },
			response: new Response(null, { status: 200 })
		});
		const event = makeEvent() as unknown as {
			cookies: { delete: ReturnType<typeof vi.fn> };
		};

		const result = await POST(event as never);

		expect(result.status).toBe(200);
		expect(event.cookies.delete).toHaveBeenCalledOnce();
	});

	it.each([
		[400, 'invalid_request'],
		[401, 'session_required']
	])('clears an unusable assertion after upstream %i', async (status, code) => {
		mocks.request.mockResolvedValue(upstreamError(status, code));
		const event = makeEvent() as unknown as {
			cookies: { delete: ReturnType<typeof vi.fn> };
		};

		const result = await POST(event as never);

		expect(result.status).toBe(status);
		expect((await result.json()).error.code).toBe(code);
		expect(event.cookies.delete).toHaveBeenCalledOnce();
	});

	it('clears an invalid assertion and maps upstream 403 to reauthentication', async () => {
		mocks.request.mockResolvedValue(upstreamError(403, 'invalid_reauthentication'));
		const event = makeEvent() as unknown as {
			cookies: { delete: ReturnType<typeof vi.fn> };
		};

		const result = await POST(event as never);

		expect(result.status).toBe(403);
		expect((await result.json()).error.code).toBe('recent_sign_in_required');
		expect(event.cookies.delete).toHaveBeenCalledOnce();
	});

	it.each([
		[409, 'lifecycle_conflict'],
		[503, 'deletion_unavailable']
	])('retains the assertion after retryable upstream %i', async (status, code) => {
		mocks.request.mockResolvedValue(upstreamError(status, code));
		const event = makeEvent() as unknown as {
			cookies: { delete: ReturnType<typeof vi.fn> };
		};

		const result = await POST(event as never);

		expect(result.status).toBe(status);
		expect(event.cookies.delete).not.toHaveBeenCalled();
	});

	it('retains the assertion after transport failure', async () => {
		const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		mocks.request.mockRejectedValue(new Error('user-1 private assertion'));
		const event = makeEvent() as unknown as {
			cookies: { delete: ReturnType<typeof vi.fn> };
		};

		const result = await POST(event as never);

		expect(result.status).toBe(502);
		expect(event.cookies.delete).not.toHaveBeenCalled();
		expect(errorLog).toHaveBeenCalledWith('Account deletion request failed');
		expect(JSON.stringify(errorLog.mock.calls)).not.toContain('user-1');
		expect(JSON.stringify(errorLog.mock.calls)).not.toContain('private assertion');
		errorLog.mockRestore();
	});

	it.each([
		[{ status: 'accepted' }, 202],
		[operation, 201]
	])('retains the assertion for a malformed success contract', async (data, status) => {
		mocks.request.mockResolvedValue({ data, response: new Response(null, { status }) });
		const event = makeEvent() as unknown as {
			cookies: { delete: ReturnType<typeof vi.fn> };
		};

		const result = await POST(event as never);

		expect(result.status).toBe(502);
		expect((await result.json()).error.code).toBe('invalid_deletion_contract');
		expect(event.cookies.delete).not.toHaveBeenCalled();
	});

	it('requires a signed assertion from recent Google reauthentication', async () => {
		const event = makeEvent({ assertion: '' });
		const result = await POST(event);
		expect(result.status).toBe(403);
		expect((await result.json()).error.code).toBe('recent_sign_in_required');
		expect(mocks.request).not.toHaveBeenCalled();
	});

	it('requires a cookie session, exact confirmation, JSON, and same-origin request', async () => {
		expect((await POST(makeEvent({ authenticated: false }))).status).toBe(401);
		expect((await POST(makeEvent({ authorization: 'Bearer api-key' }))).status).toBe(401);
		expect((await POST(makeEvent({ origin: null }))).status).toBe(403);
		expect((await POST(makeEvent({ origin: 'https://evil.test' }))).status).toBe(403);
		expect((await POST(makeEvent({ contentType: 'text/plain' }))).status).toBe(415);
		expect((await POST(makeEvent({ body: { confirmation: 'delete my account' } }))).status).toBe(
			400
		);
	});

	it('retains the assertion when Parchment client configuration is unavailable', async () => {
		mocks.createParchmentServerClient.mockRejectedValue(new mocks.ParchmentConfigError('missing'));
		const event = makeEvent() as unknown as {
			cookies: { delete: ReturnType<typeof vi.fn> };
		};

		const result = await POST(event as never);

		expect(result.status).toBe(503);
		expect((await result.json()).error.code).toBe('deletion_unavailable');
		expect(event.cookies.delete).not.toHaveBeenCalled();
	});
});
