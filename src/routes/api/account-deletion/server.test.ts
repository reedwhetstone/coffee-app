import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	class AccountDeletionProviderError extends Error {}
	class ParchmentConfigError extends Error {}

	return {
		order: [] as string[],
		requestDeletion: vi.fn(),
		finalizeDeletion: vi.fn(),
		createParchmentServerClient: vi.fn(),
		captureStripeCustomerId: vi.fn(),
		unlinkStripeCustomer: vi.fn(),
		getProviderCredential: vi.fn(),
		readRetryOperation: vi.fn(),
		createRetryToken: vi.fn(),
		hasValidReauth: vi.fn(),
		createCompletionToken: vi.fn(),
		deleteUser: vi.fn(),
		AccountDeletionProviderError,
		ParchmentConfigError
	};
});

vi.mock('$lib/server/accountDeletion', () => ({
	ACCOUNT_DELETION_CONFIRMATION: 'DELETE MY ACCOUNT',
	ACCOUNT_DELETION_RETRY_COOKIE: 'account_deletion_operation',
	ACCOUNT_DELETION_RETRY_MAX_AGE_SECONDS: 86400,
	AccountDeletionProviderError: mocks.AccountDeletionProviderError,
	captureStripeCustomerId: mocks.captureStripeCustomerId,
	unlinkStripeCustomer: mocks.unlinkStripeCustomer,
	getAccountDeletionProviderCredential: mocks.getProviderCredential,
	readAccountDeletionRetryOperation: mocks.readRetryOperation,
	createAccountDeletionRetryToken: mocks.createRetryToken
}));

vi.mock('$lib/server/accountDeletionReauth', () => ({
	ACCOUNT_DELETION_COMPLETION_COOKIE: 'account_deletion_completed',
	ACCOUNT_DELETION_COMPLETION_MAX_AGE_SECONDS: 600,
	ACCOUNT_DELETION_REAUTH_COOKIE: 'account_deletion_reauthenticated',
	hasValidAccountDeletionReauth: mocks.hasValidReauth,
	createAccountDeletionCompletionToken: mocks.createCompletionToken
}));

vi.mock('$lib/server/parchmentClient', () => ({
	ParchmentConfigError: mocks.ParchmentConfigError,
	createParchmentServerClient: mocks.createParchmentServerClient
}));

vi.mock('$lib/supabase-admin', () => ({
	createAdminClient: () => ({
		auth: { admin: { deleteUser: mocks.deleteUser } }
	})
}));

import { POST } from './+server';

const operation = {
	operationId: '9dc525f2-b855-4af1-9908-661f030e716c',
	status: 'awaiting_provider_finalization'
};

function makeEvent(
	options: {
		origin?: string | null;
		authorization?: string;
		contentType?: string;
		body?: unknown;
		authenticated?: boolean;
		retryCookie?: string;
		reauthCookie?: string;
	} = {}
) {
	const origin = options.origin === undefined ? 'https://app.test' : options.origin;
	const headers = new Map<string, string>();
	if (origin !== null) headers.set('origin', origin);
	if (options.authorization) headers.set('authorization', options.authorization);
	headers.set('content-type', options.contentType ?? 'application/json');
	const body = options.body ?? { confirmation: 'DELETE MY ACCOUNT' };
	const cookieSet = vi.fn((name: string) => mocks.order.push(`set-cookie:${name}`));
	const cookieDelete = vi.fn((name: string) => mocks.order.push(`delete-cookie:${name}`));

	return {
		request: {
			headers: { get: (name: string) => headers.get(name.toLowerCase()) ?? null },
			json: vi.fn().mockResolvedValue(body)
		},
		url: new URL('https://app.test/api/account-deletion'),
		cookies: {
			get: vi.fn((name: string) =>
				name === 'account_deletion_operation' ? options.retryCookie : options.reauthCookie
			),
			set: cookieSet,
			delete: cookieDelete
		},
		locals: {
			principal:
				options.authenticated === false
					? { authKind: 'anonymous', source: 'none', session: null, user: null }
					: {
							authKind: 'session',
							source: 'cookie-session',
							session: { access_token: 'session-token' },
							user: {
								id: 'user-1',
								email: 'owner@example.com'
							}
						}
		},
		fetch: vi.fn()
	} as never;
}

