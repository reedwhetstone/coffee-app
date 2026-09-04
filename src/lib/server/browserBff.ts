import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

import { isCookieSessionPrincipal } from '$lib/server/principal';

const NO_STORE_HEADERS = { 'cache-control': 'no-store' };

type ParchmentResult = {
	data?: unknown;
	error?: unknown;
	response?: Response;
};

export function browserBffResponse(status: number, body: unknown): Response {
	return json(body, { status, headers: NO_STORE_HEADERS });
}

export function guardBrowserBffRequest(
	event: RequestEvent,
	options: { mutation?: boolean; jsonBody?: boolean; legacyErrorShape?: boolean } = {}
): Response | null {
	const guardError = (status: number, code: string, message: string) =>
		browserBffResponse(
			status,
			options.legacyErrorShape ? { error: message } : { error: { code, message } }
		);

	if (event.request.headers.has('authorization')) {
		return guardError(
			401,
			'session_required',
			'Authorization headers are not accepted for browser requests.'
		);
	}

	if (!isCookieSessionPrincipal(event.locals.principal)) {
		return guardError(401, 'session_required', 'A browser session is required.');
	}

	if (options.mutation && event.request.headers.get('origin') !== event.url.origin) {
		return guardError(403, 'untrusted_origin', 'Cross-site mutations are blocked.');
	}

	if (
		options.jsonBody &&
		event.request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !==
			'application/json'
	) {
		return guardError(415, 'invalid_content_type', 'A JSON request is required.');
	}

	return null;
}

export function invalidJsonResponse(): Response {
	return browserBffResponse(400, {
		error: { code: 'invalid_request', message: 'The request body is invalid.' }
	});
}

export function relayParchmentResult(result: ParchmentResult): Response {
	if (result.error !== undefined) {
		return browserBffResponse(
			result.response?.status ?? 502,
			typeof result.error === 'object' && result.error !== null
				? result.error
				: {
						error: {
							code: 'upstream_error',
							message: 'Parchment could not complete the request.'
						}
					}
		);
	}

	if (result.data !== undefined) {
		return browserBffResponse(result.response?.status ?? 200, result.data);
	}

	return browserBffResponse(502, {
		error: {
			code: 'invalid_upstream_response',
			message: 'Parchment returned an invalid response.'
		}
	});
}

export function parchmentUnavailableResponse(status = 502): Response {
	return browserBffResponse(status, {
		error: {
			code: 'upstream_unavailable',
			message: 'Parchment is temporarily unavailable.'
		}
	});
}
