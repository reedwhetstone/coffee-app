import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getUserApiKeys, getUserApiTier, API_RATE_LIMITS } from '$lib/server/apiAuth';

import { createAdminClient } from '$lib/supabase-admin';

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
			// Get user's API tier based on their role
			const userTier = getUserApiTier(role);
			const monthlyLimit = API_RATE_LIMITS[userTier];

			const now = new Date();
			const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
			const startOfHour = new Date(now.getTime() - 60 * 60 * 1000);

			// Get usage data using the same method as usage analytics page
			const usageResult = await supabase
				.from('api_usage')
				.select(
					`
					timestamp,
					status_code,
					response_time_ms,
					api_keys!inner(user_id)
				`
				)
				.eq('api_keys.user_id', user.id)
				.gte('timestamp', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
				.order('timestamp', { ascending: false });

			const usageData = usageResult.data as Record<string, unknown>[] | null;
			const usageError = usageResult.error;

			let monthlyUsage = 0;
			let hourlyUsage = 0;

			if (!usageError && usageData) {
				// Calculate monthly usage (same method as usage analytics)
				monthlyUsage = usageData.filter(
					(record) => new Date(record.timestamp as string) >= startOfMonth
				).length;

				// Calculate hourly usage
				hourlyUsage = usageData.filter(
					(record) => new Date(record.timestamp as string) >= startOfHour
				).length;
			}

			// Calculate percentages (handle unlimited tier)
			let monthlyPercent = 0;
			let nearLimit = false;
			let atLimit = false;

			if (monthlyLimit === -1) {
				// Enterprise unlimited tier
				monthlyPercent = 0;
				nearLimit = false;
				atLimit = false;
			} else {
				monthlyPercent = Math.min((monthlyUsage / monthlyLimit) * 100, 100);
				nearLimit = monthlyUsage / monthlyLimit >= 0.8;
				atLimit = monthlyUsage / monthlyLimit >= 0.95;
			}

			usageStats = {
				monthlyUsage,
				hourlyUsage,
				monthlyLimit,
				userTier,
				monthlyPercent,
				nearLimit,
				atLimit
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
