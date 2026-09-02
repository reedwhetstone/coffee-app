<script lang="ts">
	import type {
		CatalogMapClusterSelection,
		CatalogMapViewportChange
	} from '../CatalogMapCanvas.svelte';

	interface Props {
		onViewportChange: (viewport: CatalogMapViewportChange) => void;
		onPlaceSelect?: (catalogId: number, placeId: string | null) => void;
		onClusterSelect?: (selection: CatalogMapClusterSelection) => void;
	}

	let { onViewportChange, onPlaceSelect = () => {}, onClusterSelect = () => {} }: Props = $props();
</script>

<button
	type="button"
	onclick={() =>
		onViewportChange({
			center: [10, 20],
			zoom: 4,
			bounds: { west: -20, south: -10, east: 40, north: 50 },
			commitSearch: false
		})}>Simulate map pan</button
>

<button
	type="button"
	onclick={() =>
		onClusterSelect({
			kind: 'area',
			label: 'Selected map area',
			precisionLabel: 'Nearby mapped origins',
			mappedOriginCount: 12,
			coffeeMatchCount: 10,
			catalogIds: [42, 43],
			originLabels: ['Ethiopia', 'Kenya']
		})}>Simulate cluster selection</button
>

<button
	type="button"
	onclick={() =>
		onClusterSelect({
			kind: 'location',
			label: 'Ethiopia',
			precisionLabel: 'Country-level area',
			mappedOriginCount: 223,
			coffeeMatchCount: 223,
			catalogIds: [42, 43],
			originLabels: ['Ethiopia']
		})}>Simulate location selection</button
>

<button
	type="button"
	onclick={() =>
		onClusterSelect({
			kind: 'location',
			label: 'Ethiopia',
			precisionLabel: 'Country-level area',
			mappedOriginCount: 30,
			coffeeMatchCount: 30,
			catalogIds: Array.from({ length: 30 }, (_, index) => index + 1),
			originLabels: ['Ethiopia']
		})}>Simulate large location selection</button
>

<button type="button" onclick={() => onPlaceSelect(42, 'place-id')}
	>Simulate single origin selection</button
>
