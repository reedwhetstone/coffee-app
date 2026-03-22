<script lang="ts">
	import { scaleBand, scaleLinear } from 'd3-scale';
	import { min, max } from 'd3-array';
	import { select } from 'd3-selection';

	export interface OriginRangeRow {
		origin: string;
		price_min: number;
		price_max: number;
		price_avg: number;
		price_median: number;
		price_q1: number;
		price_q3: number;
		sample_size: number;
	}

	let { data = [] }: { data: OriginRangeRow[] } = $props();

	let containerH = $state(0);
	let containerW = $state(0);

	const padding = { top: 28, right: 64, bottom: 10, left: 130 };

	let innerW = $derived(Math.max(0, containerW - padding.left - padding.right));
	let innerH = $derived(Math.max(0, containerH - padding.top - padding.bottom));

	// Sort by median price ascending
	let sortedData = $derived([...data].sort((a, b) => a.price_median - b.price_median));

	let yScale = $derived(
		scaleBand()
			.domain(sortedData.map((d) => d.origin))
			.range([0, innerH])
			.padding(0.3)
	);

	let xDomainMin = $derived(Math.max(0, (min(sortedData.map((d) => d.price_min)) ?? 0) * 0.9));
	let xDomainMax = $derived((max(sortedData.map((d) => d.price_max)) ?? 20) * 1.05);

	let xScale = $derived(scaleLinear().domain([xDomainMin, xDomainMax]).range([0, innerW]).nice());

	// Tooltip state
	let tooltip = $state<{
		visible: boolean;
		x: number;
		y: number;
		row: OriginRangeRow | null;
	}>({ visible: false, x: 0, y: 0, row: null });

	let xAxisEl: SVGGElement | undefined = $state();
	let yAxisEl: SVGGElement | undefined = $state();

	$effect(() => {
		if (!yAxisEl || !yScale || innerH <= 0) return;
		const g = select(yAxisEl);
		g.selectAll('*').remove();
		sortedData.forEach((d) => {
			const y = (yScale(d.origin) ?? 0) + yScale.bandwidth() / 2;
			g.append('text')
				.attr('x', -8)
				.attr('y', y)
				.attr('text-anchor', 'end')
				.attr('dominant-baseline', 'middle')
				.attr('fill', 'rgb(107 114 128)')
				.attr('font-size', '12')
				.text(d.origin);
		});
	});

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
		const ticks = xScale.ticks(5);
		ticks.forEach((t) => {
			const x = xScale(t);
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
				.text(`$${t.toFixed(0)}`);
		});
	});

	function handleMouseEnter(e: MouseEvent, row: OriginRangeRow) {
		const rect = (e.currentTarget as SVGElement).closest('svg')?.getBoundingClientRect();
		if (!rect) return;
		tooltip = {
			visible: true,
			x: e.clientX - rect.left,
			y: e.clientY - rect.top,
			row
		};
	}

	function handleMouseMove(e: MouseEvent) {
		if (!tooltip.visible) return;
		const rect = (e.currentTarget as SVGElement).closest('svg')?.getBoundingClientRect();
		if (!rect) return;
		tooltip = { ...tooltip, x: e.clientX - rect.left, y: e.clientY - rect.top };
	}

	function handleMouseLeave() {
		tooltip = { visible: false, x: 0, y: 0, row: null };
	}
</script>

