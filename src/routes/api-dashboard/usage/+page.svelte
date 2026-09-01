<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';

	let { data } = $props<{ data: PageData }>();

	let accountUsagePercent = $derived(() => {
		return data.currentStats?.accountQuota.monthlyPercent ?? 0;
	});

	let tierDisplayName = $derived(() => {
		if (!data.currentStats) return 'Green';
		switch (data.currentStats.userTier) {
			case 'enterprise':
				return 'Enterprise';
			case 'member':
				return 'Origin';
			case 'viewer':
				return 'Green';
			default:
				return 'Green';
		}
	});

	// Format numbers with commas
	function formatNumber(num: number): string {
		return num.toLocaleString();
	}

	// Format date for display
	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric'
		});
	}

	function formatUtcReset(dateStr: string): string {
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			timeZone: 'UTC',
			timeZoneName: 'short'
		}).format(new Date(dateStr));
	}

	function formatCollectionLimit(limit: number | null | undefined): string {
		return limit !== null && limit !== undefined && limit > 0
			? `Up to ${formatNumber(limit)} items`
			: 'Endpoint limit';
	}

	onMount(() => {
		document.title = 'Usage Analytics - Parchment Console';
	});
</script>

<svelte:head>
	<title>Usage Analytics - Parchment Console</title>
	<meta
		name="description"
		content="Monitor your Parchment API usage, performance metrics, and plan limits"
	/>
</svelte:head>