describe('POST /api/account-deletion', () => {
	beforeEach(() => {
		mocks.order.length = 0;
		vi.clearAllMocks();
		mocks.getProviderCredential.mockImplementation(() => {
			mocks.order.push('credential');
			return 'provider-secret';
		});
		mocks.captureStripeCustomerId.mockImplementation(async () => {
			mocks.order.push('capture-stripe');
			return 'cus_123';
		});
		mocks.hasValidReauth.mockReturnValue(true);
		mocks.readRetryOperation.mockReturnValue(null);
		mocks.createRetryToken.mockReturnValue('signed-retry-token');
		mocks.createCompletionToken.mockReturnValue('signed-completion-token');
		mocks.requestDeletion.mockImplementation(async () => {
			mocks.order.push('request');
			return { data: operation, response: new Response(null, { status: 200 }) };
		});
		mocks.unlinkStripeCustomer.mockImplementation(async () => {
			mocks.order.push('unlink-stripe');
		});
		mocks.finalizeDeletion.mockImplementation(async () => {
			mocks.order.push('finalize');
			return {
				data: { ...operation, status: 'completed' },
				response: new Response(null, { status: 200 })
			};
		});
		mocks.deleteUser.mockImplementation(async () => {
			mocks.order.push('delete-auth');
			return { error: null };
		});
		mocks.createParchmentServerClient.mockResolvedValue({
			accountDeletion: { request: mocks.requestDeletion },
			raw: { POST: mocks.finalizeDeletion }
		});
	});

	it('runs the provider lifecycle in order and deletes Auth last for completed operations', async () => {
		const response = await POST(makeEvent());

		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(await response.json()).toEqual({
			operationId: operation.operationId,
			status: 'completed'
		});
		expect(mocks.order).toEqual([
			'credential',
			'capture-stripe',
			'request',
			'set-cookie:account_deletion_operation',
			'unlink-stripe',
			'finalize',
			'delete-auth',
			'set-cookie:account_deletion_completed',
			'delete-cookie:account_deletion_reauthenticated',
			'delete-cookie:account_deletion_operation'
		]);
		expect(mocks.createParchmentServerClient).toHaveBeenCalledWith(expect.anything(), {
			mode: 'session',
			preferHandling: 'inherit'
		});
		expect(mocks.finalizeDeletion).toHaveBeenCalledWith(
			'/v1/account-deletion/provider-finalization',
			{
				params: {
					header: {
						'x-account-deletion-provider-credential': 'provider-secret'
					}
				},
				body: { operationId: operation.operationId }
			}
		);
	});

	it('keeps Auth and the completion banner pending for nonterminal operations', async () => {
		mocks.finalizeDeletion.mockResolvedValue({
			data: { ...operation, status: 'ready' },
			response: new Response(null, { status: 200 })
		});

		const response = await POST(makeEvent());

		expect(response.status).toBe(202);
		expect(await response.json()).toEqual({
			operationId: operation.operationId,
			status: 'ready'
		});
		expect(mocks.finalizeDeletion).toHaveBeenCalled();
		expect(mocks.deleteUser).not.toHaveBeenCalled();
		expect(mocks.createCompletionToken).not.toHaveBeenCalled();
		expect(mocks.order).toEqual([
			'credential',
			'capture-stripe',
			'request',
			'set-cookie:account_deletion_operation',
			'unlink-stripe'
		]);
	});

	it('allows a stale sign-in to resume with a valid owner-bound retry cookie', async () => {
		mocks.hasValidReauth.mockReturnValue(false);
		mocks.readRetryOperation.mockReturnValue(operation.operationId);

		const event = makeEvent({ retryCookie: 'valid-signed-token' }) as never;
		const response = await POST(event);

		expect(response.status).toBe(200);
		expect(mocks.readRetryOperation).toHaveBeenCalledWith(
			'valid-signed-token',
			'user-1',
			'provider-secret'
		);
		expect(mocks.requestDeletion).toHaveBeenCalledTimes(1);
	});

	it.each([
		['absent', undefined],
		['forged', 'forged-token']
	])('rejects a stale sign-in with an %s retry cookie before Parchment', async (_label, token) => {
		mocks.hasValidReauth.mockReturnValue(false);
		mocks.readRetryOperation.mockReturnValue(null);

		const response = await POST(makeEvent({ retryCookie: token }));

		expect(response.status).toBe(403);
		expect((await response.json()).error.code).toBe('recent_sign_in_required');
		expect(mocks.captureStripeCustomerId).not.toHaveBeenCalled();
		expect(mocks.requestDeletion).not.toHaveBeenCalled();
	});

	it('blocks a valid retry cookie for a different operation before provider cleanup', async () => {
		mocks.hasValidReauth.mockReturnValue(false);
		mocks.readRetryOperation.mockReturnValue('different-operation-id');

		const response = await POST(makeEvent({ retryCookie: 'valid-but-stale-token' }));

		expect(response.status).toBe(409);
		expect((await response.json()).error.code).toBe('operation_mismatch');
		expect(mocks.unlinkStripeCustomer).not.toHaveBeenCalled();
		expect(mocks.finalizeDeletion).not.toHaveBeenCalled();
		expect(mocks.deleteUser).not.toHaveBeenCalled();
	});

	it('sets a strict HttpOnly retry cookie after Parchment and clears it after Auth deletion', async () => {
		const event = makeEvent() as unknown as {
			cookies: {
				set: ReturnType<typeof vi.fn>;
				delete: ReturnType<typeof vi.fn>;
			};
		};

		const response = await POST(event as never);

		expect(response.status).toBe(200);
		expect(event.cookies.set).toHaveBeenCalledWith(
			'account_deletion_operation',
			'signed-retry-token',
			{
				path: '/api/account-deletion',
				httpOnly: true,
				sameSite: 'strict',
				secure: true,
				maxAge: 86400
			}
		);
		expect(event.cookies.set).toHaveBeenCalledWith(
			'account_deletion_completed',
			'signed-completion-token',
			{
				path: '/',
				httpOnly: true,
				sameSite: 'strict',
				secure: true,
				maxAge: 600
			}
		);
		expect(event.cookies.delete).toHaveBeenCalledWith('account_deletion_reauthenticated', {
			path: '/api/account-deletion'
		});
		expect(event.cookies.delete).toHaveBeenCalledWith('account_deletion_operation', {
			path: '/api/account-deletion'
		});
		expect(mocks.order.indexOf('request')).toBeLessThan(
			mocks.order.indexOf('set-cookie:account_deletion_operation')
		);
		expect(mocks.order.indexOf('delete-auth')).toBeLessThan(
			mocks.order.indexOf('delete-cookie:account_deletion_operation')
		);
	});

	it('requires a cookie session and rejects bearer credentials', async () => {
		const anonymous = await POST(makeEvent({ authenticated: false }));
		const bearer = await POST(makeEvent({ authorization: 'Bearer api-key' }));

		expect(anonymous.status).toBe(401);
		expect(bearer.status).toBe(401);
		expect(mocks.createParchmentServerClient).not.toHaveBeenCalled();
	});

	it('requires an explicit same-origin request', async () => {
		for (const origin of [null, 'https://evil.test']) {
			const response = await POST(makeEvent({ origin }));
			expect(response.status).toBe(403);
			expect(response.headers.get('cache-control')).toBe('no-store');
		}
	});

	it('requires the exact confirmation before any preflight work', async () => {
		const response = await POST(makeEvent({ body: { confirmation: 'delete my account' } }));

		expect(response.status).toBe(400);
		expect((await response.json()).error.code).toBe('confirmation_required');
		expect(mocks.captureStripeCustomerId).not.toHaveBeenCalled();
	});

	it('requires a current-session reauthentication capability', async () => {
		mocks.hasValidReauth.mockReturnValue(false);

		const response = await POST(makeEvent());

		expect(response.status).toBe(403);
		expect((await response.json()).error.code).toBe('recent_sign_in_required');
		expect(mocks.captureStripeCustomerId).not.toHaveBeenCalled();
	});

	it('preflights provider configuration before quiescing', async () => {
		mocks.getProviderCredential.mockImplementation(() => {
			throw new mocks.ParchmentConfigError('missing');
		});

		const response = await POST(makeEvent());

		expect(response.status).toBe(503);
		expect((await response.json()).error.code).toBe('deletion_unavailable');
		expect(mocks.requestDeletion).not.toHaveBeenCalled();
	});

	it('preserves actionable active_billing conflicts without provider work', async () => {
		mocks.requestDeletion.mockResolvedValue({
			error: {
				error: {
					code: 'active_billing',
					message: 'Cancel active or trialing billing before deletion.'
				}
			},
			response: new Response(null, { status: 409 })
		});

		const response = await POST(makeEvent());

		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({
			error: {
				code: 'active_billing',
				message: 'Cancel active or trialing billing before deletion.'
			}
		});
		expect(mocks.unlinkStripeCustomer).not.toHaveBeenCalled();
		expect(mocks.finalizeDeletion).not.toHaveBeenCalled();
		expect(mocks.deleteUser).not.toHaveBeenCalled();
	});

	it('does not publish finalization when Stripe cleanup fails', async () => {
		mocks.unlinkStripeCustomer.mockRejectedValue(
			new mocks.AccountDeletionProviderError('stripe failed')
		);

		const response = await POST(makeEvent());

		expect(response.status).toBe(502);
		expect((await response.json()).error.code).toBe('provider_cleanup_failed');
		expect(mocks.finalizeDeletion).not.toHaveBeenCalled();
		expect(mocks.deleteUser).not.toHaveBeenCalled();
	});

	it('does not delete Auth when provider finalization fails', async () => {
		mocks.finalizeDeletion.mockResolvedValue({
			error: { error: { code: 'provider_failure', message: 'Try again.' } },
			response: new Response(null, { status: 503 })
		});

		const response = await POST(makeEvent());

		expect(response.status).toBe(503);
		expect((await response.json()).error.code).toBe('provider_failure');
		expect(mocks.deleteUser).not.toHaveBeenCalled();
	});

	it('keeps auth-delete failure retryable and reports the operation', async () => {
		mocks.deleteUser.mockImplementation(async () => {
			mocks.order.push('delete-auth');
			return { error: new Error('auth unavailable') };
		});

		const response = await POST(makeEvent());

		expect(response.status).toBe(502);
		expect(await response.json()).toEqual({
			error: {
				code: 'auth_delete_failed',
				message: 'Provider cleanup finished, but sign-in removal failed. Please try again.'
			},
			operation: { ...operation, status: 'completed' }
		});
		expect(mocks.order.at(-1)).toBe('delete-auth');
	});
});
