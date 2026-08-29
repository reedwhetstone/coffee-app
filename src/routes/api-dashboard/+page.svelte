<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	let { data } = $props<{ data: PageData }>();

	// Set page title
	onMount(() => {
		document.title = 'Parchment Console - Purveyors';
	});
</script>

<svelte:head>
	<title>Parchment Console - Purveyors</title>
	<meta
		name="description"
		content="Manage your Parchment API keys, usage, and plan details in Parchment Console"
	/>
</svelte:head>

<div class="min-h-screen bg-surface-canvas">
	<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
		<!-- Header -->
		<div class="mb-8">
			<h1 class="text-3xl font-bold tracking-tight text-ink">Parchment Console</h1>
			<p class="mt-2 text-lg text-muted">
				Manage your API keys, monitor usage, and stay aligned with your Green, Origin, or Enterprise
				tier
			</p>
		</div>

		{#if data.error}
			<div class="mb-8 rounded-md bg-danger-subtle p-4 ring-1 ring-danger/30">
				<div class="text-sm text-danger">
					{data.error}. Account usage and quota status are currently unavailable.
				</div>
			</div>
		{/if}

		<!-- Quick Stats -->
		{#if data.usageStats}
			<div class="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<div class="rounded-lg bg-surface-panel p-4 ring-1 ring-line">
					<h3 class="text-sm font-medium text-muted">API Keys</h3>
					<p class="mt-1 text-2xl font-bold text-ink">
						{data.usageStats.totalKeys.toLocaleString()}
					</p>
					<p class="mt-1 text-xs text-muted">
						{data.usageStats.activeKeys.toLocaleString()} active
					</p>
				</div>

				<div class="rounded-lg bg-surface-panel p-4 ring-1 ring-line">
					<h3 class="text-sm font-medium text-muted">Owner Traffic This Month</h3>
					<p class="mt-1 text-2xl font-bold text-ink">
						{data.usageStats.monthlyUsage.toLocaleString()}
					</p>
					<p class="mt-1 text-xs text-muted">Aggregate traffic across all API keys</p>
				</div>

				<div class="rounded-lg bg-surface-panel p-4 ring-1 ring-line">
					<h3 class="text-sm font-medium text-muted">Current Tier</h3>
					<p class="mt-1 text-2xl font-bold tabular-nums text-ink">
						{#if data.usageStats.userTier === 'enterprise'}
							Enterprise
						{:else if data.usageStats.userTier === 'member'}
							Origin
						{:else}
							Green
						{/if}
					</p>
					<p class="mt-1 text-xs text-muted">
						{#if data.usageStats.userTier === 'enterprise'}
							Unlimited API calls
						{:else if data.usageStats.userTier === 'member'}
							Paid Origin tier
						{:else}
							Free Green tier
						{/if}
					</p>
				</div>

				<div class="rounded-lg bg-surface-panel p-4 ring-1 ring-line">
					<h3 class="text-sm font-medium text-muted">Highest Active-Key Quota</h3>
					<p
						class="mt-1 text-2xl font-bold {data.usageStats.highestKeyQuota?.atLimit
							? 'text-red-500'
							: data.usageStats.highestKeyQuota?.nearLimit
								? 'text-warning'
								: 'text-ink'}"
					>
						{#if data.usageStats.unlimited}
							Unlimited
						{:else if data.usageStats.quotaCoverage === 'keys_truncated'}
							Unavailable
						{:else if data.usageStats.activeKeys === 0}
							No active keys
						{:else if data.usageStats.highestKeyQuota?.atLimit}
							At Limit
						{:else if data.usageStats.highestKeyQuota?.nearLimit}
							Near Limit
						{:else if data.usageStats.highestKeyQuota}
							Active
						{:else}
							Unavailable
						{/if}
					</p>
					<p class="mt-1 text-xs text-muted">
						{#if data.usageStats.quotaCoverage === 'keys_truncated'}
							Some keys were omitted; quota comparison is suppressed
						{:else if data.usageStats.highestKeyQuota}
							{data.usageStats.highestKeyQuota.keyName}:
							{Math.round(data.usageStats.highestKeyQuota.monthlyPercent)}%
						{:else}
							Per-key monthly limit
						{/if}
					</p>
				</div>
			</div>
		{/if}

		<!-- Navigation Tabs -->
		<div class="mb-8">
			<nav class="flex space-x-8" aria-label="Tabs">
				<a
					href="/api-dashboard"
					class="border-b-2 border-accent px-1 py-2 text-sm font-medium text-accent"
					aria-current="page"
				>
					Overview
				</a>
				<a
					href="/api-dashboard/keys"
					class="border-b-2 border-transparent px-1 py-2 text-sm font-medium text-muted hover:border-muted hover:text-ink"
				>
					API Keys
				</a>
				<a
					href="/api-dashboard/usage"
					class="border-b-2 border-transparent px-1 py-2 text-sm font-medium text-muted hover:border-muted hover:text-ink"
				>
					Usage Analytics
				</a>
				<a
					href="/docs"
					class="border-b-2 border-transparent px-1 py-2 text-sm font-medium text-muted hover:border-muted hover:text-ink"
				>
					Documentation
				</a>
			</nav>
		</div>

		<!-- Main Content -->
		<div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
			<!-- Recent API Keys -->
			<div class="rounded-lg bg-surface-panel p-6 ring-1 ring-line">
				<div class="mb-4 flex items-center justify-between">
					<h2 class="text-lg font-semibold text-ink">API Keys</h2>
					<button
						onclick={() => goto('/api-dashboard/keys')}
						class="rounded-md bg-accent px-3 py-2 text-sm font-medium text-ink transition-all duration-200 hover:bg-opacity-90"
					>
						Manage Keys
					</button>
				</div>

				{#if data.error}
					<div class="py-8 text-center">
						<p class="text-muted">API key list unavailable</p>
						<p class="text-sm text-muted">Try refreshing the Console in a moment.</p>
					</div>
				{:else if data.apiKeys && data.apiKeys.length > 0}
					<div class="space-y-3">
						{#each data.apiKeys.slice(0, 3) as apiKey}
							<div class="flex items-center justify-between rounded-md bg-surface-canvas p-3">
								<div>
									<p class="font-medium text-ink">{apiKey.name}</p>
									<p class="text-sm text-muted">
										{apiKey.created_at
											? `Created ${new Date(apiKey.created_at).toLocaleDateString()}`
											: 'Creation date unavailable'}
									</p>
								</div>
								<div class="flex items-center">
									{#if apiKey.is_active}
										<span
											class="inline-flex items-center rounded-full bg-success-subtle px-2.5 py-0.5 text-xs font-medium text-success-strong"
										>
											Active
										</span>
									{:else}
										<span
											class="inline-flex items-center rounded-full bg-danger-subtle px-2.5 py-0.5 text-xs font-medium text-danger-strong"
										>
											Inactive
										</span>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div class="py-8 text-center">
						<p class="mb-4 text-muted">No API keys created yet</p>
						<button
							onclick={() => goto('/api-dashboard/keys')}
							class="rounded-md bg-accent px-4 py-2 text-sm font-medium text-ink transition-all duration-200 hover:bg-opacity-90"
						>
							Create Your First API Key
						</button>
					</div>
				{/if}
			</div>

			<!-- Quick Start Guide -->
			<div class="rounded-lg bg-surface-panel p-6 ring-1 ring-line">
				<h2 class="mb-4 text-lg font-semibold text-ink">Quick Start</h2>
				<div class="space-y-4">
					<div class="flex items-start">
						<div
							class="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-medium text-ink"
						>
							1
						</div>
						<div class="ml-3">
							<p class="text-sm font-medium text-ink">Create an API Key</p>
							<p class="text-sm text-muted">
								Generate your first API key to start using the Parchment API
							</p>
						</div>
					</div>

					<div class="flex items-start">
						<div
							class="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-medium text-ink"
						>
							2
						</div>
						<div class="ml-3">
							<p class="text-sm font-medium text-ink">Make Your First Request</p>
							<p class="text-sm text-muted">Use the Parchment API catalog to fetch coffee data</p>
						</div>
					</div>

					<div class="flex items-start">
						<div
							class="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-medium text-ink"
						>
							3
						</div>
						<div class="ml-3">
							<p class="text-sm font-medium text-ink">Monitor Usage</p>
							<p class="text-sm text-muted">Track your Parchment API usage and performance</p>
						</div>
					</div>
				</div>

				<div class="mt-6">
					<button
						onclick={() => {
							window.location.href = 'https://api.purveyors.io/docs';
						}}
						class="w-full rounded-md border border-accent px-4 py-2 text-sm font-medium text-accent transition-all duration-200 hover:bg-accent hover:text-white"
					>
						View Documentation
					</button>
				</div>
			</div>
		</div>

		<!-- Usage Accountability Alerts with Upgrade CTAs -->
		{#if data.usageStats?.highestKeyQuota}
			{#if data.usageStats.highestKeyQuota.atLimit}
				<div class="mt-8 rounded-md bg-danger-subtle p-4 ring-1 ring-danger/30">
					<div class="flex">
						<div class="flex-shrink-0">
							<svg class="h-5 w-5 text-danger" viewBox="0 0 20 20" fill="currentColor">
								<path
									fill-rule="evenodd"
									d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
									clip-rule="evenodd"
								/>
							</svg>
						</div>
						<div class="ml-3">
							<h3 class="text-sm font-medium text-danger-strong">Rate limit reached</h3>
							<div class="mt-2 text-sm text-danger">
								<p>
									{data.usageStats.highestKeyQuota.keyName} has reached
									{data.usageStats.highestKeyQuota.monthlyRequests.toLocaleString()} of its
									{data.usageStats.highestKeyQuota.monthlyLimitPerKey.toLocaleString()} monthly API calls.
									{#if data.usageStats.userTier === 'viewer'}
										Upgrade to Origin for 10,000 calls/month.
									{:else}
										Upgrade to Enterprise via sales if you need unlimited calls.
									{/if}
								</p>
								<div class="mt-3 flex space-x-4">
									<a
										href={data.usageStats.userTier === 'viewer'
											? '/subscription#api-plans'
											: '/contact'}
										class="font-medium text-danger-strong underline hover:text-danger"
									>
										{data.usageStats.userTier === 'viewer'
											? 'Upgrade to Origin →'
											: 'Contact sales →'}
									</a>
									<a
										href="/api-dashboard/usage"
										class="font-medium text-danger-strong underline hover:text-danger"
									>
										View usage analytics
									</a>
								</div>
							</div>
						</div>
					</div>
				</div>
			{:else if data.usageStats.highestKeyQuota.nearLimit}
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
							<h3 class="text-sm font-medium text-warning-strong">Approaching rate limit</h3>
							<div class="mt-2 text-sm text-warning-strong">
								<p>
									{data.usageStats.highestKeyQuota.keyName} is using
									{Math.round(data.usageStats.highestKeyQuota.monthlyPercent)}% of its
									{data.usageStats.highestKeyQuota.monthlyLimitPerKey.toLocaleString()} monthly API calls.
									{#if data.usageStats.userTier === 'viewer'}
										Consider upgrading to Origin for 10,000 calls/month.
									{:else}
										Contact sales to move from Origin to Enterprise for unlimited calls.
									{/if}
								</p>
								<div class="mt-3 flex space-x-4">
									<a
										href={data.usageStats.userTier === 'viewer'
											? '/subscription#api-plans'
											: '/contact'}
										class="font-medium text-warning-strong underline hover:text-warning"
									>
										{data.usageStats.userTier === 'viewer' ? 'Upgrade to Origin' : 'Contact sales'}
									</a>
									<a
										href="/api-dashboard/usage"
										class="font-medium text-warning-strong underline hover:text-warning"
									>
										View usage analytics
									</a>
									<a
										href="https://api.purveyors.io/docs"
										class="font-medium text-warning-strong underline hover:text-warning"
									>
										API documentation
									</a>
								</div>
							</div>
						</div>
					</div>
				</div>
			{:else if data.usageStats.highestKeyQuota.monthlyPercent >= 75}
				<!-- Upgrade CTA at 75% usage as specified in APITIER.md -->
				<div class="mt-8 rounded-md bg-info-subtle p-4 ring-1 ring-info/30">
					<div class="flex">
						<div class="flex-shrink-0">
							<svg class="h-5 w-5 text-info" viewBox="0 0 20 20" fill="currentColor">
								<path
									fill-rule="evenodd"
									d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
									clip-rule="evenodd"
								/>
							</svg>
						</div>
						<div class="ml-3">
							<h3 class="text-sm font-medium text-info-strong">Consider upgrading</h3>
							<div class="mt-2 text-sm text-info-strong">
								<p>
									{data.usageStats.highestKeyQuota.keyName} has used
									{Math.round(data.usageStats.highestKeyQuota.monthlyPercent)}% of its monthly API
									calls. Limits apply separately to each key.
									{#if data.usageStats.userTier === 'viewer'}
										Upgrade to Origin for 50x more calls and advanced features.
									{:else}
										Contact sales about Enterprise for unlimited calls and premium support.
									{/if}
								</p>
								<div class="mt-3">
									<a
										href={data.usageStats.userTier === 'viewer'
											? '/subscription#api-plans'
											: '/contact'}
										class="font-medium text-info-strong underline hover:text-info"
									>
										{data.usageStats.userTier === 'viewer'
											? 'View Origin plan options →'
											: 'Contact sales about Enterprise →'}
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
	/* Custom styles for Parchment Console */
</style>
