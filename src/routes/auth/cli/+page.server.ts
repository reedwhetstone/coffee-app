import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { createParchmentServerClient } from '$lib/server/parchmentClient';
import type { Actions, PageServerLoad } from './$types';

const DEFAULT_FAILURE =
	'This CLI sign-in request is invalid or no longer available. Start a new login from the CLI.';
const CLI_REQUEST_COOKIE = 'purveyors_cli_auth_request';
const AUTH_RETURN_PATH = '/auth/cli';

type InspectFailure = {
	title: string;
	message: string;
};

type CliAuthEvent = Pick<Parameters<PageServerLoad>[0], 'url' | 'cookies'>;

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
		message: DEFAULT_FAILURE
	};
}

function isRetryableInspectFailure(status: number) {
	return status === 429 || status >= 500;
}

function rememberCliRequest(event: CliAuthEvent, requestToken: string) {
	event.cookies.set(CLI_REQUEST_COOKIE, requestToken, {
		httpOnly: true,
		maxAge: 10 * 60,
		path: AUTH_RETURN_PATH,
		sameSite: 'lax',
		secure: event.url.protocol === 'https:'
	});
}

function clearCliRequest(event: CliAuthEvent) {
	event.cookies.delete(CLI_REQUEST_COOKIE, { path: AUTH_RETURN_PATH });
}

function isApproveActionLoad(url: URL) {
	// SvelteKit re-runs load against /auth/cli?/approve after a failed action.
	return url.searchParams.has('/approve');
}

function authRedirectLocation() {
	return `/auth?next=${encodeURIComponent(AUTH_RETURN_PATH)}`;
}

async function reauthenticate(event: RequestEvent) {
	// SvelteKit form actions enforce same-origin POSTs. Requiring the short-lived
	// CLI request cookie as well prevents an unrelated auth-page navigation from
	// becoming a session reset.
	const requestToken = event.cookies.get(CLI_REQUEST_COOKIE)?.trim();
	if (!requestToken) {
		return fail(400, {
			approved: false,
			signedOut: false,
			terminal: true,
			error: DEFAULT_FAILURE
		});
	}

	const { session, user } = await event.locals.safeGetSession();
	if (!session || !user) {
		throw redirect(303, authRedirectLocation());
	}

	const { error } = await event.locals.supabase.auth.signOut();
	if (error) {
		return fail(502, {
			approved: false,
			signedOut: false,
			terminal: false,
			error: 'Failed to reset your session. Please try again.'
		});
	}

	throw redirect(303, authRedirectLocation());
}

export const load: PageServerLoad = async (event) => {
	event.setHeaders({
		'cache-control': 'no-store',
		'referrer-policy': 'no-referrer',
		'content-security-policy': "frame-ancestors 'none'",
		'x-frame-options': 'DENY'
	});

	const requestTokenFromQuery = event.url.searchParams.get('request')?.trim();
	const requestTokenFromCookie = requestTokenFromQuery
		? undefined
		: event.cookies.get(CLI_REQUEST_COOKIE)?.trim();
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
			throw redirect(303, authRedirectLocation());
		}

		if (!isApproveActionLoad(event.url)) {
			clearCliRequest(event);
		}

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

export const actions: Actions = {
	reauthenticate,
	approve: async (event) => {
		const formData = await event.request.formData();
		const requestToken = formData.get('request');
		if (typeof requestToken !== 'string' || requestToken.trim().length === 0) {
			return fail(400, {
				approved: false,
				signedOut: false,
				terminal: true,
				error: DEFAULT_FAILURE
			});
		}

		const normalizedRequestToken = requestToken.trim();
		const { session, user } = await event.locals.safeGetSession();
		if (!session || !user) {
			rememberCliRequest(event, normalizedRequestToken);
			throw redirect(303, authRedirectLocation());
		}

		try {
			const client = await createParchmentServerClient(event, { mode: 'session' });
			const { data, error, response } = await client.cliAuth.approve({
				requestToken: normalizedRequestToken
			});

			if (error || !data?.approved) {
				const terminal = [400, 403, 409, 410].includes(response.status);
				const signedOut = response.status === 401;
				if (terminal) {
					clearCliRequest(event);
				} else {
					rememberCliRequest(event, normalizedRequestToken);
				}
				const message = terminal
					? DEFAULT_FAILURE
					: response.status === 401
						? 'Your session expired. Sign in again before approving this request.'
						: 'Purveyors could not approve this request right now. Please try again shortly.';

				return fail(response.status >= 400 && response.status < 600 ? response.status : 502, {
					approved: false,
					signedOut,
					terminal,
					error: message
				});
			}

			// The approval response intentionally contains no API key. The CLI receives
			// the one-time secret later by exchanging its private PKCE verifier directly
			// with Parchment.
			clearCliRequest(event);
			return {
				approved: true,
				signedOut: false,
				terminal: true
			};
		} catch (_cause) {
			rememberCliRequest(event, normalizedRequestToken);
			console.error('Failed to approve CLI sign-in request');
			return fail(502, {
				approved: false,
				signedOut: false,
				terminal: false,
				error: 'Purveyors could not approve this request right now. Please try again shortly.'
			});
		}
	}
};
