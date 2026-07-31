import { json } from '@sveltejs/kit';
import { createParchmentServerClient, ParchmentConfigError } from '$lib/server/parchmentClient';
import { ACCOUNT_DELETION_CONFIRMATION } from '$lib/accountDeletion';
import { getAccountDeletionProviderCredential } from '$lib/server/accountDeletionProvider';
import {
	ACCOUNT_DELETION_ACCEPTED_COOKIE,
	ACCOUNT_DELETION_ACCEPTED_MAX_AGE_SECONDS,
	ACCOUNT_DELETION_REAUTH_COOKIE,
	createAccountDeletionAcceptedToken,
	hasValidAccountDeletionReauth
} from '$lib/server/accountDeletionReauth';
import { checkoutAdmissionsReadyForAccountDeletion } from '$lib/server/billing/checkoutAdmissions';
import { isCookieSessionPrincipal } from '$lib/server/principal';
import type { RequestHandler } from './$types';

function response(status: number, body: Record<string, unknown>) {
	return json(body, {
		status,
		headers: { 'cache-control': 'no-store' }
	});
}

function upstreamError(
	result: {
		error?: unknown;
		response?: Response;
	},
	fallback: string
) {
	const status = result.response?.status ?? 502;
	const body =
		typeof result.error === 'object' && result.error !== null
			? result.error
			: { error: { code: 'upstream_error', message: fallback } };
	return response(status, body as Record<string, unknown>);
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
	const { user } = event.locals.principal;
	const sessionAccessToken = event.locals.principal.session.access_token;

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

	try {
		if (!checkoutAdmissionsReadyForAccountDeletion()) {
			return response(503, {
				error: {
					code: 'deletion_unavailable',
					message: 'Account deletion is temporarily unavailable.'
				}
			});
		}

		const providerCredential = getAccountDeletionProviderCredential();
		const hasReauthenticated = hasValidAccountDeletionReauth(
			event.cookies.get(ACCOUNT_DELETION_REAUTH_COOKIE),
			user.id,
			sessionAccessToken,
			providerCredential
		);
		if (!hasReauthenticated) {
			return response(403, {
				error: {
					code: 'recent_sign_in_required',
					message: 'Sign in with Google again before deleting your account.'
				}
			});
		}

		const client = await createParchmentServerClient(event, {
			mode: 'session',
			preferHandling: 'inherit'
		});

		const requestResult = await client.accountDeletion.requestOrchestrated({
			'x-account-deletion-provider-credential': providerCredential
		});
		if (requestResult.error || !requestResult.data) {
			return upstreamError(requestResult, 'Parchment could not start account deletion.');
		}
		if (
			requestResult.data.protocolVersion !== 2 ||
			requestResult.data.providerWorkPrepared !== true
		) {
			return response(502, {
				error: {
					code: 'invalid_deletion_contract',
					message: 'Parchment did not accept the service-owned deletion workflow.'
				}
			});
		}

		event.cookies.set(
			ACCOUNT_DELETION_ACCEPTED_COOKIE,
			createAccountDeletionAcceptedToken(user.id, providerCredential),
			{
				path: '/',
				httpOnly: true,
				sameSite: 'strict',
				secure: event.url.protocol === 'https:',
				maxAge: ACCOUNT_DELETION_ACCEPTED_MAX_AGE_SECONDS
			}
		);
		event.cookies.delete(ACCOUNT_DELETION_REAUTH_COOKIE, {
			path: '/api/account-deletion'
		});
		return response(202, {
			operationId: requestResult.data.operationId,
			status: requestResult.data.status
		});
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
