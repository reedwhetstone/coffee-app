<script lang="ts">
	import CatalogMapExperience from '../CatalogMapExperience.svelte';
	import type { CatalogMapUrlState } from '$lib/catalog/mapState';
	import type { CatalogUrlState } from '$lib/catalog/urlState';
	import type { CoffeeCatalog } from '$lib/types/component.types';

	interface Props {
		initialState: CatalogMapUrlState;
		catalogState: CatalogUrlState;
		canUseAdvancedMaps: boolean;
		onStateChange: (state: CatalogMapUrlState) => void;
		onSelectCoffee: (catalogId: number) => Promise<CoffeeCatalog | null>;
		onClearCoffee: () => void;
		onSwitchToList: () => void;
	}

	let {
		initialState,
		catalogState,
		canUseAdvancedMaps,
		onStateChange,
		onSelectCoffee,
		onClearCoffee,
		onSwitchToList
	}: Props = $props();

	let state = $derived(initialState);

	function handleStateChange(next: CatalogMapUrlState) {
		state = next;
		onStateChange(next);
	}
</script>

<CatalogMapExperience
	initialState={state}
	{catalogState}
	{canUseAdvancedMaps}
	onStateChange={handleStateChange}
	{onSelectCoffee}
	{onClearCoffee}
	{onSwitchToList}
>
	{#snippet coffeeDetail(coffee: CoffeeCatalog, onClose: () => void)}
		<p>Selected coffee detail: {coffee.name}</p>
		<button type="button" onclick={onClose}>Close coffee detail to map</button>
	{/snippet}
	{#snippet resultsRail()}
		<p>Existing catalog results remain available</p>
	{/snippet}
</CatalogMapExperience>
