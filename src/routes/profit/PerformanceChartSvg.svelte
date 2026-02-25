<script lang="ts">
	import { getContext } from 'svelte';
	import { axisLeft } from 'd3-axis';
	import { area as d3Area, line as d3Line, curveMonotoneX } from 'd3-shape';
	import { select } from 'd3-selection';
	import type { Writable } from 'svelte/store';
	import type { ScaleLinear } from 'd3-scale';
	import type { PerformanceDataPoint } from '$lib/types/d3.types';

	let {
		chartData,
		selectedViewType,
		showProfitLine,
		showCostLine,
		showTargetLine,
		onTooltipChange
	}: {
		chartData: PerformanceDataPoint[];
		selectedViewType: string;
		showProfitLine: boolean;
		showCostLine: boolean;
		showTargetLine: boolean;
		onTooltipChange: (state: {
			visible: boolean;
			x: number;
			y: number;
			data: PerformanceDataPoint | null;
		}) => void;
	} = $props();

	const { width, height, xScale, yScale } = getContext('LayerCake') as {
		width: Writable<number>;
		height: Writable<number>;
		xScale: Writable<ScaleLinear<number, number>>;
		yScale: Writable<ScaleLinear<number, number>>;
	};

	// Axis elements
	let xAxisEl: SVGGElement;
	let yAxisEl: SVGGElement;

	// Render axes
	$effect(() => {
		if (xAxisEl && $xScale) {
			// Create tick values from the data dates
			const dates = chartData.map((d) => new Date(d.date).getTime());
			const tickCount = Math.min(6, dates.length);
			const step = Math.max(1, Math.floor(dates.length / tickCount));
			const ticks = dates.filter((_, i) => i % step === 0);

			const g = select(xAxisEl);
			g.selectAll('*').remove();

			// Draw axis line
			g.append('line')
				.attr('x1', 0)
				.attr('x2', $width)
				.attr('y1', 0)
				.attr('y2', 0)
				.attr('stroke', 'rgb(156 163 175)');

			// Draw ticks
			ticks.forEach((t) => {
				const x = $xScale(t);
				const date = new Date(t);
				const label =
					selectedViewType === 'monthly'
						? date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
						: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

				g.append('line')
					.attr('x1', x)
					.attr('x2', x)
					.attr('y1', 0)
					.attr('y2', 6)
					.attr('stroke', 'rgb(156 163 175)');

				g.append('text')
					.attr('x', x)
					.attr('y', 20)
					.attr('text-anchor', 'middle')
					.style('fill', 'rgb(156 163 175)')
					.style('font-size', '12px')
					.text(label);
			});
		}
	});

	$effect(() => {
		if (yAxisEl && $yScale) {
			const yAxisFormat =
				selectedViewType === 'margin'
					? (d: number | { valueOf(): number }) => `${Number(d)}%`
					: (d: number | { valueOf(): number }) => `$${Number(d).toLocaleString()}`;
			const yAxis = axisLeft($yScale as never)
				.tickFormat(yAxisFormat as never)
				.ticks(6);
			const g = select(yAxisEl).call(yAxis as never);
			g.style('color', 'rgb(156 163 175)');
			g.selectAll('text').style('fill', 'rgb(156 163 175)').style('font-size', '12px');
		}
	});

	// Line generators (using timestamps for x)
	let revenuePath = $derived.by(() => {
		if (!$xScale || chartData.length === 0) return '';
		const gen = d3Line<PerformanceDataPoint>()
			.x((d) => $xScale(new Date(d.date).getTime()))
			.y((d) => $yScale(d.revenue))
			.curve(curveMonotoneX);
		return gen(chartData) ?? '';
	});

	let costPath = $derived.by(() => {
		if (!$xScale || chartData.length === 0) return '';
		const gen = d3Line<PerformanceDataPoint>()
			.x((d) => $xScale(new Date(d.date).getTime()))
			.y((d) => $yScale(d.cost))
			.curve(curveMonotoneX);
		return gen(chartData) ?? '';
	});

	let targetPath = $derived.by(() => {
		if (!$xScale || chartData.length === 0) return '';
		const gen = d3Line<PerformanceDataPoint>()
			.x((d) => $xScale(new Date(d.date).getTime()))
			.y((d) => $yScale(d.target))
			.curve(curveMonotoneX);
		return gen(chartData) ?? '';
	});

	let areaPath = $derived.by(() => {
		if (!$xScale || chartData.length === 0) return '';
		const gen = d3Area<PerformanceDataPoint>()
			.x((d) => $xScale(new Date(d.date).getTime()))
			.y0($height)
			.y1((d) => $yScale(d.revenue))
			.curve(curveMonotoneX);
		return gen(chartData) ?? '';
	});

	// Grid line positions
	let xGridLines = $derived.by(() => {
		if (!$xScale || chartData.length === 0) return [];
		const dates = chartData.map((d) => new Date(d.date).getTime());
		const tickCount = Math.min(6, dates.length);
		const step = Math.max(1, Math.floor(dates.length / tickCount));
		return dates.filter((_, i) => i % step === 0).map((t) => $xScale(t));
	});

	let yGridLines = $derived.by(() => {
		if (!$yScale) return [];
		return $yScale.ticks(6).map((t: number) => $yScale(t));
	});

	// Hover indicator
	let hoverX = $state<number | null>(null);

	function handleMouseMove(e: MouseEvent) {
		const svg = (e.currentTarget as SVGRectElement).closest('svg');
		if (!svg || chartData.length === 0) return;

		const svgRect = svg.getBoundingClientRect();
		const mouseX = e.clientX - svgRect.left;

		const x0 = $xScale.invert(mouseX);

		let closestIndex = 0;
		let minDistance = Math.abs(new Date(chartData[0].date).getTime() - x0);
		for (let i = 1; i < chartData.length; i++) {
			const distance = Math.abs(new Date(chartData[i].date).getTime() - x0);
			if (distance < minDistance) {
				minDistance = distance;
				closestIndex = i;
			}
		}

		const d = chartData[closestIndex];
		if (d) {
			hoverX = $xScale(new Date(d.date).getTime());
			onTooltipChange({
				visible: true,
				x: e.clientX,
				y: e.clientY,
				data: d
			});
		}
	}

	function handleMouseLeave() {
		hoverX = null;
		onTooltipChange({ visible: false, x: 0, y: 0, data: null });
	}

	// Legend items
	let legendItems = $derived.by(() => {
		const items: { label: string; color: string; dashed: boolean }[] = [];
		if (showProfitLine) {
			items.push({
				label: selectedViewType === 'margin' ? 'Profit Margin' : 'Revenue',
				color: selectedViewType === 'margin' ? 'rgb(59 130 246)' : 'rgb(34 197 94)',
				dashed: false
			});
		}
		if (showCostLine && selectedViewType !== 'margin') {
			items.push({ label: 'Costs', color: 'rgb(239 68 68)', dashed: false });
		}
		if (showTargetLine) {
			items.push({
				label: selectedViewType === 'margin' ? 'Target (25%)' : 'Target',
				color: 'rgb(139 92 246)',
				dashed: true
			});
		}
		return items;
	});
