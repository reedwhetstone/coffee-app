import type { OwnerApiUsage } from '@purveyors/sdk';

type CompatibleOwnerApiUsage = Omit<OwnerApiUsage, 'plan' | 'summary'> & {
	plan: Omit<OwnerApiUsage['plan'], 'limitScope'> & {
		/** Canonical account-scoped limit from the newer Parchment contract. */
		monthlyRequestLimit?: number;
		/** Deprecated responses report api_key; the Console treats the numeric field as a migration fallback. */
		limitScope?: 'account' | 'api_key';
		collectionItemLimit?: number | null;
	};
	summary: OwnerApiUsage['summary'] & {
		monthlyRequestsRemaining?: number;
		monthlyResetAt?: string;
	};
};

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
	recentSuccessRequests: number;
	recentErrorRequests: number;
	recentPendingRequests: number;
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

export interface AccountQuotaStatus {
	monthlyRequests: number;
	monthlyLimit: number;
	monthlyRequestsRemaining: number | null;
	monthlyPercent: number | null;
	monthlyResetAt: string;
	collectionItemLimit: number | null;
	limitScope: 'account';
	nearLimit: boolean;
	atLimit: boolean;
}

export interface UsageStatsView {
	monthlyUsage: number;
	hourlyUsage: number;
	userTier: OwnerApiUsage['plan']['id'];
	unlimited: boolean;
	totalKeys: number;
	activeKeys: number;
	accountQuota: AccountQuotaStatus;
}

export interface ApiUsageBoundsView {
	windowDays: number;
	recordLimit: number;
	seriesTruncated: boolean;
	keyLimit: number;
	keysTruncated: boolean;
	recentPerKey: number;
}

export interface ApiUsagePageData {
	apiKeys: ApiKeyView[];
	usageData: ApiKeyUsageView[];
	dailySummary: DailySummaryView[];
	usageStats: UsageStatsView;
	currentStats: UsageStatsView;
	bounds: ApiUsageBoundsView;
}

function nextUtcMonth(isoTimestamp: string): string {
	const generatedAt = new Date(isoTimestamp);
	if (Number.isNaN(generatedAt.getTime())) {
		throw new Error('Parchment usage response has an invalid generatedAt timestamp');
	}

	return new Date(
		Date.UTC(generatedAt.getUTCFullYear(), generatedAt.getUTCMonth() + 1, 1)
	).toISOString();
}

function accountQuotaStatus(usage: CompatibleOwnerApiUsage): AccountQuotaStatus {
	const monthlyLimit = usage.plan.monthlyRequestLimit ?? usage.plan.monthlyRequestLimitPerKey;
	const unlimited = usage.plan.unlimited || monthlyLimit === -1;
	const monthlyRequestsRemaining = unlimited
		? null
		: (usage.summary.monthlyRequestsRemaining ??
			Math.max(0, monthlyLimit - usage.summary.monthlyRequests));
	const monthlyPercent = unlimited
		? null
		: Math.min((usage.summary.monthlyRequests / monthlyLimit) * 100, 100);

	return {
		monthlyRequests: usage.summary.monthlyRequests,
		monthlyLimit,
		monthlyRequestsRemaining,
		monthlyPercent,
		monthlyResetAt: usage.summary.monthlyResetAt ?? nextUtcMonth(usage.generatedAt),
		collectionItemLimit: usage.plan.collectionItemLimit ?? (usage.plan.id === 'viewer' ? 25 : null),
		limitScope: 'account',
		nearLimit: monthlyPercent !== null && monthlyPercent >= 80,
		atLimit: monthlyPercent !== null && monthlyPercent >= 100
	};
}

/**
 * Adapt Parchment's owner traffic response for Console presentation. The new
 * contract exposes canonical account fields. Deprecated per-key limit naming is
 * accepted only as a deployment-order fallback; per-key rows are attribution.
 */
export function mapOwnerApiUsage(usage: OwnerApiUsage): ApiUsagePageData {
	const compatibleUsage = usage as CompatibleOwnerApiUsage;
	const accountQuota = accountQuotaStatus(compatibleUsage);
	const usageStats: UsageStatsView = {
		monthlyUsage: usage.summary.monthlyRequests,
		hourlyUsage: usage.summary.hourlyRequests,
		userTier: usage.plan.id,
		unlimited: usage.plan.unlimited,
		totalKeys: usage.summary.totalKeys,
		activeKeys: usage.summary.activeKeys,
		accountQuota
	};

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
			recentSuccessRequests: key.recent.filter(
				(record) => record.statusCode !== null && record.statusCode < 400
			).length,
			recentErrorRequests: key.recent.filter(
				(record) => record.statusCode !== null && record.statusCode >= 400
			).length,
			recentPendingRequests: key.recent.filter((record) => record.statusCode === null).length,
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
		usageStats,
		currentStats: usageStats,
		bounds: {
			windowDays: usage.window.days,
			recordLimit: usage.window.recordLimit,
			seriesTruncated: usage.window.truncated || usage.keys.some((key) => key.windowTruncated),
			keyLimit: usage.bounds.keyLimit,
			keysTruncated: usage.bounds.keysTruncated,
			recentPerKey: usage.bounds.recentPerKey
		}
	};
}
