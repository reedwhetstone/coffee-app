import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getUserApiKeys } from '$lib/server/apiAuth';
export const load: PageServerLoad = async ({ locals }) => {
	// Get authenticated session
	const { session, user } = await locals.safeGetSession();

	// Allow authenticated users (free tier defaults to api_viewer)
	if (!session || !user) {
		throw redirect(303, '/');
	}

	// Load user's API keys with more detailed info
	const apiKeysResult = await getUserApiKeys(user.id);

	if (!apiKeysResult.success) {
		console.error('Failed to load API keys');
		return {
			apiKeys: [],
			error: 'Failed to load API keys'
		};
	}

	return {
		apiKeys: apiKeysResult.data || [],
		user: {
			id: user.id,
			email: user.email
		}
	};
};
