import { redirect } from '@sveltejs/kit';
import {
	ACCOUNT_DELETION_REAUTH_CHALLENGE_COOKIE,
	ACCOUNT_DELETION_REAUTH_COOKIE,
	ACCOUNT_DELETION_REAUTH_MAX_AGE_SECONDS,
	createAccountDeletionAssertion,
	readAccountDeletionReauthChallenge
} from '$lib/server/accountDeletionReauth';
import { sanitizeNextPath } from '$lib/utils/safeRedirect';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, cookies, locals: { supabase } }) => {
	const code = url.searchParams.get('code');
	// Harden against open-redirect: only allow internal paths as post-auth targets.
	const next = sanitizeNextPath(url.searchParams.get('next'), '/dashboard');
	const reauthChallenge = cookies.get(ACCOUNT_DELETION_REAUTH_CHALLENGE_COOKIE);
	if (reauthChallenge) {
		// The OAuth attempt is terminal at this callback, regardless of whether the
		// exchange, account match, or signing operation succeeds.
		cookies.delete(ACCOUNT_DELETION_REAUTH_CHALLENGE_COOKIE, {
			path: '/auth/callback'
		});
		cookies.delete(ACCOUNT_DELETION_REAUTH_COOKIE, {
			path: '/api/account-deletion'
		});
	}

	if (code) {
		const { data, error } = await supabase.auth.exchangeCodeForSession(code);
		if (!error && data?.session) {
			const { data: userData, error: userError } = await supabase.auth.getUser();
			if (userError || !userData.user) {
				throw redirect(303, '/auth/auth-code-error');
			}

			if (reauthChallenge) {
				try {
					const challengedUserId = await readAccountDeletionReauthChallenge(reauthChallenge);
					if (challengedUserId === userData.user.id) {
						cookies.set(
							ACCOUNT_DELETION_REAUTH_COOKIE,
							await createAccountDeletionAssertion(userData.user.id),
							{
								path: '/api/account-deletion',
								httpOnly: true,
								sameSite: 'strict',
								secure: url.protocol === 'https:',
								maxAge: ACCOUNT_DELETION_REAUTH_MAX_AGE_SECONDS
							}
						);
					}
				} catch {
					// A normal login must not fail because account-deletion configuration
					// is unavailable. The deletion endpoint will fail closed instead.
					console.error('Could not record account reauthentication');
				}
			}

			throw redirect(303, next);
		}
		console.error('Auth error:', error);
	}

	throw redirect(303, '/auth/auth-code-error');
};
