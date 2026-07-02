import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createParchmentServerClient } from '$lib/server/parchmentClient';

/**
 * Deactivate (revoke) an API key owned by the signed-in dashboard user.
 *
 * Per #40 revocation is owned by Parchment. This route authenticates the
 * dashboard session, then forwards the caller's own credential (`mode: 'session'`)
 * to Parchment's revoke endpoint via the SDK. Parchment scopes the mutation to the
 * session user, so a user can only revoke their own keys — the previous local
 * `user_id` ownership check is now enforced server-side by the API.
 */
export const POST: RequestHandler = async (event) => {
	const { request, locals } = event;
	try {
		// Local session guard: only signed-in dashboard users may revoke keys.
		const { session, user } = await locals.safeGetSession();

		if (!session || !user) {
			return json(
				{
					success: false,
					error: 'Authentication required'
				},
				{ status: 401 }
			);
		}

		// Parse request body
		const { keyId } = await request.json();

		if (!keyId || typeof keyId !== 'string') {
			return json(
				{
					success: false,
					error: 'API key ID is required'
				},
				{ status: 400 }
			);
		}

		// Revoke via Parchment; ownership is enforced upstream against the session
		// user, so a user cannot revoke another user's key.
		const client = await createParchmentServerClient(event, { mode: 'session' });
		const { data, error, response } = await client.apiKeys.revoke(keyId);

		if (error || !data) {
			return json(
				{
					success: false,
					error: error?.error?.message || 'Failed to deactivate API key'
				},
				{ status: response?.status ?? 500 }
			);
		}

		return json({
			success: true,
			message: 'API key deactivated successfully'
		});
	} catch (error) {
		console.error('Error deactivating API key:', error);
		return json(
			{
				success: false,
				error: 'Internal server error'
			},
			{ status: 500 }
		);
	}
};
