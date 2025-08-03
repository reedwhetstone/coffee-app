import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import {
	getUserApiKeys,
	getApiKeyUsage,
	getUsageSummary,
	getUserApiTier,
	API_RATE_LIMITS
} from '$lib/server/apiAuth';
import { hasRole } from '$lib/types/auth.types';
import { createAdminClient } from '$lib/supabase-admin';

const supabase = createAdminClient();

export const load: PageServerLoad = async ({ locals }) => {
	// Get authenticated session
	const { session, user, role } = await locals.safeGetSession();

	// Allow authenticated users (free tier defaults to api_viewer)
	if (!session || !user) {
		throw redirect(303, '/');
	}

	try {
		// Get user's API keys
		const apiKeysResult = await getUserApiKeys(user.id);
		if (!apiKeysResult.success) {
			return {
				error: 'Failed to load API keys',
				apiKeys: [],
				usageData: [],
				summary: null
			};
		}

		const apiKeys = apiKeysResult.data || [];

		// Get usage data for all user's API keys
		const usagePromises = apiKeys.map(async (key) => {
			const usage = await getApiKeyUsage(key.id);
			return {
				keyId: key.id,
				keyName: key.name,
				usage: usage.success ? usage.data : []
			};
		});

		const usageResults = await Promise.all(usagePromises);

		// Get usage summary for the last 30 days
		let dailySummary = [];
		if (apiKeys.length > 0) {
			// Get aggregated usage across all user's keys
			const { data: summaryData, error: summaryError } = await supabase
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

			if (!summaryError && summaryData) {
				// Group by day
				const dailyGroups = summaryData.reduce(
					(acc, record) => {
						const date = new Date(record.timestamp).toISOString().split('T')[0];
						if (!acc[date]) {
							acc[date] = {
								date,
								total_requests: 0,
								success_requests: 0,
								error_requests: 0,
								avg_response_time: 0,
								total_response_time: 0
							};
						}
						acc[date].total_requests++;
						if (record.status_code < 400) {
							acc[date].success_requests++;
						} else {
							acc[date].error_requests++;
						}
						acc[date].total_response_time += record.response_time_ms;
						return acc;
					},
					{} as Record<string, any>
				);

				dailySummary = Object.values(dailyGroups)
					.map((day: any) => ({
						...day,
						avg_response_time:
							day.total_requests > 0 ? Math.round(day.total_response_time / day.total_requests) : 0
					}))
					.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
			}
		}

		// Calculate current usage stats with dynamic limits
		const userTier = getUserApiTier(role);
		const monthlyLimit = API_RATE_LIMITS[userTier];

		const now = new Date();
		const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
		const startOfHour = new Date(now.getTime() - 60 * 60 * 1000);

		const monthlyUsage = dailySummary
			.filter((day) => new Date(day.date) >= startOfMonth)
			.reduce((sum, day) => sum + day.total_requests, 0);

		const hourlyUsage = usageResults
			.flatMap((result) => result.usage || [])
			.filter((record) => new Date(record.timestamp) >= startOfHour).length;

		return {
			apiKeys,
			usageData: usageResults,
			dailySummary,
			currentStats: {
				monthlyUsage,
				hourlyUsage,
				monthlyLimit,
				userTier,
				totalKeys: apiKeys.length,
				activeKeys: apiKeys.filter((key) => key.is_active).length
			}
		};
	} catch (error) {
		console.error('Error loading usage analytics:', error);
		return {
			error: 'Failed to load usage analytics',
			apiKeys: [],
			usageData: [],
			summary: null
		};
	}
};
