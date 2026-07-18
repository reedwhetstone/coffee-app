<script lang="ts">
	import { filterStore } from '$lib/stores/filterStore';

	interface Props {
		hasInlineFilters: boolean;
	}

	let { hasInlineFilters }: Props = $props();
</script>

<div
	class="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-panel px-4 py-3"
>
	<select
		value={Array.isArray($filterStore.filters.country)
			? ($filterStore.filters.country[0] ?? '')
			: ($filterStore.filters.country ?? '')}
		onchange={(e) => {
			const val = e.currentTarget.value;
			filterStore.setFilter('country', val ? [val] : []);
		}}
		class="rounded-md border border-line bg-surface-canvas px-3 py-1.5 text-sm text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-accent"
	>
		<option value="">Origin</option>
		{#each $filterStore.uniqueValues.countries ?? [] as country}
			<option value={country}>{country}</option>
		{/each}
	</select>

	<select
		value={$filterStore.filters.processing ?? ''}
		onchange={(e) => filterStore.setFilter('processing', e.currentTarget.value)}
		class="rounded-md border border-line bg-surface-canvas px-3 py-1.5 text-sm text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-accent"
	>
		<option value="">Process</option>
		{#each $filterStore.uniqueValues.processing ?? [] as process}
			<option value={process}>{process}</option>
		{/each}
	</select>

	<input
		type="search"
		value={$filterStore.filters.name ?? ''}
		oninput={(e) => filterStore.setFilter('name', e.currentTarget.value)}
		placeholder="Search coffees..."
		class="min-w-[160px] flex-1 rounded-md border border-line bg-surface-canvas px-3 py-1.5 text-sm text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-accent"
	/>

	<label
		for="anonymous-hobbyist-suppliers-only"
		class="flex items-center gap-2 rounded-md border border-line bg-surface-canvas px-3 py-1.5 text-sm text-ink"
	>
		<input
			id="anonymous-hobbyist-suppliers-only"
			type="checkbox"
			checked={!$filterStore.showWholesale}
			onchange={(e) => filterStore.setShowWholesale(!e.currentTarget.checked)}
			class="h-4 w-4 rounded border border-line text-accent focus:ring-2 focus:ring-accent"
		/>
		<span>Hobbyist suppliers only</span>
	</label>

	{#if hasInlineFilters}
		<button
			onclick={filterStore.clearFilters}
			class="rounded-md border border-line px-3 py-1.5 text-sm text-muted transition-colors hover:border-accent hover:text-accent"
		>
			Clear
		</button>
	{/if}
</div>
