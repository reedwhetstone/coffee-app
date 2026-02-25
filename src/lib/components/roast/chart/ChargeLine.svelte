<script lang="ts">
	import { getContext } from 'svelte';
	import type { Writable } from 'svelte/store';
	import type { ScaleLinear } from 'd3-scale';

	const { height, xScale } = getContext('LayerCake') as {
		height: Writable<number>;
		xScale: Writable<ScaleLinear<number, number>>;
	};

	let chargeX = $derived($xScale(0));
</script>

<line
	x1={chargeX}
	x2={chargeX}
	y1={0}
	y2={$height}
	stroke="#9ca3af"
	stroke-width="1"
	stroke-dasharray="4,4"
/>
