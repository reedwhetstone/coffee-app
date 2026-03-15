import type { SupabaseClient } from '@supabase/supabase-js';
import { API_RATE_LIMITS } from '$lib/server/apiAuth';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ApiUsageRecord {
	timestamp: string | null;
	status_code: number | null;
	response_time_ms: number | null;
	// Supabase returns joined rows as an array when using !inner
	api_keys: { user_id: string }[] | { user_id: string } | null;
}

export interface UsageStats {
	monthlyUsage: number;
	hourlyUsage: number;
	monthlyLimit: number;
	userTier: 'viewer' | 'api-member' | 'api-enterprise';
	monthlyPercent: number;
	nearLimit: boolean;
	atLimit: boolean;
}

export interface ApiKeyUsageData {
	endpoint: string;
	timestamp: string | null;
	status_code: number | null;
	response_time_ms: number | null;
}

export interface DailySummary {
	date: string;
	total_requests: number;
	success_requests: number;
	error_requests: number;
	avg_response_time: number;
	total_response_time: number;
}

// ─── Query helpers ────────────────────────────────────────────────────────────

/**
 * Get API usage records for a user (last 30 days by default).
 * Requires an admin Supabase client to bypass RLS and join through api_keys.
 */
export async function getApiUsage(
	supabase: SupabaseClient,
	userId: string,
	options?: { days?: number }
): Promise<ApiUsageRecord[]> {
	const days = options?.days ?? 30;
	const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

	const { data, error } = await supabase
		.from('api_usage')
		.select(
			`
			timestamp,
			status_code,
			response_time_ms,
			api_keys!inner(user_id)
		`
		)
		.eq('api_keys.user_id', userId)
		.gte('timestamp', since)
		.order('timestamp', { ascending: false });

	if (error) {
		console.error('Error fetching api_usage for user', userId, error);
		return [];
	}

	return (data ?? []) as ApiUsageRecord[];
}

/**
 * Calculate monthly/hourly usage stats and limit percentages from raw records.
 * Pure function — no DB calls.
 */
export function calculateUsageStats(
	usageRecords: ApiUsageRecord[],
	userTier: 'viewer' | 'api-member' | 'api-enterprise'
): UsageStats {
	const monthlyLimit = API_RATE_LIMITS[userTier];

	const now = new Date();
	const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
	const startOfHour = new Date(now.getTime() - 60 * 60 * 1000);

	const monthlyUsage = usageRecords.filter(
		(r) => r.timestamp && new Date(r.timestamp) >= startOfMonth
	).length;

	const hourlyUsage = usageRecords.filter(
		(r) => r.timestamp && new Date(r.timestamp) >= startOfHour
	).length;

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

	return {
		monthlyUsage,
		hourlyUsage,
		monthlyLimit,
		userTier,
		monthlyPercent,
		nearLimit,
		atLimit
	};
}

/**
 * Get usage records for a single API key (last 30 days by default).
 * Requires an admin Supabase client.
 */
export async function getApiKeyUsage(
	supabase: SupabaseClient,
	keyId: string,
	options?: { days?: number }
): Promise<ApiKeyUsageData[]> {
	const days = options?.days ?? 30;
	const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

	const { data, error } = await supabase
		.from('api_usage')
		.select('endpoint, timestamp, status_code, response_time_ms')
		.eq('api_key_id', keyId)
		.gte('timestamp', since)
		.order('timestamp', { ascending: false })
		.limit(1000);

	if (error) {
		console.error('Error fetching api_usage for key', keyId, error);
		return [];
	}

	return (data ?? []) as ApiKeyUsageData[];
}

/**
 * Aggregate raw usage records into per-day summaries.
 * Pure function — no DB calls.
 */
export function buildDailySummary(usageRecords: ApiUsageRecord[]): DailySummary[] {
	const dailyGroups = usageRecords.reduce<Record<string, DailySummary>>((acc, record) => {
		if (!record.timestamp) return acc;
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
		if ((record.status_code ?? 500) < 400) {
			acc[date].success_requests++;
		} else {
			acc[date].error_requests++;
		}
		acc[date].total_response_time += record.response_time_ms ?? 0;
		return acc;
	}, {});

	return Object.values(dailyGroups)
		.map((day) => ({
			...day,
			avg_response_time:
				day.total_requests > 0 ? Math.round(day.total_response_time / day.total_requests) : 0
		}))
		.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
