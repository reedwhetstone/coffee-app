<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	let { data } = $props<{ data: PageData }>();

	// Set page title
	onMount(() => {
		document.title = 'API Dashboard - Purveyors';
	});
</script>

<svelte:head>
	<title>API Dashboard - Purveyors</title>
	<meta name="description" content="Manage your Purveyors API keys and monitor usage" />
</svelte:head>

<div class="min-h-screen bg-background-primary-light">
	<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
		<!-- Header -->
		<div class="mb-8">
			<h1 class="text-3xl font-bold tracking-tight text-text-primary-light">API Dashboard</h1>
			<p class="mt-2 text-lg text-text-secondary-light">
				Manage your API keys, monitor usage, and access documentation
			</p>
		</div>

		<!-- Quick Stats -->
		<div class="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
				<h3 class="text-sm font-medium text-text-secondary-light">API Keys</h3>
				<p class="mt-1 text-2xl font-bold text-text-primary-light">
					{data.apiKeys?.length || 0}
				</p>
				<p class="mt-1 text-xs text-text-secondary-light">Active keys</p>
			</div>

			<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
				<h3 class="text-sm font-medium text-text-secondary-light">This Month</h3>
				<p class="mt-1 text-2xl font-bold text-green-500">0</p>
				<p class="mt-1 text-xs text-text-secondary-light">API requests</p>
			</div>

			<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
				<h3 class="text-sm font-medium text-text-secondary-light">Rate Limit</h3>
				<p class="mt-1 text-2xl font-bold text-blue-500">10,000</p>
				<p class="mt-1 text-xs text-text-secondary-light">Requests/month</p>
			</div>

			<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
				<h3 class="text-sm font-medium text-text-secondary-light">Status</h3>
				<p class="mt-1 text-2xl font-bold text-green-500">Active</p>
				<p class="mt-1 text-xs text-text-secondary-light">API subscription</p>
			</div>
		</div>

		<!-- Navigation Tabs -->
		<div class="mb-8">
			<nav class="flex space-x-8" aria-label="Tabs">
				<a
					href="/api-dashboard"
					class="border-b-2 border-background-tertiary-light px-1 py-2 text-sm font-medium text-background-tertiary-light"
					aria-current="page"
				>
					Overview
				</a>
				<a
					href="/api-dashboard/keys"
					class="border-b-2 border-transparent px-1 py-2 text-sm font-medium text-text-secondary-light hover:border-text-secondary-light hover:text-text-primary-light"
				>
					API Keys
				</a>
				<a
					href="/api-dashboard/usage"
					class="border-b-2 border-transparent px-1 py-2 text-sm font-medium text-text-secondary-light hover:border-text-secondary-light hover:text-text-primary-light"
				>
					Usage Analytics
				</a>
				<a
					href="/api-dashboard/docs"
					class="border-b-2 border-transparent px-1 py-2 text-sm font-medium text-text-secondary-light hover:border-text-secondary-light hover:text-text-primary-light"
				>
					Documentation
				</a>
			</nav>
		</div>

		<!-- Main Content -->
		<div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
			<!-- Recent API Keys -->
			<div class="rounded-lg bg-background-secondary-light p-6 ring-1 ring-border-light">
				<div class="mb-4 flex items-center justify-between">
					<h2 class="text-lg font-semibold text-text-primary-light">API Keys</h2>
					<button
						onclick={() => goto('/api-dashboard/keys')}
						class="rounded-md bg-background-tertiary-light px-3 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-opacity-90"
					>
						Manage Keys
					</button>
				</div>

				{#if data.apiKeys && data.apiKeys.length > 0}
					<div class="space-y-3">
						{#each data.apiKeys.slice(0, 3) as apiKey}
							<div
								class="flex items-center justify-between rounded-md bg-background-primary-light p-3"
							>
								<div>
									<p class="font-medium text-text-primary-light">{apiKey.name}</p>
									<p class="text-sm text-text-secondary-light">
										Created {new Date(apiKey.created_at).toLocaleDateString()}
									</p>
								</div>
								<div class="flex items-center">
									{#if apiKey.is_active}
										<span
											class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800"
										>
											Active
										</span>
									{:else}
										<span
											class="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800"
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
						<p class="mb-4 text-text-secondary-light">No API keys created yet</p>
						<button
							onclick={() => goto('/api-dashboard/keys')}
							class="rounded-md bg-background-tertiary-light px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-opacity-90"
						>
							Create Your First API Key
						</button>
					</div>
				{/if}
			</div>

			<!-- Quick Start Guide -->
			<div class="rounded-lg bg-background-secondary-light p-6 ring-1 ring-border-light">
				<h2 class="mb-4 text-lg font-semibold text-text-primary-light">Quick Start</h2>
				<div class="space-y-4">
					<div class="flex items-start">
						<div
							class="flex h-6 w-6 items-center justify-center rounded-full bg-background-tertiary-light text-xs font-medium text-white"
						>
							1
						</div>
						<div class="ml-3">
							<p class="text-sm font-medium text-text-primary-light">Create an API Key</p>
							<p class="text-sm text-text-secondary-light">
								Generate your first API key to start making requests
							</p>
						</div>
					</div>

					<div class="flex items-start">
						<div
							class="flex h-6 w-6 items-center justify-center rounded-full bg-background-tertiary-light text-xs font-medium text-white"
						>
							2
						</div>
						<div class="ml-3">
							<p class="text-sm font-medium text-text-primary-light">Make Your First Request</p>
							<p class="text-sm text-text-secondary-light">
								Use the catalog API to fetch coffee data
							</p>
						</div>
					</div>

					<div class="flex items-start">
						<div
							class="flex h-6 w-6 items-center justify-center rounded-full bg-background-tertiary-light text-xs font-medium text-white"
						>
							3
						</div>
						<div class="ml-3">
							<p class="text-sm font-medium text-text-primary-light">Monitor Usage</p>
							<p class="text-sm text-text-secondary-light">Track your API usage and performance</p>
						</div>
					</div>
				</div>

				<div class="mt-6">
					<button
						onclick={() => goto('/api-dashboard/docs')}
						class="w-full rounded-md border border-background-tertiary-light px-4 py-2 text-sm font-medium text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white"
					>
						View Documentation
					</button>
				</div>
			</div>
		</div>

		{#if data.error}
			<div class="mt-8 rounded-md bg-red-50 p-4">
				<div class="text-sm text-red-700">{data.error}</div>
			</div>
		{/if}
	</div>
</div>

<style>
	/* Custom styles for the API dashboard */
</style>