<div class="relative h-full w-full" bind:clientHeight={containerH} bind:clientWidth={containerW}>
	{#if containerW > 0 && containerH > 0 && sortedData.length > 0}
		<svg
			width={containerW}
			height={containerH}
			role="img"
			aria-label="Origin price range chart"
			onmousemove={handleMouseMove}
		>
			<!-- X-axis top label -->
			<text
				x={padding.left + innerW / 2}
				y={14}
				text-anchor="middle"
				font-size="10"
				fill="rgb(156 163 175)"
			>
				Price ($/lb)
			</text>

			<g transform="translate({padding.left},{padding.top})">
				<!-- Y axis labels -->
				<g bind:this={yAxisEl}></g>

				<!-- X axis at bottom -->
				<g bind:this={xAxisEl} transform="translate(0,{innerH})"></g>

				<!-- Gridlines -->
				{#each xScale.ticks(5) as t}
					<line
						x1={xScale(t)}
						x2={xScale(t)}
						y1={0}
						y2={innerH}
						stroke="rgb(156 163 175)"
						stroke-opacity="0.2"
						stroke-dasharray="4 4"
					/>
				{/each}

				<!-- Range rows -->
				{#each sortedData as row}
					{@const y = yScale(row.origin) ?? 0}
					{@const cy = y + yScale.bandwidth() / 2}
					{@const xMin = xScale(row.price_min)}
					{@const xMax = xScale(row.price_max)}
					{@const xQ1 = xScale(row.price_q1)}
					{@const xQ3 = xScale(row.price_q3)}
					{@const xMedian = xScale(row.price_median)}
					{@const xMean = xScale(row.price_avg)}

					<!-- Hit area for tooltip -->
					<rect
						role="img"
						aria-label="{row.origin} price range"
						x={xMin - 4}
						{y}
						width={xMax - xMin + 8}
						height={yScale.bandwidth()}
						fill="transparent"
						onmouseenter={(e) => handleMouseEnter(e, row)}
						onmouseleave={handleMouseLeave}
					/>

					<!-- Full range line (thin) -->
					<line
						x1={xMin}
						x2={xMax}
						y1={cy}
						y2={cy}
						stroke="rgb(156 163 175)"
						stroke-width="1.5"
						stroke-opacity="0.6"
					/>
					<!-- End caps -->
					<line
						x1={xMin}
						x2={xMin}
						y1={cy - 4}
						y2={cy + 4}
						stroke="rgb(156 163 175)"
						stroke-width="1.5"
						stroke-opacity="0.6"
					/>
					<line
						x1={xMax}
						x2={xMax}
						y1={cy - 4}
						y2={cy + 4}
						stroke="rgb(156 163 175)"
						stroke-width="1.5"
						stroke-opacity="0.6"
					/>

					<!-- IQR bar (thicker, amber, semi-transparent) -->
					<rect
						x={xQ1}
						y={cy - yScale.bandwidth() * 0.28}
						width={Math.max(0, xQ3 - xQ1)}
						height={yScale.bandwidth() * 0.56}
						fill="#f59e0b"
						fill-opacity="0.3"
						rx="2"
					/>

					<!-- Median circle (solid amber) -->
					<circle cx={xMedian} {cy} r="5" fill="#f59e0b" />

					<!-- Mean diamond (teal) -->
					{#if Math.abs(xMean - xMedian) > 1}
						<polygon
							points="{xMean},{cy - 5} {xMean + 4},{cy} {xMean},{cy + 5} {xMean - 4},{cy}"
							fill="#14b8a6"
						/>
					{/if}

					<!-- Sample size label (right-aligned) -->
					<text
						x={innerW + 4}
						y={cy}
						dominant-baseline="middle"
						font-size="10"
						fill="rgb(107 114 128)"
					>
						{row.sample_size}
					</text>
				{/each}
			</g>
		</svg>

		<!-- Legend -->
		<div
			class="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 px-2 text-xs text-text-secondary-light"
		>
			<div class="flex items-center gap-1">
				<div class="h-1 w-5 rounded bg-gray-400 opacity-60"></div>
				<span>Full range</span>
			</div>
			<div class="flex items-center gap-1">
				<div class="h-3 w-5 rounded bg-amber-400 opacity-30"></div>
				<span>IQR (Q1–Q3)</span>
			</div>
			<div class="flex items-center gap-1">
				<div class="h-3 w-3 rounded-full bg-amber-400"></div>
				<span>Median</span>
			</div>
			<div class="flex items-center gap-1">
				<div
					class="h-2.5 w-2.5 rotate-45 bg-teal-400"
					style="clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)"
				></div>
				<span>Mean</span>
			</div>
			<div class="ml-auto flex items-center gap-1 text-text-secondary-light/70">
				<span>N = bean count</span>
			</div>
		</div>

		<!-- Tooltip -->
		{#if tooltip.visible && tooltip.row}
			{@const r = tooltip.row}
			<div
				class="pointer-events-none absolute z-10 rounded-lg border border-border-light bg-background-primary-light px-3 py-2 text-xs shadow-lg"
				style="left:{Math.min(tooltip.x + 12, containerW - 180)}px; top:{Math.max(
					4,
					tooltip.y - 100
				)}px; min-width:160px"
			>
				<div class="mb-1 font-semibold text-text-primary-light">{r.origin}</div>
				<div class="space-y-0.5 text-text-secondary-light">
					<div class="flex justify-between gap-4">
						<span>Min</span><span class="font-medium text-text-primary-light"
							>${r.price_min.toFixed(2)}</span
						>
					</div>
					<div class="flex justify-between gap-4">
						<span>Q1</span><span class="font-medium text-text-primary-light"
							>${r.price_q1.toFixed(2)}</span
						>
					</div>
					<div class="flex justify-between gap-4">
						<span class="font-medium text-amber-500">Median</span><span
							class="font-semibold text-amber-500">${r.price_median.toFixed(2)}</span
						>
					</div>
					<div class="flex justify-between gap-4">
						<span class="text-teal-500">Mean</span><span class="font-medium text-teal-500"
							>${r.price_avg.toFixed(2)}</span
						>
					</div>
					<div class="flex justify-between gap-4">
						<span>Q3</span><span class="font-medium text-text-primary-light"
							>${r.price_q3.toFixed(2)}</span
						>
					</div>
					<div class="flex justify-between gap-4">
						<span>Max</span><span class="font-medium text-text-primary-light"
							>${r.price_max.toFixed(2)}</span
						>
					</div>
					<div class="mt-1 flex justify-between gap-4 border-t border-border-light pt-1">
						<span>N beans</span><span class="font-medium text-text-primary-light"
							>{r.sample_size}</span
						>
					</div>
				</div>
			</div>
		{/if}
	{/if}
</div>
