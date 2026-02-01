<script lang="ts">
	import type { ComponentType, Snippet } from 'svelte';

	let {
		state,
		error = null,
		emptyMessage = 'No data available',
		emptySubMessage = 'Try refreshing the page or check back later',
		skeletonComponent = null,
		retryable = true,
		onretry = undefined,
		children = undefined
	} = $props<{
		state: 'loading' | 'error' | 'empty' | 'success';
		error?: string | null;
		emptyMessage?: string;
		emptySubMessage?: string;
		skeletonComponent?: ComponentType | null;
		retryable?: boolean;
		onretry?: (() => void) | undefined;
		children?: Snippet;
	}>();

	function handleRetry() {
		onretry?.();
	}

	function handleReload() {
		window.location.reload();
	}
</script>

{#if state === 'loading'}
	{#if skeletonComponent}
		<skeletonComponent></skeletonComponent>
	{:else}
		<!-- Default loading skeleton -->
		<div class="animate-pulse">
			<div class="mb-6">
				<div class="mb-2 h-8 w-48 rounded bg-background-tertiary-light opacity-50"></div>
				<div class="h-4 w-96 rounded bg-background-tertiary-light opacity-30"></div>
			</div>
			<div class="space-y-4">
				{#each Array(3) as _, i (i)}
					<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
						<div class="mb-2 h-6 w-1/4 rounded bg-background-tertiary-light opacity-50"></div>
						<div class="mb-2 h-4 w-3/4 rounded bg-background-tertiary-light opacity-30"></div>
						<div class="h-4 w-1/2 rounded bg-background-tertiary-light opacity-30"></div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
{:else if state === 'error'}
	<div class="rounded-lg bg-red-50 p-6 text-center ring-1 ring-red-200">
		<div class="mb-4 text-6xl opacity-50">⚠️</div>
		<h3 class="mb-2 text-lg font-semibold text-red-900">Failed to load data</h3>
		<p class="mb-4 text-red-700">{error || 'An unexpected error occurred'}</p>
		<div class="flex flex-col gap-3 sm:flex-row sm:justify-center">
			{#if retryable}
				<button
					onclick={handleRetry}
					class="rounded-md bg-red-600 px-4 py-2 font-medium text-white transition-all duration-200 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
				>
					Try Again
				</button>
			{/if}
			<button
				onclick={handleReload}
				class="rounded-md border border-red-600 px-4 py-2 font-medium text-red-600 transition-all duration-200 hover:bg-red-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
			>
				Reload Page
			</button>
		</div>
	</div>
{:else if state === 'empty'}
	<div class="rounded-lg bg-background-secondary-light p-8 text-center ring-1 ring-border-light">
		<div class="mb-4 text-6xl opacity-50">📂</div>
		<h3 class="mb-2 text-lg font-semibold text-text-primary-light">{emptyMessage}</h3>
		<p class="mb-4 text-text-secondary-light">{emptySubMessage}</p>
		{@render children?.()}
	</div>
{/if}
