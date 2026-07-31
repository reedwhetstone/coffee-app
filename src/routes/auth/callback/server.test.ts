import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	exchangeCodeForSession: vi.fn(),
	getUser: vi.fn(),
	getCredential: vi.fn(),
	readChallenge: vi.fn(),
	createReauthToken: vi.fn()
}));

vi.mock('$lib/server/accountDeletionProvider', () => ({
	getAccountDeletionProviderCredential: mocks.getCredential
}));

vi.mock('$lib/server/accountDeletionReauth', () => ({
	ACCOUNT_DELETION_REAUTH_CHALLENGE_COOKIE: 'account_deletion_reauth_challenge',
	ACCOUNT_DELETION_REAUTH_COOKIE: 'account_deletion_reauthenticated',
	ACCOUNT_DELETION_REAUTH_MAX_AGE_SECONDS: 600,
	createAccountDeletionReauthToken: mocks.createReauthToken,
	readAccountDeletionReauthChallenge: mocks.readChallenge
}));

import { GET } from './+server';

function makeEvent(challenge = 'signed-challenge') {
	const setCookie = vi.fn();
	const deleteCookie = vi.fn();
	return {
		event: {
			url: new URL('https://app.test/auth/callback?code=oauth-code&next=%2Faccount'),
			cookies: {
				get: vi.fn().mockReturnValue(challenge),
				set: setCookie,
				delete: deleteCookie
			},
			locals: {
				supabase: {
					auth: {
						exchangeCodeForSession: mocks.exchangeCodeForSession,
						getUser: mocks.getUser
					}
				}
			}
		},
		setCookie,
		deleteCookie
	};
}

describe('GET /auth/callback', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.exchangeCodeForSession.mockResolvedValue({
			data: { session: { access_token: 'new-session-token' } },
			error: null
		});
		mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
		mocks.getCredential.mockReturnValue('provider-secret');
		mocks.readChallenge.mockReturnValue('user-1');
		mocks.createReauthToken.mockReturnValue('signed-reauth-token');
	});

	it('mints the reauthentication capability only after a matching OAuth session exchange', async () => {
		const { event, setCookie, deleteCookie } = makeEvent();

		await expect(GET(event as never)).rejects.toMatchObject({ status: 303, location: '/account' });

		expect(setCookie).toHaveBeenCalledWith(
			'account_deletion_reauthenticated',
			'signed-reauth-token',
			{
				path: '/api/account-deletion',
				httpOnly: true,
				sameSite: 'strict',
				secure: true,
				maxAge: 600
			}
		);
		expect(deleteCookie).toHaveBeenCalledWith('account_deletion_reauth_challenge', {
			path: '/auth/callback'
		});
	});

	it('does not grant the capability when OAuth returns a different account', async () => {
		mocks.readChallenge.mockReturnValue('different-user');
		const { event, setCookie } = makeEvent();

		await expect(GET(event as never)).rejects.toMatchObject({ status: 303, location: '/account' });

		expect(setCookie).not.toHaveBeenCalled();
	});
});
