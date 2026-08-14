import { json } from '@sveltejs/kit';
import {
	ACCOUNT_DELETION_REAUTH_CHALLENGE_COOKIE,
	ACCOUNT_DELETION_REAUTH_COOKIE,
	ACCOUNT_DELETION_REAUTH_MAX_AGE_SECONDS,
	AccountDeletionReauthConfigError,
	createAccountDeletionReauthChallenge
} from '$lib/server/accountDeletionReauth';
import { isCookieSessionPrincipal } from '$lib/server/principal';
import type { RequestHandler } from './$types';

function response(status: number, body: Record<string, unknown>) {
	return json(body, {
		status,
		headers: { 'cache-control': 'no-store' }
	});
}

export const POST: RequestHandler = async (event) => {
	if (event.request.headers.get('authorization') !== null) {
		return response(401, {
			error: { code: 'session_required', message: 'A browser session is required.' }
		});
	}

	if (event.request.headers.get('origin') !== event.url.origin) {
		return response(403, {
			error: { code: 'untrusted_origin', message: 'Cross-site reauthentication is blocked.' }
		});
	}

	if (!isCookieSessionPrincipal(event.locals.principal)) {
		return response(401, {
			error: { code: 'session_required', message: 'Sign in before reauthenticating.' }
		});
	}

	try {
		event.cookies.delete(ACCOUNT_DELETION_REAUTH_COOKIE, {
			path: '/api/account-deletion'
		});
		event.cookies.set(
			ACCOUNT_DELETION_REAUTH_CHALLENGE_COOKIE,
			await createAccountDeletionReauthChallenge(event.locals.principal.user.id),
			{
				path: '/auth/callback',
				httpOnly: true,
				sameSite: 'lax',
				secure: event.url.protocol === 'https:',
				maxAge: ACCOUNT_DELETION_REAUTH_MAX_AGE_SECONDS
			}
		);
		return response(200, { status: 'reauthentication_required' });
	} catch (error) {
		if (error instanceof AccountDeletionReauthConfigError) {
			return response(503, {
				error: {
					code: 'reauthentication_unavailable',
					message: 'Reauthentication is temporarily unavailable.'
				}
			});
		}

		console.error('Could not start account reauthentication');
		return response(503, {
			error: {
				code: 'reauthentication_unavailable',
				message: 'Reauthentication is temporarily unavailable.'
			}
		});
	}
};
