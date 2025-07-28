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

	// Get user's first active API key for examples
	const apiKeysResult = await getUserApiKeys(user.id);

	let exampleApiKey = 'your_api_key';
	if (apiKeysResult.success && apiKeysResult.data && apiKeysResult.data.length > 0) {
		const activeKey = apiKeysResult.data.find((key) => key.is_active);
		if (activeKey) {
			// Show masked version for documentation examples
			exampleApiKey = activeKey.name.toLowerCase().replace(/\s+/g, '_') + '_key';
		}
	}

	return {
		user: {
			id: user.id,
			email: user.email
		},
		exampleApiKey,
		hasApiKeys: apiKeysResult.success && (apiKeysResult.data?.length || 0) > 0
	};
};
