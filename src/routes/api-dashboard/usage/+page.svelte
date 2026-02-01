<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';

	let { data } = $props<{ data: PageData }>();

	// Calculate usage percentages based on user's actual tier
	let monthlyUsagePercent = $derived(() => {
		if (!data.currentStats || data.currentStats.monthlyLimit === -1) return 0;
		return Math.min((data.currentStats.monthlyUsage / data.currentStats.monthlyLimit) * 100, 100);
	});

	let tierDisplayName = $derived(() => {
		if (!data.currentStats) return 'Explorer';
		switch (data.currentStats.userTier) {
			case 'api-enterprise':
				return 'Enterprise';
			case 'api-member':
				return 'Roaster+';
			case 'viewer':
				return 'Explorer';
			default:
				return 'Explorer';
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

	// Get status color based on usage percentage
	function getUsageColor(percent: number): string {
		if (percent >= 90) return 'text-red-500';
		if (percent >= 75) return 'text-yellow-500';
		return 'text-green-500';
	}

	// Get background color for progress bars
	function getProgressColor(percent: number): string {
		if (percent >= 90) return 'bg-red-500';
		if (percent >= 75) return 'bg-yellow-500';
		return 'bg-green-500';
	}

	onMount(() => {
		document.title = 'Usage Analytics - API Dashboard';
	});
</script>

<svelte:head>
	<title>Usage Analytics - API Dashboard</title>
	<meta name="description" content="Monitor your API usage and performance metrics" />
</svelte:head>

<div class="min-h-screen bg-background-primary-light">
	<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
		<!-- Header -->
		<div class="mb-8">
			<nav class="mb-4">
				<a
					href="/api-dashboard"
					class="text-sm text-text-secondary-light hover:text-text-primary-light"
				>
					← Back to Dashboard
				</a>
			</nav>
			<h1 class="text-3xl font-bold tracking-tight text-text-primary-light">Usage Analytics</h1>
			<p class="mt-2 text-lg text-text-secondary-light">
				Monitor your API usage, performance metrics, and rate limits
			</p>
		</div>

		{#if data.error}
			<div class="mb-8 rounded-md bg-red-50 p-4 ring-1 ring-red-200">
				<div class="text-sm text-red-700">{data.error}</div>
			</div>
		{:else}
			<!-- Usage Overview Cards -->
			<div class="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<!-- Monthly Usage -->
				<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
					<h3 class="text-sm font-medium text-text-secondary-light">Monthly Usage</h3>
					<p class="mt-1 text-2xl font-bold {getUsageColor(monthlyUsagePercent())}">
						{formatNumber(data.currentStats?.monthlyUsage || 0)}
					</p>
					<div class="mt-2">
						<div class="flex items-center justify-between text-xs text-text-secondary-light">
							{#if data.currentStats?.monthlyLimit === -1}
								<span>Unlimited (Enterprise)</span>
								<span>∞</span>
							{:else}
								<span>of {formatNumber(data.currentStats?.monthlyLimit || 200)}</span>
								<span>{Math.round(monthlyUsagePercent())}%</span>
							{/if}
						</div>
						<div class="mt-1 h-2 w-full rounded-full bg-background-primary-light">
							{#if data.currentStats?.monthlyLimit === -1}
								<div class="h-2 w-full rounded-full bg-blue-500"></div>
							{:else}
								<div
									class="h-2 rounded-full transition-all duration-300 {getProgressColor(
										monthlyUsagePercent()
									)}"
									style="width: {monthlyUsagePercent()}%"
								></div>
							{/if}
						</div>
					</div>
				</div>

				<!-- Current Plan -->
				<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
					<h3 class="text-sm font-medium text-text-secondary-light">Current Plan</h3>
					<p class="mt-1 text-2xl font-bold text-blue-500">
						{tierDisplayName()}
					</p>
					<div class="mt-2">
						<div class="text-xs text-text-secondary-light">
							{#if data.currentStats?.userTier === 'api-enterprise'}
								Unlimited API calls
							{:else if data.currentStats?.userTier === 'api-member'}
								$99/month
							{:else}
								Free tier
							{/if}
						</div>
					</div>
				</div>

				<!-- Active Keys -->
				<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
					<h3 class="text-sm font-medium text-text-secondary-light">Active Keys</h3>
					<p class="mt-1 text-2xl font-bold text-blue-500">
						{data.currentStats?.activeKeys || 0}
					</p>
					<p class="mt-1 text-xs text-text-secondary-light">
						of {data.currentStats?.totalKeys || 0} total
					</p>
				</div>

				<!-- Average Response Time -->
				<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
					<h3 class="text-sm font-medium text-text-secondary-light">Avg Response</h3>
					<p class="mt-1 text-2xl font-bold text-purple-500">
						{data.dailySummary && data.dailySummary.length > 0
							? Math.round(data.dailySummary[0]?.avg_response_time || 0)
							: 0}ms
					</p>
					<p class="mt-1 text-xs text-text-secondary-light">Last 24 hours</p>
				</div>
			</div>

			<!-- Usage Chart and Recent Activity -->
			<div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
				<!-- Daily Usage Chart -->
				<div class="rounded-lg bg-background-secondary-light p-6 ring-1 ring-border-light">
					<h2 class="mb-4 text-lg font-semibold text-text-primary-light">
						Daily Usage (Last 30 Days)
					</h2>
					{#if data.dailySummary && data.dailySummary.length > 0}
						<div class="space-y-3">
							{#each data.dailySummary.slice(0, 10) as day}
								<div class="flex items-center justify-between">
									<div class="flex items-center space-x-3">
										<span class="w-16 text-sm font-medium text-text-primary-light">
											{formatDate(day.date)}
										</span>
										<div class="flex-1">
											<div class="h-6 w-full rounded-full bg-background-primary-light">
												<div
													class="h-6 rounded-full bg-background-tertiary-light transition-all duration-300"
													style="width: {Math.min((day.total_requests / 500) * 100, 100)}%"
												></div>
											</div>
										</div>
									</div>
									<div class="text-right">
										<div class="text-sm font-medium text-text-primary-light">
											{formatNumber(day.total_requests)}
										</div>
										<div class="text-xs text-text-secondary-light">
											{day.error_requests > 0 ? `${day.error_requests} errors` : 'No errors'}
										</div>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="py-8 text-center">
							<p class="text-text-secondary-light">No usage data available yet</p>
							<p class="text-sm text-text-secondary-light">
								Start making API calls to see analytics
							</p>
						</div>
					{/if}
				</div>

				<!-- API Keys Usage Breakdown -->
				<div class="rounded-lg bg-background-secondary-light p-6 ring-1 ring-border-light">
					<h2 class="mb-4 text-lg font-semibold text-text-primary-light">Usage by API Key</h2>
					{#if data.usageData && data.usageData.length > 0}
						<div class="space-y-4">
							{#each data.usageData as keyUsage}
								<div class="rounded-md bg-background-primary-light p-4">
									<div class="mb-2 flex items-center justify-between">
										<h3 class="font-medium text-text-primary-light">{keyUsage.keyName}</h3>
										<span class="text-sm text-text-secondary-light">
											{keyUsage.usage?.length || 0} requests
										</span>
									</div>
									{#if keyUsage.usage && keyUsage.usage.length > 0}
										<div class="text-xs text-text-secondary-light">
											Last used: {new Date(keyUsage.usage[0].timestamp).toLocaleDateString()}
										</div>
										<div class="mt-2 flex items-center space-x-4">
											<div class="flex items-center space-x-1">
												<div class="h-2 w-2 rounded-full bg-green-500"></div>
												<span class="text-xs text-text-secondary-light">
													{keyUsage.usage.filter(
														(u: Record<string, unknown>) => (u.status_code as number) < 400
													).length} success
												</span>
											</div>
											<div class="flex items-center space-x-1">
												<div class="h-2 w-2 rounded-full bg-red-500"></div>
												<span class="text-xs text-text-secondary-light">
													{keyUsage.usage.filter(
														(u: Record<string, unknown>) => (u.status_code as number) >= 400
													).length} errors
												</span>
											</div>
										</div>
									{:else}
										<div class="text-xs text-text-secondary-light">No recent usage</div>
									{/if}
								</div>
							{/each}
						</div>
					{:else}
						<div class="py-8 text-center">
							<p class="text-text-secondary-light">No API keys found</p>
							<a
								href="/api-dashboard/keys"
								class="mt-2 inline-block text-sm text-background-tertiary-light hover:underline"
							>
								Create your first API key
							</a>
						</div>
					{/if}
				</div>
			</div>

			<!-- Rate Limit Status with Upgrade CTAs -->
			{#if data.currentStats?.userTier !== 'api-enterprise' && monthlyUsagePercent() >= 75}
				<div class="mt-8 rounded-md bg-yellow-50 p-4 ring-1 ring-yellow-200">
					<div class="flex">
						<div class="flex-shrink-0">
							<svg class="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
								<path
									fill-rule="evenodd"
									d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
									clip-rule="evenodd"
								/>
							</svg>
						</div>
						<div class="ml-3">
							<h3 class="text-sm font-medium text-yellow-800">
								{#if monthlyUsagePercent() >= 95}
									Rate Limit Reached
								{:else}
									Approaching Rate Limit
								{/if}
							</h3>
							<div class="mt-2 text-sm text-yellow-700">
								<p>
									You've used {Math.round(monthlyUsagePercent())}% of your {formatNumber(
										data.currentStats?.monthlyLimit || 200
									)} monthly API calls.
									{#if data.currentStats?.userTier === 'viewer'}
										Upgrade to Roaster+ for 10,000 calls/month and advanced features.
									{:else}
										Upgrade to Enterprise for unlimited calls and premium support.
									{/if}
								</p>
								<div class="mt-3 flex space-x-4">
									<a
										href="/subscription"
										class="font-medium text-yellow-800 underline hover:text-yellow-600"
									>
										Upgrade Plan
									</a>
									<a
										href="/api-dashboard"
										class="font-medium text-yellow-800 underline hover:text-yellow-600"
									>
										Back to Dashboard
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
