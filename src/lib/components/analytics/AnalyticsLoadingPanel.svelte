<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		ready = false,
		title,
		description = '',
		height = 'h-56',
		panelClass = '',
		errorMessage = null,
		retryLabel = 'Retry loading',
		onRetry,
		children
	} = $props<{
		ready?: boolean;
		title: string;
		description?: string;
		height?: string;
		panelClass?: string;
		errorMessage?: string | null;
		retryLabel?: string;
		onRetry?: (() => void) | undefined;
		children: Snippet;
	}>();
</script>

{#if ready}
	{@render children()}
{:else if errorMessage}
	<div
		class={`rounded-lg border border-red-200 bg-background-primary-light p-6 shadow-sm ${panelClass}`.trim()}
		data-testid="analytics-error-panel"
		role="alert"
		aria-live="assertive"
	>
		<div class="flex items-center gap-2 text-sm font-medium text-red-600">
			<span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-xs"
				>!</span
			>
			<span>We hit a snag loading this market view.</span>
		</div>
		<h2 class="mt-3 text-xl font-semibold text-text-primary-light">{title}</h2>
		<p class="mt-1 text-sm text-text-secondary-light">{errorMessage}</p>
		{#if onRetry}
			<button
				type="button"
				onclick={onRetry}
				class="mt-4 inline-flex items-center rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-300"
			>
				{retryLabel}
			</button>
		{/if}
	</div>
{:else}
	<div
		class={`rounded-lg border border-border-light bg-background-primary-light p-6 shadow-sm ${panelClass}`.trim()}
		data-testid="analytics-loading-panel"
		aria-busy="true"
		aria-live="polite"
	>
		<div class="flex items-center gap-2 text-sm font-medium text-background-tertiary-light">
			<span class="h-2.5 w-2.5 animate-pulse rounded-full bg-background-tertiary-light"></span>
			<span>Loading live market view…</span>
		</div>
		<h2 class="mt-3 text-xl font-semibold text-text-primary-light">{title}</h2>
		{#if description}
			<p class="mt-1 text-sm text-text-secondary-light">{description}</p>
		{/if}
		<div class={`mt-4 animate-pulse rounded-xl bg-background-secondary-light/80 ${height}`}></div>
	</div>
{/if}
