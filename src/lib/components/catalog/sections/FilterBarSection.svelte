<script lang="ts">
	import { filterStore } from '$lib/stores/filterStore';

	interface Props {
		hasInlineFilters: boolean;
	}

	let { hasInlineFilters }: Props = $props();
</script>

<div
	class="flex flex-wrap items-center gap-2 rounded-lg border border-border-light bg-background-secondary-light px-4 py-3"
>
	<select
		value={Array.isArray($filterStore.filters.country)
			? ($filterStore.filters.country[0] ?? '')
			: ($filterStore.filters.country ?? '')}
		onchange={(e) => {
			const val = e.currentTarget.value;
			filterStore.setFilter('country', val ? [val] : []);
		}}
		class="rounded-md border border-border-light bg-background-primary-light px-3 py-1.5 text-sm text-text-primary-light shadow-sm focus:outline-none focus:ring-2 focus:ring-background-tertiary-light"
	>
		<option value="">Origin</option>
		{#each $filterStore.uniqueValues.countries ?? [] as country}
			<option value={country}>{country}</option>
		{/each}
	</select>

	<select
		value={$filterStore.filters.processing ?? ''}
		onchange={(e) => filterStore.setFilter('processing', e.currentTarget.value)}
		class="rounded-md border border-border-light bg-background-primary-light px-3 py-1.5 text-sm text-text-primary-light shadow-sm focus:outline-none focus:ring-2 focus:ring-background-tertiary-light"
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
		class="min-w-[160px] flex-1 rounded-md border border-border-light bg-background-primary-light px-3 py-1.5 text-sm text-text-primary-light shadow-sm focus:outline-none focus:ring-2 focus:ring-background-tertiary-light"
	/>

	{#if hasInlineFilters}
		<button
			onclick={filterStore.clearFilters}
			class="rounded-md border border-border-light px-3 py-1.5 text-sm text-text-secondary-light transition-colors hover:border-background-tertiary-light hover:text-background-tertiary-light"
		>
			Clear
		</button>
	{/if}
</div>
