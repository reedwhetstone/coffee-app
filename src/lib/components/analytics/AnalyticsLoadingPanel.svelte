<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		ready = false,
		title,
		description = '',
		height = 'h-56',
		panelClass = '',
		children
	} = $props<{
		ready?: boolean;
		title: string;
		description?: string;
		height?: string;
		panelClass?: string;
		children: Snippet;
	}>();
</script>

{#if ready}
	{@render children()}
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
