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
		class={`rounded-lg border border-danger/30 bg-surface-canvas p-6 shadow-sm ${panelClass}`.trim()}
		data-testid="analytics-error-panel"
		role="alert"
		aria-live="assertive"
	>
		<div class="flex items-center gap-2 text-sm font-medium text-danger">
			<span
				class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-danger-subtle text-xs"
				>!</span
			>
			<span>We hit a snag loading this market view.</span>
		</div>
		<h2 class="mt-3 text-xl font-semibold text-ink">{title}</h2>
		<p class="mt-1 text-sm text-muted">{errorMessage}</p>
		{#if onRetry}
			<button
				type="button"
				onclick={onRetry}
				class="mt-4 inline-flex items-center rounded-full border border-danger/30 bg-danger-subtle px-4 py-2 text-sm font-medium text-danger-strong transition hover:bg-danger/15 focus:outline-none focus:ring-2 focus:ring-danger/40"
			>
				{retryLabel}
			</button>
		{/if}
	</div>
{:else}
	<div
		class={`rounded-lg border border-line bg-surface-canvas p-6 shadow-sm ${panelClass}`.trim()}
		data-testid="analytics-loading-panel"
		aria-busy="true"
		aria-live="polite"
	>
		<div class="flex items-center gap-2 text-sm font-medium text-accent">
			<span class="h-2.5 w-2.5 animate-pulse rounded-full bg-accent"></span>
			<span>Loading live market view…</span>
		</div>
		<h2 class="mt-3 text-xl font-semibold text-ink">{title}</h2>
		{#if description}
			<p class="mt-1 text-sm text-muted">{description}</p>
		{/if}
		<div class={`mt-4 animate-pulse rounded-xl bg-surface-panel/80 ${height}`}></div>
	</div>
{/if}
