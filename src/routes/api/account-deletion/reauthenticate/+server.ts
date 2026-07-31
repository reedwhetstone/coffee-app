import { json } from '@sveltejs/kit';
import { ParchmentConfigError } from '$lib/server/parchmentClient';
import { getAccountDeletionProviderCredential } from '$lib/server/accountDeletionProvider';
import {
	ACCOUNT_DELETION_REAUTH_CHALLENGE_COOKIE,
	ACCOUNT_DELETION_REAUTH_MAX_AGE_SECONDS,
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
		const credential = getAccountDeletionProviderCredential();
		event.cookies.set(
			ACCOUNT_DELETION_REAUTH_CHALLENGE_COOKIE,
			createAccountDeletionReauthChallenge(event.locals.principal.user.id, credential),
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
		if (error instanceof ParchmentConfigError) {
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
