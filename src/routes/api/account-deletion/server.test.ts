import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	class ParchmentConfigError extends Error {}
	return {
		order: [] as string[],
		requestOrchestrated: vi.fn(),
		createParchmentServerClient: vi.fn(),
		getProviderCredential: vi.fn(),
		hasValidReauth: vi.fn(),
		createAcceptedToken: vi.fn(),
		checkoutAdmissionsReadyForAccountDeletion: vi.fn(),
		ParchmentConfigError
	};
});

vi.mock('$lib/server/accountDeletionProvider', () => ({
	getAccountDeletionProviderCredential: mocks.getProviderCredential
}));

vi.mock('$lib/server/accountDeletionReauth', () => ({
	ACCOUNT_DELETION_ACCEPTED_COOKIE: 'account_deletion_accepted',
	ACCOUNT_DELETION_ACCEPTED_MAX_AGE_SECONDS: 600,
	ACCOUNT_DELETION_REAUTH_COOKIE: 'account_deletion_reauthenticated',
	hasValidAccountDeletionReauth: mocks.hasValidReauth,
	createAccountDeletionAcceptedToken: mocks.createAcceptedToken
}));

vi.mock('$lib/server/billing/checkoutAdmissions', () => ({
	checkoutAdmissionsReadyForAccountDeletion: mocks.checkoutAdmissionsReadyForAccountDeletion
}));

vi.mock('$lib/server/parchmentClient', () => ({
	ParchmentConfigError: mocks.ParchmentConfigError,
	createParchmentServerClient: mocks.createParchmentServerClient
}));

import { POST } from './+server';

const operation = {
	operationId: '9dc525f2-b855-4af1-9908-661f030e716c',
	status: 'awaiting_provider_finalization',
	protocolVersion: 2,
	providerWorkPrepared: true,
	providerCleanupVerified: false
};

function makeEvent(
	options: {
		origin?: string | null;
		authorization?: string;
		contentType?: string;
		body?: unknown;
		authenticated?: boolean;
		reauthCookie?: string;
	} = {}
) {
	const origin = options.origin === undefined ? 'https://app.test' : options.origin;
	const headers = new Map<string, string>();
	if (origin !== null) headers.set('origin', origin);
	if (options.authorization) headers.set('authorization', options.authorization);
	headers.set('content-type', options.contentType ?? 'application/json');
	const cookieSet = vi.fn((name: string) => mocks.order.push(`set-cookie:${name}`));
	const cookieDelete = vi.fn((name: string) => mocks.order.push(`delete-cookie:${name}`));

	return {
		request: {
			headers: { get: (name: string) => headers.get(name.toLowerCase()) ?? null },
			json: vi.fn().mockResolvedValue(options.body ?? { confirmation: 'DELETE MY ACCOUNT' })
		},
		url: new URL('https://app.test/api/account-deletion'),
		cookies: {
			get: vi.fn(() => options.reauthCookie),
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
							user: { id: 'user-1', email: 'owner@example.com' }
						}
		},
		fetch: vi.fn()
	} as never;
}

