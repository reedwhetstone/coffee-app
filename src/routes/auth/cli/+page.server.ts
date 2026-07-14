import { fail, redirect } from '@sveltejs/kit';
import { createParchmentServerClient } from '$lib/server/parchmentClient';
import { sanitizeNextPath } from '$lib/utils/safeRedirect';
import type { Actions, PageServerLoad } from './$types';

const DEFAULT_FAILURE =
	'This CLI sign-in request is invalid or no longer available. Start a new login from the CLI.';

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

	if (status === 503) {
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

/**
 * Rebuild the post-login destination from the one signed request value this
 * route understands. Never forward an arbitrary `next` value from the URL.
 */
export function _buildCliAuthNextPath(requestToken: string): string {
	return sanitizeNextPath(`/auth/cli?request=${encodeURIComponent(requestToken)}`, '/auth/cli');
}

export const load: PageServerLoad = async (event) => {
	event.setHeaders({
		'cache-control': 'no-store',
		'referrer-policy': 'no-referrer'
	});

	const requestToken = event.url.searchParams.get('request')?.trim();
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
			return {
				request: null,
				failure: inspectFailure(response.status)
			};
		}

		const { session, user } = await event.locals.safeGetSession();
		if (!session || !user) {
			const next = _buildCliAuthNextPath(requestToken);
			throw redirect(303, `/auth?next=${encodeURIComponent(next)}`);
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
			const next = _buildCliAuthNextPath(normalizedRequestToken);
			throw redirect(303, `/auth?next=${encodeURIComponent(next)}`);
		}

		try {
			const client = await createParchmentServerClient(event, { mode: 'session' });
			const { data, error, response } = await client.cliAuth.approve({
				requestToken: normalizedRequestToken
			});

			if (error || !data?.approved) {
				const terminal = [400, 403, 409, 410].includes(response.status);
				const message = terminal
					? DEFAULT_FAILURE
					: response.status === 401
						? 'Your session expired. Sign in again before approving this request.'
						: 'Purveyors could not approve this request right now. Please try again shortly.';

				return fail(response.status >= 400 && response.status < 600 ? response.status : 502, {
					approved: false,
					signedOut: response.status === 401,
					terminal,
					error: message
				});
			}

			// The approval response intentionally contains no API key. The CLI receives
			// the one-time secret later by exchanging its private PKCE verifier directly
			// with Parchment.
			return {
				approved: true,
				signedOut: false,
				terminal: true
			};
		} catch (_cause) {
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
