<script lang="ts">
	import CatalogMapExperience from '../CatalogMapExperience.svelte';
	import type { CatalogMapUrlState } from '$lib/catalog/mapState';
	import type { CatalogUrlState } from '$lib/catalog/urlState';
	import type { CoffeeCatalog } from '$lib/types/component.types';

	interface ElevationRangeInput {
		min: string | number;
		max: string | number;
	}

	interface Props {
		initialState: CatalogMapUrlState;
		catalogState: CatalogUrlState;
		elevationRange?: ElevationRangeInput | null;
		canUseAdvancedMaps: boolean;
		onStateChange: (state: CatalogMapUrlState) => void;
		onElevationRangeChange: (range: ElevationRangeInput | null) => void;
		onSelectCoffee: (catalogId: number) => Promise<CoffeeCatalog | null>;
		onClearCoffee: () => void;
		onSwitchToList: () => void;
	}

	let {
		initialState,
		catalogState,
		elevationRange = null,
		canUseAdvancedMaps,
		onStateChange,
		onElevationRangeChange,
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
	{elevationRange}
	{canUseAdvancedMaps}
	onStateChange={handleStateChange}
	{onElevationRangeChange}
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
