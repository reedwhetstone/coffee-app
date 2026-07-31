import { redirect } from '@sveltejs/kit';
import { getAccountDeletionProviderCredential } from '$lib/server/accountDeletionProvider';
import {
	ACCOUNT_DELETION_REAUTH_CHALLENGE_COOKIE,
	ACCOUNT_DELETION_REAUTH_COOKIE,
	ACCOUNT_DELETION_REAUTH_MAX_AGE_SECONDS,
	createAccountDeletionReauthToken,
	readAccountDeletionReauthChallenge
} from '$lib/server/accountDeletionReauth';
import { sanitizeNextPath } from '$lib/utils/safeRedirect';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, cookies, locals: { supabase } }) => {
	const code = url.searchParams.get('code') as string;
	// Harden against open-redirect: only allow internal paths as post-auth targets.
	const next = sanitizeNextPath(url.searchParams.get('next'), '/dashboard');

	if (code) {
		const { data, error } = await supabase.auth.exchangeCodeForSession(code);
		if (!error && data?.session) {
			const { data: userData, error: userError } = await supabase.auth.getUser();
			if (userError || !userData.user) {
				throw redirect(303, '/auth/auth-code-error');
			}

			const reauthChallenge = cookies.get(ACCOUNT_DELETION_REAUTH_CHALLENGE_COOKIE);
			if (reauthChallenge) {
				try {
					const credential = getAccountDeletionProviderCredential();
					const challengedUserId = readAccountDeletionReauthChallenge(reauthChallenge, credential);
					if (challengedUserId === userData.user.id) {
						cookies.set(
							ACCOUNT_DELETION_REAUTH_COOKIE,
							createAccountDeletionReauthToken(
								userData.user.id,
								data.session.access_token,
								credential
							),
							{
								path: '/api/account-deletion',
								httpOnly: true,
								sameSite: 'strict',
								secure: url.protocol === 'https:',
								maxAge: ACCOUNT_DELETION_REAUTH_MAX_AGE_SECONDS
							}
						);
					}
				} catch (error) {
					// A normal login must not fail because account-deletion configuration
					// is unavailable. The deletion endpoint will fail closed instead.
					console.error('Could not record account reauthentication:', error);
				}
				cookies.delete(ACCOUNT_DELETION_REAUTH_CHALLENGE_COOKIE, {
					path: '/auth/callback'
				});
			}

			throw redirect(303, next);
		}
		console.error('Auth error:', error);
	}

	throw redirect(303, '/auth/auth-code-error');
};