describe('POST /api/account-deletion', () => {
	beforeEach(() => {
		mocks.order.length = 0;
		vi.clearAllMocks();
		mocks.checkoutAdmissionsReadyForAccountDeletion.mockReturnValue(true);
		mocks.getProviderCredential.mockImplementation(() => {
			mocks.order.push('credential');
			return 'provider-secret';
		});
		mocks.hasValidReauth.mockReturnValue(true);
		mocks.createAcceptedToken.mockReturnValue('signed-accepted-token');
		mocks.requestOrchestrated.mockImplementation(async () => {
			mocks.order.push('request');
			return { data: operation, response: new Response(null, { status: 202 }) };
		});
		mocks.createParchmentServerClient.mockResolvedValue({
			accountDeletion: { requestOrchestrated: mocks.requestOrchestrated }
		});
	});

	it('accepts the service-owned saga and leaves every provider/Auth retry to Parchment', async () => {
		const response = await POST(makeEvent());

		expect(response.status).toBe(202);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(await response.json()).toEqual({
			operationId: operation.operationId,
			status: operation.status
		});
		expect(mocks.order).toEqual([
			'credential',
			'request',
			'set-cookie:account_deletion_accepted',
			'delete-cookie:account_deletion_reauthenticated'
		]);
		expect(mocks.createParchmentServerClient).toHaveBeenCalledWith(expect.anything(), {
			mode: 'session',
			preferHandling: 'inherit'
		});
		expect(mocks.requestOrchestrated).toHaveBeenCalledWith({
			'x-account-deletion-provider-credential': 'provider-secret'
		});
	});

	it('sets the accepted banner only after Parchment durably accepts protocol v2', async () => {
		const event = makeEvent() as unknown as {
			cookies: { set: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
		};
		const response = await POST(event as never);

		expect(response.status).toBe(202);
		expect(event.cookies.set).toHaveBeenCalledWith(
			'account_deletion_accepted',
			'signed-accepted-token',
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
	});

	it('rejects a response that did not establish the provider-work contract', async () => {
		mocks.requestOrchestrated.mockResolvedValue({
			data: { ...operation, protocolVersion: 1, providerWorkPrepared: false },
			response: new Response(null, { status: 202 })
		});

		const event = makeEvent() as never;
		const response = await POST(event);

		expect(response.status).toBe(502);
		expect((await response.json()).error.code).toBe('invalid_deletion_contract');
		expect(mocks.createAcceptedToken).not.toHaveBeenCalled();
	});

	it('fails closed until managed Checkout admissions are enabled and drained', async () => {
		mocks.checkoutAdmissionsReadyForAccountDeletion.mockReturnValue(false);
		const response = await POST(makeEvent());
		expect(response.status).toBe(503);
		expect((await response.json()).error.code).toBe('deletion_unavailable');
		expect(mocks.requestOrchestrated).not.toHaveBeenCalled();
	});

	it('requires a current-session reauthentication capability on every request', async () => {
		mocks.hasValidReauth.mockReturnValue(false);
		const response = await POST(makeEvent({ reauthCookie: 'stale' }));
		expect(response.status).toBe(403);
		expect((await response.json()).error.code).toBe('recent_sign_in_required');
		expect(mocks.requestOrchestrated).not.toHaveBeenCalled();
	});

	it('preserves actionable nonterminal billing conflicts', async () => {
		mocks.requestOrchestrated.mockResolvedValue({
			error: {
				error: {
					code: 'active_billing',
					message: 'Resolve every nonterminal subscription before deletion.'
				}
			},
			response: new Response(null, { status: 409 })
		});

		const response = await POST(makeEvent());
		expect(response.status).toBe(409);
		expect((await response.json()).error.code).toBe('active_billing');
		expect(mocks.createAcceptedToken).not.toHaveBeenCalled();
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

	it('preflights provider configuration before calling Parchment', async () => {
		mocks.getProviderCredential.mockImplementation(() => {
			throw new mocks.ParchmentConfigError('missing');
		});
		const response = await POST(makeEvent());
		expect(response.status).toBe(503);
		expect((await response.json()).error.code).toBe('deletion_unavailable');
		expect(mocks.requestOrchestrated).not.toHaveBeenCalled();
	});

	it('does not emit account or provider identifiers when an unexpected request fails', async () => {
		const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		mocks.requestOrchestrated.mockRejectedValue(new Error('user-1 cus_private'));

		const response = await POST(makeEvent());
		expect(response.status).toBe(502);
		expect(errorLog).toHaveBeenCalledWith('Account deletion request failed');
		expect(JSON.stringify(errorLog.mock.calls)).not.toContain('user-1');
		expect(JSON.stringify(errorLog.mock.calls)).not.toContain('cus_private');
		errorLog.mockRestore();
	});
});
