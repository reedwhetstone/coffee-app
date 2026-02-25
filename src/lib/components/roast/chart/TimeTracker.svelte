<script lang="ts">
	import { getContext } from 'svelte';
	import type { Writable } from 'svelte/store';
	import type { ScaleLinear } from 'd3-scale';

	let {
		currentTimeMinutes,
		visible = false
	}: {
		currentTimeMinutes: number;
		visible?: boolean;
	} = $props();

	const { height, xScale } = getContext('LayerCake') as {
		height: Writable<number>;
		xScale: Writable<ScaleLinear<number, number>>;
	};
</script>

{#if visible}
	{@const xPos = $xScale(currentTimeMinutes)}
	<line x1={xPos} x2={xPos} y1={0} y2={$height} stroke="#ef4444" stroke-width="2" />
{/if}
