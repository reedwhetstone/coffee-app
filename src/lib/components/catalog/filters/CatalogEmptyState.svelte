<script lang="ts">
	import {
		suggestFilterRemovals,
		type FilterRemovalSuggestion
	} from '$lib/catalog/emptyStateSuggestions';
	import type { ActiveCatalogFilter, CatalogFilterSnapshot } from '$lib/catalog/filterModel';

	/**
	 * Shown when no coffee matches. With filters active it says which single
	 * filter to remove to see coffees again, and how many.
	 */
	interface Props {
		filters: ActiveCatalogFilter[];
		snapshot: CatalogFilterSnapshot;
		onRemove: (filter: ActiveCatalogFilter) => void;
		onClearAll: () => void;
	}

	let { filters, snapshot, onRemove, onClearAll }: Props = $props();

	let suggestions = $state.raw<FilterRemovalSuggestion[] | null>(null);

	$effect(() => {
		const current = filters;
		const state = snapshot;
		suggestions = null;
		if (current.length === 0) return;
		const controller = new AbortController();
		suggestFilterRemovals(state, current, controller.signal).then((found) => {
			if (!controller.signal.aborted) suggestions = found;
		});
		return () => controller.abort();
	});
</script>

<div data-catalog-empty-state>
	{#if filters.length === 0}
		<h2 class="text-lg font-semibold text-ink">No coffees to show right now</h2>
		<p class="mx-auto mt-2 max-w-2xl text-sm text-muted">
			The catalog did not return any coffees. Try again in a moment.
		</p>
	{:else}
		<h2 class="text-lg font-semibold text-ink">No coffees match these filters</h2>
		{#if suggestions === null}
			<p class="mx-auto mt-2 max-w-2xl text-sm text-muted" aria-live="polite">
				Checking which filter to remove.
			</p>
		{:else if suggestions.length > 0}
			<p class="mx-auto mt-2 max-w-2xl text-sm text-muted">
				Removing one of these would show coffees again:
			</p>
			<ul class="mt-4 flex flex-wrap items-center justify-center gap-2" aria-label="Suggestions">
				{#each suggestions as suggestion (suggestion.filter.id)}
					<li>
						<button
							type="button"
							onclick={() => onRemove(suggestion.filter)}
							class="inline-flex items-center gap-2 rounded-full border border-line bg-surface-canvas px-3 py-1.5 text-sm text-ink transition-colors hover:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
						>
							<span>Remove {suggestion.filter.label}</span>
							<span class="text-xs tabular-nums text-muted"
								>{suggestion.total.toLocaleString()}
								{suggestion.total === 1 ? 'coffee' : 'coffees'}</span
							>
						</button>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="mx-auto mt-2 max-w-2xl text-sm text-muted">
				No single filter is the cause. Clear them and start again.
			</p>
		{/if}
	{/if}
	<div class="mt-4 flex flex-col items-center justify-center gap-3 sm:flex-row">
		{#if filters.length > 0}
			<button
				type="button"
				onclick={onClearAll}
				class="rounded-md border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent"
			>
				Clear all filters
			</button>
		{/if}
		<a
			href="/analytics"
			class="rounded-md bg-accent px-4 py-2 text-sm font-medium text-ink transition-all duration-200 hover:bg-opacity-90"
		>
			Review broader Market Index
		</a>
	</div>
</div>
