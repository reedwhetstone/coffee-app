<script lang="ts">
	import { LayerCake, Svg } from 'layercake';
	import { line as d3Line, curveMonotoneX } from 'd3-shape';
	import { scaleTime, scaleLinear, scaleBand } from 'd3-scale';
	import { extent, max, min } from 'd3-array';
	import { select } from 'd3-selection';
	import { getContext } from 'svelte';
	import type { Writable } from 'svelte/store';

	interface SnapshotRow {
		snapshot_date: string;
		origin: string;
		price_avg: number | null;
	}

	let { snapshots = [] }: { snapshots: SnapshotRow[] } = $props();

	// Build top-5 origins by most-recent avg price descending
	const COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6'];

	let originMap = $derived.by(() => {
		const map = new Map<string, { date: Date; value: number }[]>();
		for (const row of snapshots) {
			if (row.price_avg == null) continue;
			if (!map.has(row.origin)) map.set(row.origin, []);
			map.get(row.origin)!.push({ date: new Date(row.snapshot_date), value: row.price_avg });
		}
		return map;
	});

	let topOrigins = $derived.by(() => {
		// rank by most recent avg (last row per origin)
		const ranked: { origin: string; lastAvg: number }[] = [];
		for (const [origin, pts] of originMap) {
			const sorted = [...pts].sort((a, b) => a.date.getTime() - b.date.getTime());
			ranked.push({ origin, lastAvg: sorted[sorted.length - 1]?.value ?? 0 });
		}
		ranked.sort((a, b) => b.lastAvg - a.lastAvg);
		return ranked.slice(0, 5).map((r) => r.origin);
	});

	let seriesData = $derived.by(() =>
		topOrigins.map((origin, i) => ({
			origin,
			color: COLORS[i % COLORS.length],
			points: [...(originMap.get(origin) ?? [])].sort((a, b) => a.date.getTime() - b.date.getTime())
		}))
	);

	// All price values for yDomain
	let allValues = $derived(seriesData.flatMap((s) => s.points.map((p) => p.value)));
	let allDates = $derived(seriesData.flatMap((s) => s.points.map((p) => p.date)));

	let xDomain = $derived(
		allDates.length >= 2 ? (extent(allDates) as [Date, Date]) : [new Date(), new Date()]
	);
	let yDomain = $derived(
		allValues.length >= 2
			? [Math.max(0, (min(allValues) ?? 0) * 0.9), (max(allValues) ?? 10) * 1.05]
			: [0, 10]
	);

	const padding = { top: 20, right: 20, bottom: 40, left: 60 };

	let containerH = $state(0);
	let containerW = $state(0);

	let innerW = $derived(Math.max(0, containerW - padding.left - padding.right));
	let innerH = $derived(Math.max(0, containerH - padding.top - padding.bottom));

	let xScale = $derived(scaleTime().domain(xDomain).range([0, innerW]));
	let yScale = $derived(scaleLinear().domain(yDomain).range([innerH, 0]));

	// Axes
	let xAxisEl: SVGGElement | undefined = $state();
	let yAxisEl: SVGGElement | undefined = $state();

	$effect(() => {
		if (!xAxisEl || !xScale || innerW <= 0) return;
		const g = select(xAxisEl);
		g.selectAll('*').remove();
		g.append('line')
			.attr('x1', 0)
			.attr('x2', innerW)
			.attr('y1', 0)
			.attr('y2', 0)
			.attr('stroke', 'rgb(156 163 175)');
		const dateRange = xDomain[1].getTime() - xDomain[0].getTime();
		const tickCount = Math.max(2, Math.min(6, Math.floor(innerW / 80)));
		const step = Math.max(1, Math.floor(dateRange / tickCount / 86400000));
		const ticks: Date[] = [];
		for (let i = 0; i <= tickCount; i++) {
			ticks.push(new Date(xDomain[0].getTime() + i * step * 86400000));
		}
		ticks.forEach((d) => {
			const x = xScale(d);
			if (x < 0 || x > innerW) return;
			g.append('line')
				.attr('x1', x)
				.attr('x2', x)
				.attr('y1', 0)
				.attr('y2', 5)
				.attr('stroke', 'rgb(156 163 175)');
			g.append('text')
				.attr('x', x)
				.attr('y', 18)
				.attr('text-anchor', 'middle')
				.attr('fill', 'rgb(156 163 175)')
				.attr('font-size', '11')
				.text(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
		});
	});

	$effect(() => {
		if (!yAxisEl || !yScale || innerH <= 0) return;
		const g = select(yAxisEl);
		g.selectAll('*').remove();
		g.append('line')
			.attr('x1', 0)
			.attr('x2', 0)
			.attr('y1', 0)
			.attr('y2', innerH)
			.attr('stroke', 'rgb(156 163 175)');
		const ticks = yScale.ticks(5);
		ticks.forEach((t) => {
			const y = yScale(t);
			g.append('line')
				.attr('x1', -5)
				.attr('x2', 0)
				.attr('y1', y)
				.attr('y2', y)
				.attr('stroke', 'rgb(156 163 175)');
			g.append('text')
				.attr('x', -10)
				.attr('y', y)
				.attr('text-anchor', 'end')
				.attr('dominant-baseline', 'middle')
				.attr('fill', 'rgb(156 163 175)')
				.attr('font-size', '11')
				.text(`$${t.toFixed(2)}`);
			// Gridline
			g.append('line')
				.attr('x1', 0)
				.attr('x2', innerW)
				.attr('y1', y)
				.attr('y2', y)
				.attr('stroke', 'rgb(156 163 175)')
				.attr('stroke-opacity', '0.2')
				.attr('stroke-dasharray', '4 4');
		});
	});
</script>

<div class="h-full w-full" bind:clientHeight={containerH} bind:clientWidth={containerW}>
	{#if containerW > 0 && containerH > 0}
		<svg width={containerW} height={containerH}>
			<g transform="translate({padding.left},{padding.top})">
				<!-- Axes -->
				<g bind:this={xAxisEl} transform="translate(0,{innerH})"></g>
				<g bind:this={yAxisEl}></g>

				<!-- Lines -->
				{#each seriesData as series}
					{@const lineGen = d3Line<{ date: Date; value: number }>()
						.x((d) => xScale(d.date))
						.y((d) => yScale(d.value))
						.curve(curveMonotoneX)}
					{@const pathD = lineGen(series.points)}
					{#if pathD}
						<path d={pathD} fill="none" stroke={series.color} stroke-width="2" />
					{/if}
					<!-- Dots on last point -->
					{#if series.points.length > 0}
						{@const last = series.points[series.points.length - 1]}
						<circle cx={xScale(last.date)} cy={yScale(last.value)} r="4" fill={series.color} />
						<text
							x={xScale(last.date) + 6}
							y={yScale(last.value)}
							dominant-baseline="middle"
							font-size="10"
							fill={series.color}
						>
							${last.value.toFixed(2)}
						</text>
					{/if}
				{/each}
			</g>
		</svg>

		<!-- Legend -->
		{#if seriesData.length > 0}
			<div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 px-4">
				{#each seriesData as series}
					<div class="flex items-center gap-1.5 text-xs text-text-secondary-light">
						<div class="h-2.5 w-5 rounded-sm" style="background:{series.color}"></div>
						{series.origin}
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>
