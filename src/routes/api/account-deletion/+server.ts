import { json } from '@sveltejs/kit';
import { createParchmentServerClient, ParchmentConfigError } from '$lib/server/parchmentClient';
import { createAdminClient } from '$lib/supabase-admin';
import {
	ACCOUNT_DELETION_CONFIRMATION,
	AccountDeletionConfigError,
	AccountDeletionProviderError,
	captureStripeCustomerId,
	getAccountDeletionProviderCredential,
	hasRecentSignIn,
	unlinkStripeCustomer
} from '$lib/server/accountDeletion';
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

	const { session, user } = await event.locals.safeGetSession();
	if (!session || !user) {
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

	if (!hasRecentSignIn(user)) {
		return response(403, {
			error: {
				code: 'recent_sign_in_required',
				message: 'Sign in with Google again before deleting your account.'
			}
		});
	}

	try {
		// Preflight everything needed after Parchment quiesces the owner. The
		// retained mapping is deliberately read before the first deletion request.
		const providerCredential = getAccountDeletionProviderCredential();
		const stripeCustomerId = await captureStripeCustomerId(user.id);
		const client = await createParchmentServerClient(event, {
			mode: 'session',
			preferHandling: 'inherit'
		});

		const requestResult = await client.accountDeletion.request();
		if (requestResult.error || !requestResult.data) {
			return upstreamError(requestResult, 'Parchment could not start account deletion.');
		}

		await unlinkStripeCustomer(stripeCustomerId, user.id);

		const finalizationResult = await client.raw.POST('/v1/account-deletion/provider-finalization', {
			params: {
				header: {
					'x-account-deletion-provider-credential': providerCredential
				}
			},
			body: { operationId: requestResult.data.operationId }
		});
		if (finalizationResult.error || !finalizationResult.data) {
			return upstreamError(finalizationResult, 'Parchment could not finalize provider cleanup.');
		}

		// This is intentionally the final external action. If it fails, the
		// browser session remains available to retry the idempotent operation.
		const { error: deleteError } = await createAdminClient().auth.admin.deleteUser(user.id);
		if (deleteError) {
			return response(502, {
				error: {
					code: 'auth_delete_failed',
					message: 'Provider cleanup finished, but sign-in removal failed. Please try again.'
				},
				operation: finalizationResult.data
			});
		}

		return response(200, {
			operationId: finalizationResult.data.operationId,
			status: finalizationResult.data.status
		});
	} catch (error) {
		if (error instanceof AccountDeletionConfigError || error instanceof ParchmentConfigError) {
			return response(503, {
				error: {
					code: 'deletion_unavailable',
					message: 'Account deletion is temporarily unavailable.'
				}
			});
		}
		if (error instanceof AccountDeletionProviderError) {
			return response(502, {
				error: {
					code: 'provider_cleanup_failed',
					message: 'Provider cleanup could not be completed. Please try again.'
				}
			});
		}

		console.error('Account deletion failed:', error);
		return response(502, {
			error: {
				code: 'account_deletion_failed',
				message: 'Account deletion could not be completed. Please try again.'
			}
		});
	}
};