</script>

<!-- Grid lines -->
{#each xGridLines as x}
	<line
		x1={x}
		x2={x}
		y1={0}
		y2={$height}
		stroke="rgb(156 163 175)"
		stroke-dasharray="2,2"
		opacity="0.1"
	/>
{/each}
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

<!-- Gradient definition -->
<defs>
	<linearGradient id="revenueGradient" x1="0%" y1="0%" x2="0%" y2="100%">
		<stop offset="0%" stop-color="rgb(34 197 94)" stop-opacity="0.8" />
		<stop offset="100%" stop-color="rgb(34 197 94)" stop-opacity="0.1" />
	</linearGradient>
</defs>

<!-- Area fill (behind lines) -->
{#if showProfitLine && selectedViewType !== 'margin' && areaPath}
	<path d={areaPath} fill="url(#revenueGradient)" />
{/if}

<!-- Revenue / Margin line -->
{#if showProfitLine && revenuePath}
	<path
		d={revenuePath}
		fill="none"
		stroke={selectedViewType === 'margin' ? 'rgb(59 130 246)' : 'rgb(34 197 94)'}
		stroke-width="3"
		stroke-linecap="round"
		style="filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));"
	/>
{/if}

<!-- Cost line -->
{#if showCostLine && selectedViewType !== 'margin' && costPath}
	<path
		d={costPath}
		fill="none"
		stroke="rgb(239 68 68)"
		stroke-width="2"
		stroke-linecap="round"
		style="filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));"
	/>
{/if}

<!-- Target line -->
{#if showTargetLine && targetPath}
	<path
		d={targetPath}
		fill="none"
		stroke="rgb(139 92 246)"
		stroke-width="2"
		stroke-dasharray="8,4"
		stroke-linecap="round"
		opacity="0.7"
	/>
{/if}

<!-- Hover indicator -->
{#if hoverX !== null}
	<line
		x1={hoverX}
		x2={hoverX}
		y1={0}
		y2={$height}
		stroke="rgb(156 163 175)"
		stroke-width="1"
		stroke-dasharray="3,3"
		opacity="0.7"
	/>
{/if}

<!-- Legend -->
{#if legendItems.length > 0}
	<g transform="translate({$width - 140}, 20)">
		{#each legendItems as item, i}
			<g transform="translate(0, {i * 22})">
				<line
					x1={0}
					x2={20}
					y1={0}
					y2={0}
					stroke={item.color}
					stroke-width="2.5"
					stroke-linecap="round"
					stroke-dasharray={item.dashed ? '6,3' : 'none'}
				/>
				<text x={28} y={4} fill="rgb(156 163 175)" font-size="12" font-weight="500"
					>{item.label}</text
				>
			</g>
		{/each}
	</g>
{/if}

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- Interactive overlay -->
<rect
	x={0}
	y={0}
	width={$width}
	height={$height}
	fill="transparent"
	style="cursor: crosshair;"
	onmousemove={handleMouseMove}
	onmouseleave={handleMouseLeave}
/>
