<script lang="ts">
	import { getContext } from 'svelte';
	import { line as d3Line, curveBasis, curveLinear, curveStepAfter } from 'd3-shape';
	import type { ScaleLinear } from 'd3-scale';
	import type { Writable } from 'svelte/store';
	import type { ChartPoint } from './chart-types';

	let {
		data,
		color = '#f59e0b',
		strokeWidth = 2,
		dashArray,
		yScaleOverride,
		curve = 'basis',
		className = ''
	}: {
		data: ChartPoint[];
		color?: string;
		strokeWidth?: number;
		dashArray?: string;
		yScaleOverride?: ScaleLinear<number, number>;
		curve?: 'basis' | 'linear' | 'stepAfter';
		className?: string;
	} = $props();

	const { xScale, yScale } = getContext('LayerCake') as {
		xScale: Writable<ScaleLinear<number, number>>;
		yScale: Writable<ScaleLinear<number, number>>;
	};

	const curveMap = { basis: curveBasis, linear: curveLinear, stepAfter: curveStepAfter };

	let pathD = $derived.by(() => {
		if (data.length === 0 || !$xScale) return '';
		const yFn = yScaleOverride ?? $yScale;
		const generator = d3Line<ChartPoint>()
			.x((d) => $xScale(d.timeMinutes))
			.y((d) => yFn(d.value))
			.curve(curveMap[curve] ?? curveBasis);
		return generator(data) ?? '';
	});
</script>

{#if pathD}
	<path
		class={className}
		d={pathD}
		fill="none"
		stroke={color}
		stroke-width={strokeWidth}
		stroke-dasharray={dashArray ?? 'none'}
	/>
{/if}
