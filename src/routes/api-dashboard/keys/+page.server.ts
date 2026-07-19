import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { createParchmentServerClient } from '$lib/server/parchmentClient';

/**
 * Load the signed-in user's API keys for the dashboard.
 *
 * Per #40 the key lifecycle (including listing) is owned by Parchment. This load
 * forwards the caller's session credential (`mode: 'session'`) to the SDK's
 * `apiKeys.list()` and maps Parchment's camelCase `ApiKeyRecord` rows onto the
 * snake_case shape `+page.svelte` renders (`is_active`, `created_at`,
 * `last_used_at`). Raw secrets are never returned by the list endpoint.
 */
export const load: PageServerLoad = async (event) => {
	const { locals } = event;
	// Get authenticated session
	const { session, user } = await locals.safeGetSession();

	// Allow authenticated users (free tier defaults to the viewer API plan)
	if (!session || !user) {
		throw redirect(303, '/');
	}

	// List the caller's keys via Parchment. Wrap the client path in try/catch so a
	// thrown failure (Parchment misconfigured, e.g. PARCHMENT_API_BASE_URL unset,
	// or the SDK fetch rejecting) surfaces the prepared error state instead of a
	// generic 500 SSR, mirroring the generate/deactivate routes.
	try {
		const client = await createParchmentServerClient(event, { mode: 'session' });
		const { data, error } = await client.apiKeys.list();

		if (error || !data) {
			console.error('Failed to load API keys');
			return {
				apiKeys: [],
				error: 'Failed to load API keys'
			};
		}

		// Map Parchment's camelCase rows onto the snake_case shape the page renders.
		const apiKeys = data.data.map((key) => ({
			id: key.id,
			name: key.name,
			is_active: key.isActive,
			created_at: key.createdAt,
			last_used_at: key.lastUsedAt
		}));

		return {
			apiKeys,
			user: {
				id: user.id,
				email: user.email
			}
		};
	} catch (err) {
		console.error('Error loading API keys:', err);
		return {
			apiKeys: [],
			error: 'Failed to load API keys'
		};
	}
};
