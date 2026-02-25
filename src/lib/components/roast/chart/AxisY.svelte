<script lang="ts">
	import { getContext } from 'svelte';
	import { axisLeft } from 'd3-axis';
	import { select } from 'd3-selection';
	import type { Writable } from 'svelte/store';
	import type { ScaleLinear } from 'd3-scale';

	let { label = 'Temperature (°F)' }: { label?: string } = $props();

	const { height, yScale } = getContext('LayerCake') as {
		height: Writable<number>;
		yScale: Writable<ScaleLinear<number, number>>;
	};

	let gEl: SVGGElement;

	$effect(() => {
		if (gEl && $yScale) {
			const axis = axisLeft($yScale as never);
			select(gEl).call(axis as never);
		}
	});
</script>

<g bind:this={gEl} class="axis y-axis"></g>
<text
	transform="rotate(-90)"
	x={-($height / 2)}
	y={-55}
	text-anchor="middle"
	font-size="11"
	fill="#6b7280">{label}</text
>
