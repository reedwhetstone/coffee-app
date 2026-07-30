import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	class AccountDeletionConfigError extends Error {}
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
		hasRecentSignIn: vi.fn(),
		deleteUser: vi.fn(),
		AccountDeletionConfigError,
		AccountDeletionProviderError,
		ParchmentConfigError
	};
});

vi.mock('$lib/server/accountDeletion', () => ({
	ACCOUNT_DELETION_CONFIRMATION: 'DELETE MY ACCOUNT',
	AccountDeletionConfigError: mocks.AccountDeletionConfigError,
	AccountDeletionProviderError: mocks.AccountDeletionProviderError,
	captureStripeCustomerId: mocks.captureStripeCustomerId,
	unlinkStripeCustomer: mocks.unlinkStripeCustomer,
	getAccountDeletionProviderCredential: mocks.getProviderCredential,
	hasRecentSignIn: mocks.hasRecentSignIn
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
	} = {}
) {
	const origin = options.origin === undefined ? 'https://app.test' : options.origin;
	const headers = new Map<string, string>();
	if (origin !== null) headers.set('origin', origin);
	if (options.authorization) headers.set('authorization', options.authorization);
	headers.set('content-type', options.contentType ?? 'application/json');
	const body = options.body ?? { confirmation: 'DELETE MY ACCOUNT' };

	return {
		request: {
			headers: { get: (name: string) => headers.get(name.toLowerCase()) ?? null },
			json: vi.fn().mockResolvedValue(body)
		},
		url: new URL('https://app.test/api/account-deletion'),
		locals: {
			session: { access_token: 'session-token' },
			safeGetSession: vi.fn().mockResolvedValue(
				options.authenticated === false
					? { session: null, user: null, role: 'viewer', roles: ['viewer'] }
					: {
							session: { access_token: 'session-token' },
							user: {
								id: 'user-1',
								email: 'owner@example.com',
								last_sign_in_at: new Date().toISOString()
							},
							// A quiesced retry can have no retained user_roles.
							role: 'viewer',
							roles: ['viewer']
						}
			)
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
		mocks.hasRecentSignIn.mockReturnValue(true);
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
				data: { ...operation, status: 'ready' },
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

	it('runs the provider lifecycle in order and deletes Auth last', async () => {
		const response = await POST(makeEvent());

		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(await response.json()).toEqual({
			operationId: operation.operationId,
			status: 'ready'
		});
		expect(mocks.order).toEqual([
			'credential',
			'capture-stripe',
			'request',
			'unlink-stripe',
			'finalize',
			'delete-auth'
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

	it('requires a bounded recent Google sign-in', async () => {
		mocks.hasRecentSignIn.mockReturnValue(false);

		const response = await POST(makeEvent());

		expect(response.status).toBe(403);
		expect((await response.json()).error.code).toBe('recent_sign_in_required');
		expect(mocks.captureStripeCustomerId).not.toHaveBeenCalled();
	});

	it('preflights provider configuration before quiescing', async () => {
		mocks.getProviderCredential.mockImplementation(() => {
			throw new mocks.AccountDeletionConfigError('missing');
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
			operation: { ...operation, status: 'ready' }
		});
		expect(mocks.order.at(-1)).toBe('delete-auth');
	});
});
