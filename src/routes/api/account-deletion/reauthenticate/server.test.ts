import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	class AccountDeletionReauthConfigError extends Error {}
	return {
		createChallenge: vi.fn(),
		isCookieSessionPrincipal: vi.fn(),
		AccountDeletionReauthConfigError
	};
});

vi.mock('$lib/server/accountDeletionReauth', () => ({
	ACCOUNT_DELETION_REAUTH_CHALLENGE_COOKIE: 'account_deletion_reauth_challenge',
	ACCOUNT_DELETION_REAUTH_COOKIE: 'account_deletion_reauthenticated',
	ACCOUNT_DELETION_REAUTH_MAX_AGE_SECONDS: 600,
	AccountDeletionReauthConfigError: mocks.AccountDeletionReauthConfigError,
	createAccountDeletionReauthChallenge: mocks.createChallenge
}));

vi.mock('$lib/server/principal', () => ({
	isCookieSessionPrincipal: mocks.isCookieSessionPrincipal
}));

import { POST } from './+server';

function makeEvent(
	options: { origin?: string | null; authorization?: string; authenticated?: boolean } = {}
) {
	const origin = options.origin === undefined ? 'https://app.test' : options.origin;
	const headers = new Map<string, string>();
	if (origin !== null) headers.set('origin', origin);
	if (options.authorization) headers.set('authorization', options.authorization);
	const setCookie = vi.fn();
	const deleteCookie = vi.fn();
	const event = {
		request: {
			headers: { get: (name: string) => headers.get(name.toLowerCase()) ?? null }
		},
		url: new URL('https://app.test/api/account-deletion/reauthenticate'),
		cookies: { set: setCookie, delete: deleteCookie },
		locals: {
			principal: {
				user: { id: 'user-1' },
				session: { access_token: 'session-1' }
			}
		}
	};
	mocks.isCookieSessionPrincipal.mockReturnValue(options.authenticated !== false);
	return { event, setCookie, deleteCookie };
}

describe('POST /api/account-deletion/reauthenticate', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.createChallenge.mockResolvedValue('signed-challenge');
	});

	it('clears a stale assertion and issues a signed HttpOnly OAuth challenge', async () => {
		const { event, setCookie, deleteCookie } = makeEvent();

		const response = await POST(event as never);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ status: 'reauthentication_required' });
		expect(deleteCookie).toHaveBeenCalledWith('account_deletion_reauthenticated', {
			path: '/api/account-deletion'
		});
		expect(setCookie).toHaveBeenCalledWith(
			'account_deletion_reauth_challenge',
			'signed-challenge',
			{
				path: '/auth/callback',
				httpOnly: true,
				sameSite: 'lax',
				secure: true,
				maxAge: 600
			}
		);
		expect(mocks.createChallenge).toHaveBeenCalledWith('user-1');
		expect(deleteCookie.mock.invocationCallOrder[0]).toBeLessThan(
			setCookie.mock.invocationCallOrder[0]
		);
	});

	it('blocks cross-site, bearer, and anonymous callers', async () => {
		expect((await POST(makeEvent({ origin: 'https://evil.test' }).event as never)).status).toBe(
			403
		);
		expect((await POST(makeEvent({ authorization: 'Bearer key' }).event as never)).status).toBe(
			401
		);
		expect((await POST(makeEvent({ authenticated: false }).event as never)).status).toBe(401);
	});

	it('fails closed when assertion signing configuration is unavailable', async () => {
		mocks.createChallenge.mockRejectedValue(new mocks.AccountDeletionReauthConfigError('missing'));

		const response = await POST(makeEvent().event as never);

		expect(response.status).toBe(503);
		expect((await response.json()).error.code).toBe('reauthentication_unavailable');
	});

	it('does not log account or signing-key identifiers on an unexpected failure', async () => {
		const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		mocks.createChallenge.mockRejectedValue(new Error('user-1 signing-private'));

		const response = await POST(makeEvent().event as never);

		expect(response.status).toBe(503);
		expect(errorLog).toHaveBeenCalledWith('Could not start account reauthentication');
		expect(JSON.stringify(errorLog.mock.calls)).not.toContain('user-1');
		expect(JSON.stringify(errorLog.mock.calls)).not.toContain('signing-private');
		errorLog.mockRestore();
	});
});
