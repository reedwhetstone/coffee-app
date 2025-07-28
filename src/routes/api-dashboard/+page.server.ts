import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getUserApiKeys } from '$lib/server/apiAuth';
import { hasRole } from '$lib/types/auth.types';

export const load: PageServerLoad = async ({ locals }) => {
	// Get authenticated session
	const { session, user, role } = await locals.safeGetSession();

	// Require API role or admin access
	if (!session || !user || (!hasRole(role, 'api') && !hasRole(role, 'admin'))) {
		throw redirect(303, '/');
	}

	// Load user's API keys (without revealing actual keys)
	const apiKeysResult = await getUserApiKeys(user.id);

	if (!apiKeysResult.success) {
		console.error('Failed to load API keys:', apiKeysResult.error);
		return {
			apiKeys: [],
			error: 'Failed to load API keys'
		};
	}

	// TODO: Add usage summary data here
	// const usageSummary = await getUsageSummary(user.id);

	return {
		apiKeys: apiKeysResult.data || [],
		user: {
			id: user.id,
			email: user.email
		}
	};
};
