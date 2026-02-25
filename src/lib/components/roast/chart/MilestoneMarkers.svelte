<script lang="ts">
	import { getContext } from 'svelte';
	import type { Writable } from 'svelte/store';
	import type { ScaleLinear } from 'd3-scale';
	import type { ChartEvent } from './chart-types';

	let { events }: { events: ChartEvent[] } = $props();

	const { height, xScale } = getContext('LayerCake') as {
		height: Writable<number>;
		xScale: Writable<ScaleLinear<number, number>>;
	};
</script>

{#each events as event}
	{@const xPos = $xScale(event.timeMinutes)}
	<line
		x1={xPos}
		x2={xPos}
		y1={0}
		y2={$height}
		stroke="#4ade80"
		stroke-width="1"
		stroke-dasharray="4,4"
	/>
	<text
		x={xPos}
		y={10}
		fill="#4ade80"
		font-size="12"
		text-anchor="end"
		transform="rotate(-90, {xPos}, 10)"
	>
		{event.name}
	</text>
{/each}
