import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getUserApiKeys, getUserApiTier } from '$lib/server/apiAuth';
import { createAdminClient } from '$lib/supabase-admin';
import { getApiUsage, calculateUsageStats } from '$lib/data/api-usage';

export const load: PageServerLoad = async ({ locals }) => {
	// Get authenticated session
	const { session, user, role } = await locals.safeGetSession();

	// Allow authenticated users (free tier defaults to api_viewer)
	// Require API role, admin access, or allow any authenticated user for free tier
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
			const userTier = getUserApiTier(role);
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
