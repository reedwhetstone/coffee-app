import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getUserApiKeys } from '$lib/server/apiAuth';
import { resolvePrincipal } from '$lib/server/principal';
import { createAdminClient } from '$lib/supabase-admin';
import { getApiUsage, calculateUsageStats } from '$lib/data/api-usage';

export const load: PageServerLoad = async (event) => {
	const { locals } = event;

	// Get authenticated session
	const { session, user } = await locals.safeGetSession();

	// Allow authenticated users
	if (!session || !user) {
		throw redirect(303, '/');
	}

	// Load user's API keys (without revealing actual keys)
	const apiKeysResult = await getUserApiKeys(user.id);

	if (!apiKeysResult.success) {
		console.error('Failed to load API keys:', apiKeysResult.error);
		return {
			apiKeys: [],
			error: 'Failed to load API keys',
			usageStats: null
		};
	}

	const apiKeys = apiKeysResult.data || [];
	const supabase = createAdminClient();

	// Get current usage statistics for accountability
	let usageStats = null;
	if (apiKeys.length > 0) {
		try {
			// Resolve principal to get explicit API plan entitlement
			const principal = await resolvePrincipal(event);
			const userTier = principal.isAuthenticated ? (principal.apiPlan ?? 'viewer') : 'viewer';
			const usageRecords = await getApiUsage(supabase, user.id);
			usageStats = calculateUsageStats(usageRecords, userTier);
		} catch (error) {
			console.error('Error loading usage stats:', error);
		}
	}

	return {
		apiKeys,
		usageStats,
		user: {
			id: user.id,
			email: user.email
		}
	};
};
