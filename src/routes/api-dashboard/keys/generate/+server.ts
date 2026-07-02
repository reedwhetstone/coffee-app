import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createParchmentServerClient } from '$lib/server/parchmentClient';

/**
 * Mint a new API key for the signed-in dashboard user.
 *
 * Per #40 the API-key *lifecycle* is owned by Parchment, so this route no longer
 * mints keys locally. It authenticates the dashboard session, then forwards the
 * caller's own credential to Parchment (`mode: 'session'`) via the SDK. Parchment
 * scopes the key to that user, hashes/stores it, and returns the raw secret
 * exactly once — which we relay in the response shape the create form expects
 * (`{ success, apiKey }`). The raw secret is never persisted here.
 */
export const POST: RequestHandler = async (event) => {
	const { request, locals } = event;
	try {
		// Local session guard: only signed-in dashboard users may mint keys. The
		// credential itself is forwarded to Parchment, which enforces entitlement.
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
		const { name } = await request.json();

		if (!name || typeof name !== 'string' || !name.trim()) {
			return json(
				{
					success: false,
					error: 'API key name is required'
				},
				{ status: 400 }
			);
		}

		// Mint via Parchment. Session mode forwards the logged-in user's Supabase
		// token as Bearer; the token never reaches the browser.
		const client = await createParchmentServerClient(event, { mode: 'session' });
		const { data, error, response } = await client.apiKeys.create({ name: name.trim() });

		if (error || !data) {
			// Relay Parchment's status (e.g. 401/403 entitlement, 503 unavailable) so
			// the dashboard surfaces the real authorization decision instead of a
			// blanket 500.
			return json(
				{
					success: false,
					error: error?.error?.message || 'Failed to create API key'
				},
				{ status: response?.status ?? 500 }
			);
		}

		// `data.apiKey` is the raw secret, returned by Parchment exactly once.
		return json({
			success: true,
			apiKey: data.apiKey,
			message: 'API key created successfully'
		});
	} catch (error) {
		console.error('Error creating API key:', error);
		return json(
			{
				success: false,
				error: 'Internal server error'
			},
			{ status: 500 }
		);
	}
};
