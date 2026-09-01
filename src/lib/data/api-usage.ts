import type { OwnerApiUsage } from '@purveyors/sdk';

type CompatibleOwnerApiUsage = Omit<OwnerApiUsage, 'plan' | 'summary'> & {
	plan: Omit<OwnerApiUsage['plan'], 'limitScope'> & {
		/** Canonical account-scoped limit from the newer Parchment contract. */
		monthlyRequestLimit?: number;
		/** Used to reject legacy per-key quota responses during deployment. */
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

function accountQuotaStatus(usage: CompatibleOwnerApiUsage): AccountQuotaStatus {
	const monthlyLimit = usage.plan.monthlyRequestLimit;
	if (
		usage.plan.limitScope !== 'account' ||
		typeof monthlyLimit !== 'number' ||
		(monthlyLimit !== -1 && monthlyLimit <= 0) ||
		typeof usage.plan.collectionItemLimit !== 'number' ||
		typeof usage.summary.monthlyRequestsRemaining !== 'number' ||
		typeof usage.summary.monthlyResetAt !== 'string'
	) {
		throw new Error('Parchment usage response does not include the account quota contract');
	}
	const unlimited = usage.plan.unlimited || monthlyLimit === -1;
	const monthlyRequestsRemaining = unlimited ? null : usage.summary.monthlyRequestsRemaining;
	const monthlyPercent = unlimited
		? null
		: Math.min((usage.summary.monthlyRequests / monthlyLimit) * 100, 100);

	return {
		monthlyRequests: usage.summary.monthlyRequests,
		monthlyLimit,
		monthlyRequestsRemaining,
		monthlyPercent,
		monthlyResetAt: usage.summary.monthlyResetAt,
		collectionItemLimit: usage.plan.collectionItemLimit,
		limitScope: 'account',
		nearLimit: monthlyPercent !== null && monthlyPercent >= 80,
		atLimit: monthlyPercent !== null && monthlyPercent >= 100
	};
}

/**
 * Adapt Parchment's owner traffic response for Console presentation. The new
 * contract exposes canonical account fields. Legacy per-key contracts fail
 * closed so the Console never relabels a per-key allowance as account-scoped.
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