<div class="min-h-screen bg-surface-canvas">
	<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
		<!-- Header -->
		<div class="mb-8">
			<nav class="mb-4">
				<a href="/api-dashboard" class="text-sm text-muted hover:text-ink">
					← Back to Parchment Console
				</a>
			</nav>
			<h1 class="text-3xl font-bold tracking-tight text-ink">Usage Analytics</h1>
			<p class="mt-2 text-lg text-muted">
				Monitor your Parchment API usage, performance metrics, and plan limits
			</p>
		</div>

		{#if data.error}
			<div class="mb-8 rounded-md bg-danger-subtle p-4 ring-1 ring-danger/30">
				<div class="text-sm text-danger">{data.error}</div>
			</div>
		{:else}
			{#if data.bounds?.seriesTruncated}
				<div class="mb-8 rounded-md bg-warning-subtle p-4 text-sm text-warning-strong">
					Daily and recent activity are partial because the analytics window reached its safety
					limit. The account quota total and monthly per-key attribution counts remain exact.
				</div>
			{/if}
			{#if data.bounds?.keysTruncated}
				<div class="mb-8 rounded-md bg-warning-subtle p-4 text-sm text-warning-strong">
					At most {data.bounds.keyLimit.toLocaleString()} API keys are shown. Some attribution rows were
					omitted, but the exact account quota still includes every key.
				</div>
			{/if}

			<!-- Usage Overview Cards -->
			<div class="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<!-- Monthly account quota -->
				<div class="rounded-lg bg-surface-panel p-4 ring-1 ring-line">
					<h3 class="text-sm font-medium text-muted">Monthly Account Quota</h3>
					<p class="mt-1 text-2xl font-bold text-ink">
						{formatNumber(data.currentStats?.accountQuota.monthlyRequests ?? 0)} /
						{data.currentStats?.unlimited
							? 'Unlimited'
							: formatNumber(data.currentStats?.accountQuota.monthlyLimit ?? 0)}
					</p>
					<p class="mt-2 text-xs text-muted">
						{#if data.currentStats?.accountQuota.monthlyPercent !== null}
							{Math.round(data.currentStats?.accountQuota.monthlyPercent ?? 0)}% used.
						{/if}
						One allowance is shared across every API key.
					</p>
				</div>

				<!-- Remaining -->
				<div class="rounded-lg bg-surface-panel p-4 ring-1 ring-line">
					<h3 class="text-sm font-medium text-muted">Requests Remaining</h3>
					<p class="mt-1 text-2xl font-bold tabular-nums text-ink">
						{data.currentStats?.unlimited
							? 'Unlimited'
							: formatNumber(data.currentStats?.accountQuota.monthlyRequestsRemaining ?? 0)}
					</p>
					<p class="mt-2 text-xs text-muted">{tierDisplayName()} plan, account scoped</p>
				</div>

				<!-- Reset -->
				<div class="rounded-lg bg-surface-panel p-4 ring-1 ring-line">
					<h3 class="text-sm font-medium text-muted">Quota Resets</h3>
					<p class="mt-1 text-lg font-bold tabular-nums text-ink">
						{data.currentStats
							? formatUtcReset(data.currentStats.accountQuota.monthlyResetAt)
							: 'Unavailable'}
					</p>
					<p class="mt-2 text-xs text-muted">00:00 UTC on the first day of each month</p>
				</div>

				<!-- Collection cap -->
				<div class="rounded-lg bg-surface-panel p-4 ring-1 ring-line">
					<h3 class="text-sm font-medium text-muted">Collection Responses</h3>
					<p class="mt-1 text-2xl font-bold tabular-nums text-ink">
						{formatCollectionLimit(data.currentStats?.accountQuota.collectionItemLimit)}
					</p>
					<p class="mt-2 text-xs text-muted">
						Aggregates use their documented endpoint-specific bounds
					</p>
				</div>
			</div>

			<!-- Usage Chart and Recent Activity -->
			<div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
				<!-- Daily Usage Chart -->
				<div class="rounded-lg bg-surface-panel p-6 ring-1 ring-line">
					<h2 class="mb-4 text-lg font-semibold text-ink">
						Daily Usage (Last {data.bounds?.windowDays ?? 30} Days)
					</h2>
					{#if data.dailySummary && data.dailySummary.length > 0}
						<div class="space-y-3">
							{#each data.dailySummary as day}
								<div class="flex items-center justify-between">
									<div class="flex items-center space-x-3">
										<span class="w-16 text-sm font-medium text-ink">
											{formatDate(day.date)}
										</span>
										<div class="flex-1">
											<div class="h-6 w-full rounded-full bg-surface-canvas">
												<div
													class="h-6 rounded-full bg-accent transition-all duration-300"
													style="width: {Math.min((day.total_requests / 500) * 100, 100)}%"
												></div>
											</div>
										</div>
									</div>
									<div class="text-right">
										<div class="text-sm font-medium text-ink">
											{formatNumber(day.total_requests)}
										</div>
										<div class="text-xs text-muted">
											{day.error_requests > 0 ? `${day.error_requests} errors` : 'No errors'}
										</div>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="py-8 text-center">
							<p class="text-muted">No usage data available yet</p>
							<p class="text-sm text-muted">Start making Parchment API calls to see analytics</p>
						</div>
					{/if}
				</div>

				<!-- API Keys Usage Breakdown -->
				<div class="rounded-lg bg-surface-panel p-6 ring-1 ring-line">
					<h2 class="mb-4 text-lg font-semibold text-ink">Usage by API Key</h2>
					<p class="mb-4 text-xs text-muted">
						These counts attribute account traffic to individual credentials. They are not separate
						allowances, and creating another key does not increase the account quota.
						<br /><br />
						Recent activity is a sample of up to {data.bounds?.recentPerKey ?? 25} records per returned
						key. Monthly request counts are exact.
					</p>
					{#if data.usageData && data.usageData.length > 0}
						<div class="space-y-4">
							{#each data.usageData as keyUsage}
								<div class="rounded-md bg-surface-canvas p-4">
									<div class="mb-2 flex items-center justify-between">
										<h3 class="font-medium text-ink">{keyUsage.keyName}</h3>
										<span class="text-sm text-muted">
											{formatNumber(keyUsage.monthlyRequests)} this month
										</span>
									</div>
									{#if keyUsage.usage && keyUsage.usage.length > 0}
										<div class="text-xs text-muted">
											{keyUsage.usage[0].timestamp
												? `Last used: ${new Date(keyUsage.usage[0].timestamp).toLocaleDateString()}`
												: 'Last-used time unavailable'}
										</div>
										<div class="mt-2 flex items-center space-x-4">
											<div class="flex items-center space-x-1">
												<div class="h-2 w-2 rounded-full bg-success"></div>
												<span class="text-xs text-muted">
													{keyUsage.recentSuccessRequests} recent success
												</span>
											</div>
											<div class="flex items-center space-x-1">
												<div class="h-2 w-2 rounded-full bg-danger"></div>
												<span class="text-xs text-muted">
													{keyUsage.recentErrorRequests} recent errors
												</span>
											</div>
											{#if keyUsage.recentPendingRequests > 0}
												<div class="flex items-center space-x-1">
													<div class="h-2 w-2 rounded-full bg-warning"></div>
													<span class="text-xs text-muted">
														{keyUsage.recentPendingRequests} pending
													</span>
												</div>
											{/if}
										</div>
									{:else}
										<div class="text-xs text-muted">No recent usage</div>
									{/if}
								</div>
							{/each}
						</div>
					{:else}
						<div class="py-8 text-center">
							<p class="text-muted">No API keys found</p>
							<a
								href="/api-dashboard/keys"
								class="mt-2 inline-block text-sm text-accent hover:underline"
							>
								Create your first API key
							</a>
						</div>
					{/if}
				</div>
			</div>

			<!-- Account quota status with upgrade CTAs -->
			{#if data.currentStats && accountUsagePercent() >= 75}
				<div class="mt-8 rounded-md bg-warning-subtle p-4 ring-1 ring-warning/30">
					<div class="flex">
						<div class="flex-shrink-0">
							<svg class="h-5 w-5 text-warning" viewBox="0 0 20 20" fill="currentColor">
								<path
									fill-rule="evenodd"
									d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
									clip-rule="evenodd"
								/>
							</svg>
						</div>
						<div class="ml-3">
							<h3 class="text-sm font-medium text-warning-strong">
								{#if accountUsagePercent() >= 100}
									Rate Limit Reached
								{:else}
									Approaching Rate Limit
								{/if}
							</h3>
							<div class="mt-2 text-sm text-warning-strong">
								<p>
									This account has used {formatNumber(
										data.currentStats.accountQuota.monthlyRequests
									)}
									of {formatNumber(data.currentStats.accountQuota.monthlyLimit)} requests.
									{formatNumber(data.currentStats.accountQuota.monthlyRequestsRemaining ?? 0)} remain
									until
									{formatUtcReset(data.currentStats.accountQuota.monthlyResetAt)}. All API keys
									share this monthly allowance.
									{#if data.currentStats?.userTier === 'viewer'}
										Upgrade to Origin for 10,000 requests per account per month.
									{:else}
										Contact sales about Enterprise for unlimited calls and premium support.
									{/if}
								</p>
								<div class="mt-3 flex space-x-4">
									<a
										href={data.currentStats?.userTier === 'viewer'
											? '/subscription#api-plans'
											: '/contact'}
										class="font-medium text-warning-strong underline hover:text-warning"
									>
										{data.currentStats?.userTier === 'viewer'
											? 'Upgrade to Origin'
											: 'Contact sales'}
									</a>
									<a
										href="/api-dashboard"
										class="font-medium text-warning-strong underline hover:text-warning"
									>
										Back to Parchment Console
									</a>
								</div>
							</div>
						</div>
					</div>
				</div>
			{/if}
		{/if}
	</div>
</div>

<style>
	/* Custom styles for usage analytics */
</style>
