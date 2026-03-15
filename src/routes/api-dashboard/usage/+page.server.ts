import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import {
	getUserApiKeys,
	getApiKeyUsage,
	getUserApiTier,
	API_RATE_LIMITS
} from '$lib/server/apiAuth';
import { createAdminClient } from '$lib/supabase-admin';
import { getApiUsage, buildDailySummary } from '$lib/data/api-usage';

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

		const apiKeys = (apiKeysResult.data || []) as Record<string, unknown>[];

		// Get usage data for all user's API keys
		const usagePromises = apiKeys.map(async (key) => {
			const usage = await getApiKeyUsage(key.id as string);
			return {
				keyId: key.id,
				keyName: key.name,
				usage: usage.success ? usage.data : []
			};
		});

		const usageResults = await Promise.all(usagePromises);

		// Get aggregated usage across all user's keys for daily summary
		let dailySummary: ReturnType<typeof buildDailySummary> = [];
		if (apiKeys.length > 0) {
			const allUsageRecords = await getApiUsage(supabase, user.id);
			dailySummary = buildDailySummary(allUsageRecords);
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
			.filter(
				(record: Record<string, unknown>) => new Date(record.timestamp as string) >= startOfHour
			).length;

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
