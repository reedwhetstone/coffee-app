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

	// Allow authenticated users (free tier defaults to api_viewer)
	if (!session || !user) {
		throw redirect(303, '/');
	}

	// List the caller's keys via Parchment.
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
};
