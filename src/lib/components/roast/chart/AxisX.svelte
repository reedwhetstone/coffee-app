<script lang="ts">
	import { getContext } from 'svelte';
	import { axisBottom } from 'd3-axis';
	import { select } from 'd3-selection';
	import type { Writable } from 'svelte/store';
	import type { ScaleLinear } from 'd3-scale';

	const { width, height, xScale } = getContext('LayerCake') as {
		width: Writable<number>;
		height: Writable<number>;
		xScale: Writable<ScaleLinear<number, number>>;
	};

	let gEl: SVGGElement;

	$effect(() => {
		if (gEl && $xScale) {
			const axis = axisBottom($xScale as never);
			select(gEl).call(axis as never);
		}
	});
</script>

<g bind:this={gEl} transform="translate(0, {$height})" class="axis x-axis"></g>
<text x={$width / 2} y={$height + 35} text-anchor="middle" font-size="11" fill="#6b7280"
	>Time (minutes)</text
>
