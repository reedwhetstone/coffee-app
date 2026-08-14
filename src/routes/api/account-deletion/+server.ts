import { json } from '@sveltejs/kit';
import { ACCOUNT_DELETION_CONFIRMATION } from '$lib/accountDeletion';
import { ACCOUNT_DELETION_REAUTH_COOKIE } from '$lib/server/accountDeletionReauth';
import { createParchmentServerClient, ParchmentConfigError } from '$lib/server/parchmentClient';
import { isCookieSessionPrincipal } from '$lib/server/principal';
import type { RequestHandler } from './$types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPERATION_STATUSES = new Set([
	'accepted',
	'provider_deleting',
	'local_cleaning',
	'auth_deleting',
	'post_auth_cleanup',
	'retryable',
	'conflict',
	'completed'
]);

function response(status: number, body: Record<string, unknown>) {
	return json(body, {
		status,
		headers: { 'cache-control': 'no-store' }
	});
}

function isAcceptedOperation(value: unknown): value is Record<string, unknown> & {
	operationId: string;
	status: string;
} {
	return (
		typeof value === 'object' &&
		value !== null &&
		'operationId' in value &&
		typeof value.operationId === 'string' &&
		UUID_PATTERN.test(value.operationId) &&
		'status' in value &&
		typeof value.status === 'string' &&
		OPERATION_STATUSES.has(value.status)
	);
}

function errorBody(result: { error?: unknown }, fallback: string): Record<string, unknown> {
	return typeof result.error === 'object' && result.error !== null
		? (result.error as Record<string, unknown>)
		: { error: { code: 'upstream_error', message: fallback } };
}

function clearAssertion(event: Parameters<RequestHandler>[0]): void {
	event.cookies.delete(ACCOUNT_DELETION_REAUTH_COOKIE, {
		path: '/api/account-deletion'
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
			error: { code: 'untrusted_origin', message: 'Cross-site account deletion is blocked.' }
		});
	}

	if (!event.request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
		return response(415, {
			error: { code: 'invalid_content_type', message: 'A JSON request is required.' }
		});
	}

	if (!isCookieSessionPrincipal(event.locals.principal)) {
		return response(401, {
			error: { code: 'session_required', message: 'Sign in before deleting your account.' }
		});
	}

	let body: unknown;
	try {
		body = await event.request.json();
	} catch {
		return response(400, {
			error: { code: 'invalid_request', message: 'The request body is invalid.' }
		});
	}

	if (
		typeof body !== 'object' ||
		body === null ||
		!('confirmation' in body) ||
		body.confirmation !== ACCOUNT_DELETION_CONFIRMATION
	) {
		return response(400, {
			error: {
				code: 'confirmation_required',
				message: `Type ${ACCOUNT_DELETION_CONFIRMATION} exactly to continue.`
			}
		});
	}

	const assertion = event.cookies.get(ACCOUNT_DELETION_REAUTH_COOKIE);
	if (!assertion) {
		return response(403, {
			error: {
				code: 'recent_sign_in_required',
				message: 'Sign in with Google again before deleting your account.'
			}
		});
	}

	try {
		const client = await createParchmentServerClient(event, {
			mode: 'session',
			preferHandling: 'inherit'
		});
		const requestResult = await client.accountDeletion.request({ assertion });
		const upstreamStatus = requestResult.response?.status;

		if (
			!requestResult.error &&
			(upstreamStatus === 200 || upstreamStatus === 202) &&
			isAcceptedOperation(requestResult.data)
		) {
			clearAssertion(event);
			return response(upstreamStatus, requestResult.data);
		}

		if (upstreamStatus !== undefined && upstreamStatus >= 200 && upstreamStatus < 300) {
			return response(502, {
				error: {
					code: 'invalid_deletion_contract',
					message: 'Parchment returned an invalid account-deletion operation.'
				}
			});
		}

		if (upstreamStatus === 400 || upstreamStatus === 401 || upstreamStatus === 403) {
			clearAssertion(event);
		}
		if (upstreamStatus === 403) {
			return response(403, {
				error: {
					code: 'recent_sign_in_required',
					message: 'Sign in with Google again before deleting your account.'
				}
			});
		}

		return response(
			upstreamStatus ?? 502,
			errorBody(requestResult, 'Parchment could not start account deletion.')
		);
	} catch (error) {
		if (error instanceof ParchmentConfigError) {
			return response(503, {
				error: {
					code: 'deletion_unavailable',
					message: 'Account deletion is temporarily unavailable.'
				}
			});
		}
		console.error('Account deletion request failed');
		return response(502, {
			error: {
				code: 'account_deletion_failed',
				message: 'Account deletion could not be completed. Please try again.'
			}
		});
	}
};
