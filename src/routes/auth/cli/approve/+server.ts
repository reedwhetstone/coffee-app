import { json } from '@sveltejs/kit';
import { createParchmentServerClient } from '$lib/server/parchmentClient';
import {
	DEFAULT_CLI_AUTH_FAILURE,
	clearCliRequest,
	cliAuthRedirectLocation,
	readCliRequest,
	rememberCliRequest
} from '$lib/server/cliAuthConsent';
import type { RequestHandler } from './$types';

type ApprovalBody = {
	request?: unknown;
};

function response(status: number, body: Record<string, unknown>) {
	return json(body, {
		status,
		headers: { 'cache-control': 'no-store' }
	});
}

export const POST: RequestHandler = async (event) => {
	if (!event.request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
		return response(415, {
			approved: false,
			signedOut: false,
			terminal: true,
			error: DEFAULT_CLI_AUTH_FAILURE
		});
	}

	let body: ApprovalBody;
	try {
		body = (await event.request.json()) as ApprovalBody;
	} catch {
		return response(400, {
			approved: false,
			signedOut: false,
			terminal: true,
			error: DEFAULT_CLI_AUTH_FAILURE
		});
	}

	const requestToken = typeof body.request === 'string' ? body.request.trim() : '';
	const rememberedRequest = readCliRequest(event);
	if (!requestToken || !rememberedRequest || requestToken !== rememberedRequest) {
		return response(403, {
			approved: false,
			signedOut: false,
			terminal: true,
			error: DEFAULT_CLI_AUTH_FAILURE
		});
	}

	const { session, user } = await event.locals.safeGetSession();
	if (!session || !user) {
		rememberCliRequest(event, requestToken);
		return response(401, {
			approved: false,
			signedOut: true,
			terminal: false,
			error: 'Your session expired. Sign in again before approving this request.',
			redirectTo: cliAuthRedirectLocation()
		});
	}

	try {
		const client = await createParchmentServerClient(event, { mode: 'session' });
		const { data, error, response: upstream } = await client.cliAuth.approve({ requestToken });

		if (error || !data?.approved) {
			const terminal = [400, 403, 409, 410].includes(upstream.status);
			const signedOut = upstream.status === 401;
			if (terminal) {
				clearCliRequest(event);
			} else {
				rememberCliRequest(event, requestToken);
			}

			return response(upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502, {
				approved: false,
				signedOut,
				terminal,
				error: terminal
					? DEFAULT_CLI_AUTH_FAILURE
					: signedOut
						? 'Your session expired. Sign in again before approving this request.'
						: 'Purveyors could not approve this request right now. Please try again shortly.'
			});
		}

		// The browser receives no API key. The CLI exchanges its private PKCE
		// verifier directly with Parchment for the one-time secret.
		clearCliRequest(event);
		return response(200, {
			approved: true,
			signedOut: false,
			terminal: true
		});
	} catch {
		rememberCliRequest(event, requestToken);
		console.error('Failed to approve CLI sign-in request');
		return response(502, {
			approved: false,
			signedOut: false,
			terminal: false,
			error: 'Purveyors could not approve this request right now. Please try again shortly.'
		});
	}
};
