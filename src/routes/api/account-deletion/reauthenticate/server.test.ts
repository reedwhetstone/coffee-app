import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	class ParchmentConfigError extends Error {}
	return {
		getCredential: vi.fn(),
		createChallenge: vi.fn(),
		isCookieSessionPrincipal: vi.fn(),
		ParchmentConfigError
	};
});

vi.mock('$lib/server/accountDeletionProvider', () => ({
	getAccountDeletionProviderCredential: mocks.getCredential
}));

vi.mock('$lib/server/accountDeletionReauth', () => ({
	ACCOUNT_DELETION_REAUTH_CHALLENGE_COOKIE: 'account_deletion_reauth_challenge',
	ACCOUNT_DELETION_REAUTH_MAX_AGE_SECONDS: 600,
	createAccountDeletionReauthChallenge: mocks.createChallenge
}));

vi.mock('$lib/server/parchmentClient', () => ({
	ParchmentConfigError: mocks.ParchmentConfigError
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
	const event = {
		request: {
			headers: { get: (name: string) => headers.get(name.toLowerCase()) ?? null }
		},
		url: new URL('https://app.test/api/account-deletion/reauthenticate'),
		cookies: { set: setCookie },
		locals: {
			principal: {
				user: { id: 'user-1' },
				session: { access_token: 'session-1' }
			}
		}
	};
	mocks.isCookieSessionPrincipal.mockReturnValue(options.authenticated !== false);
	return { event, setCookie };
}

describe('POST /api/account-deletion/reauthenticate', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getCredential.mockReturnValue('provider-secret');
		mocks.createChallenge.mockReturnValue('signed-challenge');
	});

	it('issues an HttpOnly OAuth challenge for the current account', async () => {
		const { event, setCookie } = makeEvent();

		const response = await POST(event as never);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ status: 'reauthentication_required' });
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
		expect(mocks.createChallenge).toHaveBeenCalledWith('user-1', 'provider-secret');
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

	it('fails closed when account deletion configuration is unavailable', async () => {
		mocks.getCredential.mockImplementation(() => {
			throw new mocks.ParchmentConfigError('missing');
		});

		const response = await POST(makeEvent().event as never);

		expect(response.status).toBe(503);
		expect((await response.json()).error.code).toBe('reauthentication_unavailable');
	});
});
