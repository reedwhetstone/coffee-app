<script lang="ts">
	import { getContext } from 'svelte';
	import { axisRight } from 'd3-axis';
	import { select } from 'd3-selection';
	import type { Writable } from 'svelte/store';
	import type { ScaleLinear } from 'd3-scale';

	let {
		scale,
		label = 'RoR (°F/min)'
	}: {
		scale: ScaleLinear<number, number>;
		label?: string;
	} = $props();

	const { width, height } = getContext('LayerCake') as {
		width: Writable<number>;
		height: Writable<number>;
	};

	let gEl: SVGGElement;

	$effect(() => {
		if (gEl && scale) {
			const axis = axisRight(scale as never);
			select(gEl).call(axis as never);
		}
	});
</script>

<g bind:this={gEl} transform="translate({$width}, 0)" class="axis y-axis-right"></g>
<text
	transform="rotate(-90)"
	x={-($height / 2)}
	y={$width + 55}
	text-anchor="middle"
	font-size="11"
	fill="#6b7280">{label}</text
>
