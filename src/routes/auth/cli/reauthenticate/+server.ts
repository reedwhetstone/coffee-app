import { json } from '@sveltejs/kit';
import {
	DEFAULT_CLI_AUTH_FAILURE,
	cliAuthRedirectLocation,
	readCliRequest
} from '$lib/server/cliAuthConsent';
import type { RequestHandler } from './$types';
import { isCookieSessionPrincipal } from '$lib/server/principal';

function response(status: number, body: Record<string, unknown>) {
	return json(body, {
		status,
		headers: { 'cache-control': 'no-store' }
	});
}

export const POST: RequestHandler = async (event) => {
	if (!event.request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
		return response(415, { error: DEFAULT_CLI_AUTH_FAILURE });
	}

	if (!readCliRequest(event)) {
		return response(403, { error: DEFAULT_CLI_AUTH_FAILURE });
	}

	if (isCookieSessionPrincipal(event.locals.principal)) {
		const { error } = await event.locals.supabase.auth.signOut();
		if (error) {
			return response(502, { error: 'Failed to reset your session. Please try again.' });
		}
	}

	return response(200, { redirectTo: cliAuthRedirectLocation() });
};
