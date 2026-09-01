<script lang="ts">
	import type { CatalogMapViewportChange } from '../CatalogMapCanvas.svelte';

	interface Props {
		onViewportChange: (viewport: CatalogMapViewportChange) => void;
	}

	let { onViewportChange }: Props = $props();
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
