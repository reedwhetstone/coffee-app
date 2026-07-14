import { redirect } from '@sveltejs/kit';
import { createParchmentServerClient } from '$lib/server/parchmentClient';
import {
	DEFAULT_CLI_AUTH_FAILURE,
	clearCliRequest,
	cliAuthRedirectLocation,
	readCliRequest,
	rememberCliRequest
} from '$lib/server/cliAuthConsent';
import type { PageServerLoad } from './$types';

type InspectFailure = {
	title: string;
	message: string;
};

function inspectFailure(status: number): InspectFailure {
	if (status === 410) {
		return {
			title: 'Sign-in request expired',
			message: 'This request has expired or was already used. Start a new login from the CLI.'
		};
	}

	if (isRetryableInspectFailure(status)) {
		return {
			title: 'CLI sign-in is temporarily unavailable',
			message: 'Purveyors could not verify this request right now. Please try again shortly.'
		};
	}

	return {
		title: 'Invalid sign-in request',
		message: DEFAULT_CLI_AUTH_FAILURE
	};
}

function isRetryableInspectFailure(status: number) {
	return status === 429 || status >= 500;
}

export const load: PageServerLoad = async (event) => {
	event.setHeaders({
		'cache-control': 'no-store',
		'referrer-policy': 'no-referrer',
		'content-security-policy': "frame-ancestors 'none'",
		'x-frame-options': 'DENY'
	});

	const requestTokenFromQuery = event.url.searchParams.get('request')?.trim();
	const requestTokenFromCookie = requestTokenFromQuery ? undefined : readCliRequest(event);
	const requestToken = requestTokenFromQuery || requestTokenFromCookie;
	if (!requestToken) {
		return {
			request: null,
			failure: inspectFailure(400)
		};
	}

	try {
		const client = await createParchmentServerClient(event, { mode: 'anonymous' });
		const { data, error, response } = await client.cliAuth.inspect({ requestToken });

		if (error || !data) {
			if (!requestTokenFromCookie || !isRetryableInspectFailure(response.status)) {
				clearCliRequest(event);
			}
			return {
				request: null,
				failure: inspectFailure(response.status)
			};
		}

		const { session, user } = await event.locals.safeGetSession();
		if (!session || !user) {
			rememberCliRequest(event, requestToken);
			throw redirect(303, cliAuthRedirectLocation());
		}

		// The approval endpoint requires this same-site, HttpOnly request binding.
		// It replaces reliance on a browser-supplied Origin header for this one flow.
		rememberCliRequest(event, requestToken);

		return {
			requestToken,
			request: {
				machineName: data.machineName,
				expiresAt: data.expiresAt,
				scopes: data.scopes
			},
			failure: null
		};
	} catch (cause) {
		if (cause && typeof cause === 'object' && 'status' in cause && 'location' in cause) {
			throw cause;
		}

		if (!requestTokenFromCookie) {
			clearCliRequest(event);
		}
		console.error('Failed to inspect CLI sign-in request');
		return {
			request: null,
			failure: {
				title: 'Unable to verify sign-in request',
				message: 'Purveyors could not verify this request right now. Please try again shortly.'
			}
		};
	}
};
