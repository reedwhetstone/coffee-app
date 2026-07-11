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
				<div class="mb-2 h-8 w-48 rounded bg-accent opacity-50"></div>
				<div class="h-4 w-96 rounded bg-accent opacity-30"></div>
			</div>
			<div class="space-y-4">
				{#each Array(3) as _, i (i)}
					<div class="rounded-lg bg-surface-panel p-4 ring-1 ring-line">
						<div class="mb-2 h-6 w-1/4 rounded bg-accent opacity-50"></div>
						<div class="mb-2 h-4 w-3/4 rounded bg-accent opacity-30"></div>
						<div class="h-4 w-1/2 rounded bg-accent opacity-30"></div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
{:else if state === 'error'}
	<div class="rounded-lg bg-danger-subtle p-6 text-center ring-1 ring-danger/30">
		<div class="mb-4 text-6xl opacity-50">⚠️</div>
		<h3 class="mb-2 text-lg font-semibold text-danger-strong">Failed to load data</h3>
		<p class="mb-4 text-danger-strong">{error || 'An unexpected error occurred'}</p>
		<div class="flex flex-col gap-3 sm:flex-row sm:justify-center">
			{#if retryable}
				<button
					onclick={handleRetry}
					class="rounded-md bg-danger px-4 py-2 font-medium text-white transition-all duration-200 hover:bg-danger-strong focus:outline-none focus:ring-2 focus:ring-danger focus:ring-offset-2"
				>
					Try Again
				</button>
			{/if}
			<button
				onclick={handleReload}
				class="rounded-md border border-danger px-4 py-2 font-medium text-danger transition-all duration-200 hover:bg-danger-strong hover:text-white focus:outline-none focus:ring-2 focus:ring-danger focus:ring-offset-2"
			>
				Reload Page
			</button>
		</div>
	</div>
{:else if state === 'empty'}
	<div class="rounded-lg bg-surface-panel p-8 text-center ring-1 ring-line">
		<div class="mb-4 text-6xl opacity-50">📂</div>
		<h3 class="mb-2 text-lg font-semibold text-ink">{emptyMessage}</h3>
		<p class="mb-4 text-muted">{emptySubMessage}</p>
		{@render children?.()}
	</div>
{/if}
