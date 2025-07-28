import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getUserApiKeys } from '$lib/server/apiAuth';
import { hasRole } from '$lib/types/auth.types';
import { createAdminClient } from '$lib/supabase-admin';

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
			const now = new Date();
			const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
			const startOfHour = new Date(now.getTime() - 60 * 60 * 1000);

			// Get monthly usage
			const { data: monthlyData, error: monthlyError } = await supabase
				.from('api_usage')
				.select('*', { count: 'exact', head: true })
				.in('api_key_id', apiKeys.map(k => k.id))
				.gte('timestamp', startOfMonth.toISOString());

			// Get hourly usage
			const { data: hourlyData, error: hourlyError } = await supabase
				.from('api_usage')
				.select('*', { count: 'exact', head: true })
				.in('api_key_id', apiKeys.map(k => k.id))
				.gte('timestamp', startOfHour.toISOString());

			const monthlyUsage = monthlyError ? 0 : (monthlyData as any)?.count || 0;
			const hourlyUsage = hourlyError ? 0 : (hourlyData as any)?.count || 0;

			// Rate limits (assuming developer tier)
			const MONTHLY_LIMIT = 10000;
			const HOURLY_LIMIT = 416;

			usageStats = {
				monthlyUsage,
				hourlyUsage,
				monthlyLimit: MONTHLY_LIMIT,
				hourlyLimit: HOURLY_LIMIT,
				monthlyPercent: Math.min((monthlyUsage / MONTHLY_LIMIT) * 100, 100),
				hourlyPercent: Math.min((hourlyUsage / HOURLY_LIMIT) * 100, 100),
				nearLimit: (monthlyUsage / MONTHLY_LIMIT) >= 0.8 || (hourlyUsage / HOURLY_LIMIT) >= 0.8,
				atLimit: (monthlyUsage / MONTHLY_LIMIT) >= 0.95 || (hourlyUsage / HOURLY_LIMIT) >= 0.95
			};
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
