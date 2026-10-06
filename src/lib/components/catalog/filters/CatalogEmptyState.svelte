<script lang="ts">
	import { untrack } from 'svelte';
	import {
		catalogTotalRequest,
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
		/**
		 * True while the rows for these filters are still being read: the empty
		 * result on screen is the previous one, so nothing is looked up for it.
		 */
		pending?: boolean;
		onRemove: (filter: ActiveCatalogFilter) => void;
		onClearAll: () => void;
	}

	let { filters, snapshot, pending = false, onRemove, onClearAll }: Props = $props();

	let found = $state.raw<FilterRemovalSuggestion[] | null>(null);

	// What is looked up: these filters, once the page has their (empty) answer.
	// The page hands over new objects whenever anything in the catalog state
	// changes, so the lookup follows what they select, not which objects they are.
	let lookup = $derived(
		pending || filters.length === 0
			? null
			: [catalogTotalRequest(snapshot), ...filters.map((filter) => filter.id)].join(' ')
	);

	$effect(() => {
		found = null;
		if (lookup === null) return;
		const controller = new AbortController();
		untrack(() => suggestFilterRemovals(snapshot, filters, controller.signal)).then((totals) => {
			if (!controller.signal.aborted) found = totals;
		});
		return () => controller.abort();
	});

	// Shown with the filters as they are labelled now: the names of grades and
	// varieties can arrive after the totals do.
	let suggestions = $derived(
		found?.flatMap(({ filter, total }) => {
			const current = filters.find((candidate) => candidate.id === filter.id);
			return current ? [{ filter: current, total }] : [];
		}) ?? null
	);
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
