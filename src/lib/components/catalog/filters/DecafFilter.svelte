<script lang="ts">
	import { filterStore } from '$lib/stores/filterStore';
	import {
		catalogFilterLock,
		decafFilterOptions,
		type CatalogFilterAccess
	} from '$lib/catalog/filterModel';
	import FilterChips from './FilterChips.svelte';
	import LockedNotice from './LockedNotice.svelte';

	interface Props {
		access: CatalogFilterAccess;
		compact?: boolean;
	}

	let { access, compact = false }: Props = $props();

	let decafLock = $derived(catalogFilterLock(access, 'decaf'));
	let selected = $derived([
		typeof $filterStore.filters.decaf === 'boolean' ? String($filterStore.filters.decaf) : 'any'
	]);
	let options = $derived(
		decafFilterOptions($filterStore.uniqueValues.decaf, $filterStore.facetCounts.decaf)
	);

	function changeDecaf(next: string[]) {
		if (decafLock) return;

		const value = next[0];
		filterStore.setFilter('decaf', value === 'true' ? true : value === 'false' ? false : '');
	}
</script>

<div class={compact ? 'flex flex-wrap items-center gap-x-3 gap-y-1' : 'space-y-2'}>
	<FilterChips
		legend="Decaf"
		{options}
		{selected}
		disabled={decafLock !== null}
		onChange={changeDecaf}
	/>
	{#if decafLock}
		<LockedNotice lock={decafLock} {compact} />
	{/if}
</div>
