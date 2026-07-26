import type { OwnerApiUsage } from '@purveyors/sdk';

export interface ApiKeyView {
	id: string;
	name: string;
	created_at: string | null;
	last_used_at: string | null;
	is_active: boolean;
}

export interface ApiUsageRecordView {
	endpoint: string;
	timestamp: string | null;
	status_code: number | null;
	response_time_ms: number | null;
}

export interface ApiKeyUsageView {
	keyId: string;
	keyName: string;
	monthlyRequests: number;
	windowRequests: number;
	windowTruncated: boolean;
	usage: ApiUsageRecordView[];
}

export interface DailySummaryView {
	date: string;
	total_requests: number;
	success_requests: number;
	error_requests: number;
	pending_requests: number;
	avg_response_time: number;
}

export interface KeyQuotaStatus {
	keyId: string;
	keyName: string;
	monthlyRequests: number;
	monthlyLimitPerKey: number;
	monthlyPercent: number;
	nearLimit: boolean;
	atLimit: boolean;
}

export interface UsageStatsView {
	monthlyUsage: number;
	hourlyUsage: number;
	monthlyLimitPerKey: number;
	userTier: OwnerApiUsage['plan']['id'];
	unlimited: boolean;
	highestKeyQuota: KeyQuotaStatus | null;
}

export interface ApiUsagePageData {
	apiKeys: ApiKeyView[];
	usageData: ApiKeyUsageView[];
	dailySummary: DailySummaryView[];
	usageStats: UsageStatsView;
	currentStats: {
		monthlyUsage: number;
		hourlyUsage: number;
		monthlyLimitPerKey: number;
		userTier: OwnerApiUsage['plan']['id'];
		unlimited: boolean;
		totalKeys: number;
		activeKeys: number;
		highestKeyQuota: KeyQuotaStatus | null;
	};
	seriesTruncated: boolean;
}

function keyQuotaStatus(
	usage: OwnerApiUsage,
	key: OwnerApiUsage['keys'][number] | undefined
): KeyQuotaStatus | null {
	if (!key || usage.plan.unlimited || usage.plan.monthlyRequestLimitPerKey === -1) return null;

	const ratio = key.monthlyRequests / usage.plan.monthlyRequestLimitPerKey;
	return {
		keyId: key.id,
		keyName: key.name,
		monthlyRequests: key.monthlyRequests,
		monthlyLimitPerKey: usage.plan.monthlyRequestLimitPerKey,
		monthlyPercent: Math.min(ratio * 100, 100),
		nearLimit: ratio >= 0.8,
		atLimit: ratio >= 1
	};
}

/**
 * Adapt the capability-shaped Parchment response to the existing Console page
 * shapes. Aggregate owner traffic and per-key quota state remain deliberately
 * separate because the plan limit applies independently to each API key.
 */
export function mapOwnerApiUsage(usage: OwnerApiUsage): ApiUsagePageData {
	const highestUsageKey = usage.keys
		.filter((key) => key.isActive)
		.reduce<
			OwnerApiUsage['keys'][number] | undefined
		>((highest, key) => (!highest || key.monthlyRequests > highest.monthlyRequests ? key : highest), undefined);
	const highestKeyQuota = keyQuotaStatus(usage, highestUsageKey);

	return {
		apiKeys: usage.keys.map((key) => ({
			id: key.id,
			name: key.name,
			created_at: key.createdAt,
			last_used_at: key.lastUsedAt,
			is_active: key.isActive
		})),
		usageData: usage.keys.map((key) => ({
			keyId: key.id,
			keyName: key.name,
			monthlyRequests: key.monthlyRequests,
			windowRequests: key.windowRequests,
			windowTruncated: key.windowTruncated,
			usage: key.recent.map((record) => ({
				endpoint: record.endpoint,
				timestamp: record.timestamp,
				status_code: record.statusCode,
				response_time_ms: record.responseTimeMs
			}))
		})),
		dailySummary: usage.daily.map((day) => ({
			date: day.date,
			total_requests: day.totalRequests,
			success_requests: day.successRequests,
			error_requests: day.errorRequests,
			pending_requests: day.pendingRequests,
			avg_response_time: day.averageResponseTimeMs
		})),
		usageStats: {
			monthlyUsage: usage.summary.monthlyRequests,
			hourlyUsage: usage.summary.hourlyRequests,
			monthlyLimitPerKey: usage.plan.monthlyRequestLimitPerKey,
			userTier: usage.plan.id,
			unlimited: usage.plan.unlimited,
			highestKeyQuota
		},
		currentStats: {
			monthlyUsage: usage.summary.monthlyRequests,
			hourlyUsage: usage.summary.hourlyRequests,
			monthlyLimitPerKey: usage.plan.monthlyRequestLimitPerKey,
			userTier: usage.plan.id,
			unlimited: usage.plan.unlimited,
			totalKeys: usage.summary.totalKeys,
			activeKeys: usage.summary.activeKeys,
			highestKeyQuota
		},
		seriesTruncated:
			usage.window.truncated ||
			usage.bounds.keysTruncated ||
			usage.keys.some((key) => key.windowTruncated)
	};
}
