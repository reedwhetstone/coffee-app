import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	exchangeCodeForSession: vi.fn(),
	getUser: vi.fn(),
	readChallenge: vi.fn(),
	createAssertion: vi.fn()
}));

vi.mock('$lib/server/accountDeletionReauth', () => ({
	ACCOUNT_DELETION_REAUTH_CHALLENGE_COOKIE: 'account_deletion_reauth_challenge',
	ACCOUNT_DELETION_REAUTH_COOKIE: 'account_deletion_reauthenticated',
	ACCOUNT_DELETION_REAUTH_MAX_AGE_SECONDS: 600,
	createAccountDeletionAssertion: mocks.createAssertion,
	readAccountDeletionReauthChallenge: mocks.readChallenge
}));

import { GET } from './+server';

function makeEvent(
	challenge: string | undefined = 'signed-challenge',
	url = 'https://app.test/auth/callback?code=oauth-code&next=%2Faccount'
) {
	const setCookie = vi.fn();
	const deleteCookie = vi.fn();
	return {
		event: {
			url: new URL(url),
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
		mocks.readChallenge.mockResolvedValue('user-1');
		mocks.createAssertion.mockResolvedValue('signed-assertion');
	});

	it('mints one strict assertion only after a matching OAuth session exchange', async () => {
		const { event, setCookie, deleteCookie } = makeEvent();

		await expect(GET(event as never)).rejects.toMatchObject({ status: 303, location: '/account' });

		expect(mocks.createAssertion).toHaveBeenCalledWith('user-1');
		expect(setCookie).toHaveBeenCalledWith('account_deletion_reauthenticated', 'signed-assertion', {
			path: '/api/account-deletion',
			httpOnly: true,
			sameSite: 'strict',
			secure: true,
			maxAge: 600
		});
		expect(deleteCookie).toHaveBeenCalledWith('account_deletion_reauth_challenge', {
			path: '/auth/callback'
		});
	});

	it('consumes the challenge without minting an assertion for a different account', async () => {
		mocks.readChallenge.mockResolvedValue('different-user');
		const { event, setCookie, deleteCookie } = makeEvent();

		await expect(GET(event as never)).rejects.toMatchObject({ status: 303, location: '/account' });

		expect(deleteCookie).toHaveBeenCalledWith('account_deletion_reauth_challenge', {
			path: '/auth/callback'
		});
		expect(setCookie).not.toHaveBeenCalled();
	});

	it('consumes the challenge when the OAuth exchange fails', async () => {
		mocks.exchangeCodeForSession.mockResolvedValue({ data: { session: null }, error: new Error() });
		const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const { event, deleteCookie } = makeEvent();

		await expect(GET(event as never)).rejects.toMatchObject({
			status: 303,
			location: '/auth/auth-code-error'
		});
		expect(deleteCookie).toHaveBeenCalledWith('account_deletion_reauth_challenge', {
			path: '/auth/callback'
		});
		expect(mocks.createAssertion).not.toHaveBeenCalled();
		errorLog.mockRestore();
	});

	it('allows ordinary login to complete when assertion signing is unavailable', async () => {
		const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		mocks.createAssertion.mockRejectedValue(new Error('private key details'));
		const { event, setCookie } = makeEvent();

		await expect(GET(event as never)).rejects.toMatchObject({ status: 303, location: '/account' });

		expect(setCookie).not.toHaveBeenCalled();
		expect(errorLog).toHaveBeenCalledWith('Could not record account reauthentication');
		expect(JSON.stringify(errorLog.mock.calls)).not.toContain('private key details');
		errorLog.mockRestore();
	});
});
