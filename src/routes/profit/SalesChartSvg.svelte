<script lang="ts">
	import { getContext } from 'svelte';
	import { axisLeft } from 'd3-axis';
	import { select } from 'd3-selection';
	import type { Writable } from 'svelte/store';
	import type { ScaleLinear, ScaleBand } from 'd3-scale';

	interface ChartDataPoint {
		beanName: string;
		value: number;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		rawData: any;
	}

	let {
		chartData,
		metricColor,
		metricHoverColor,
		metricLabel,
		metricFormat,
		onTooltipChange
	}: {
		chartData: ChartDataPoint[];
		metricColor: string;
		metricHoverColor: string;
		metricLabel: string;
		metricFormat: (v: number) => string;
		onTooltipChange: (state: {
			visible: boolean;
			x: number;
			y: number;
			data: ChartDataPoint | null;
		}) => void;
	} = $props();

	const { width, height, xScale, yScale } = getContext('LayerCake') as {
		width: Writable<number>;
		height: Writable<number>;
		xScale: Writable<ScaleBand<string>>;
		yScale: Writable<ScaleLinear<number, number>>;
	};

	// Y axis
	let yAxisEl: SVGGElement;

	$effect(() => {
		if (yAxisEl && $yScale) {
			const yAxis = axisLeft($yScale as never)
				.tickFormat((d) => metricFormat(d as number))
				.ticks(6);
			const g = select(yAxisEl).call(yAxis as never);
			g.style('color', 'rgb(156 163 175)');
			g.selectAll('text').style('fill', 'rgb(156 163 175)').style('font-size', '12px');
		}
	});

	// X axis (rotated labels)
	let xAxisEl: SVGGElement;

	$effect(() => {
		if (xAxisEl && $xScale) {
			const g = select(xAxisEl);
			g.selectAll('*').remove();

			// Axis line
			g.append('line')
				.attr('x1', 0)
				.attr('x2', $width)
				.attr('y1', 0)
				.attr('y2', 0)
				.attr('stroke', 'rgb(156 163 175)');

			// Ticks and labels
			const domain = $xScale.domain();
			domain.forEach((name) => {
				const x = ($xScale(name) ?? 0) + $xScale.bandwidth() / 2;
				g.append('line')
					.attr('x1', x)
					.attr('x2', x)
					.attr('y1', 0)
					.attr('y2', 6)
					.attr('stroke', 'rgb(156 163 175)');

				g.append('text')
					.attr('x', x)
					.attr('y', 12)
					.attr('transform', `rotate(-45, ${x}, 12)`)
					.style('text-anchor', 'end')
					.style('fill', 'rgb(156 163 175)')
					.style('font-size', '12px')
					.text(name);
			});
		}
	});

	// Grid lines
	let yGridLines = $derived.by(() => {
		if (!$yScale) return [];
		return $yScale.ticks(6).map((t: number) => $yScale(t));
	});

	// Bar hover state
	let hoveredIndex = $state<number | null>(null);
</script>

<!-- Y grid lines -->
{#each yGridLines as y}
	<line
		x1={0}
		x2={$width}
		y1={y}
		y2={y}
		stroke="rgb(156 163 175)"
		stroke-dasharray="2,2"
		opacity="0.1"
	/>
{/each}

<!-- Axes -->
<g bind:this={xAxisEl} transform="translate(0, {$height})"></g>
<g bind:this={yAxisEl}></g>

<!-- Bars -->
{#each chartData as d, i}
	{@const barX = $xScale(d.beanName) ?? 0}
	{@const barY = $yScale(d.value)}
	{@const barH = $height - barY}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<rect
		x={barX}
		y={barY}
		width={$xScale.bandwidth()}
		height={barH > 0 ? barH : 0}
		fill={hoveredIndex === i ? metricHoverColor : metricColor}
		style="cursor: pointer;"
		onmouseenter={(e) => {
			hoveredIndex = i;
			onTooltipChange({
				visible: true,
				x: e.clientX,
				y: e.clientY,
				data: d
			});
		}}
		onmousemove={(e) => {
			onTooltipChange({
				visible: true,
				x: e.clientX,
				y: e.clientY,
				data: d
			});
		}}
		onmouseleave={() => {
			hoveredIndex = null;
			onTooltipChange({ visible: false, x: 0, y: 0, data: null });
		}}
	/>
{/each}

<!-- Axis labels -->
<text
	transform="rotate(-90)"
	y={-60}
	x={-$height / 2}
	dy="1em"
	text-anchor="middle"
	fill="rgb(156 163 175)"
	font-size="12">{metricLabel}</text
>
<text x={$width / 2} y={$height + 70} text-anchor="middle" fill="rgb(156 163 175)" font-size="12"
	>Coffee Beans</text
>
