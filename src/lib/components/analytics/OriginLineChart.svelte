<script lang="ts">
	import { line as d3Line, curveMonotoneX } from 'd3-shape';
	import { scaleTime, scaleLinear } from 'd3-scale';
	import { extent, min } from 'd3-array';
	import { select } from 'd3-selection';

	interface SnapshotRow {
		snapshot_date: string;
		origin: string;
		price_avg: number | null;
		price_median: number | null;
		sample_size: number;
		wholesale_only: boolean;
	}

	let { snapshots = [] }: { snapshots: SnapshotRow[] } = $props();

	// Build top-5 origins by total sample_size (volume-ranked)
	const COLORS = [
		'#f59e0b',
		'#10b981',
		'#3b82f6',
		'#ec4899',
		'#8b5cf6',
		'#14b8a6',
		'#f97316',
		'#a855f7',
		'#06b6d4',
		'#84cc16'
	];

	// Minimum distinct snapshot dates required before showing chart
	const MIN_DISTINCT_DATES = 7;

	let distinctDateCount = $derived(new Set(snapshots.map((s) => s.snapshot_date)).size);
	let hasEnoughData = $derived(distinctDateCount >= MIN_DISTINCT_DATES);

	let originMap = $derived.by(() => {
		const map = new Map<string, { date: Date; value: number }[]>();
		for (const row of snapshots) {
			const price = row.price_median ?? row.price_avg;
			if (price == null) continue;
			if (!map.has(row.origin)) map.set(row.origin, []);
			map.get(row.origin)!.push({ date: new Date(row.snapshot_date), value: price });
		}
		return map;
	});

	// Compute total sample_size per origin for volume ranking
	let originVolume = $derived.by(() => {
		const vol = new Map<string, number>();
		for (const row of snapshots) {
			const price = row.price_median ?? row.price_avg;
			if (price == null) continue;
			vol.set(row.origin, (vol.get(row.origin) ?? 0) + (row.sample_size ?? 0));
		}
		return vol;
	});

	// All origins ranked by volume
	let allRankedOrigins = $derived.by(() => {
		const ranked: { origin: string; totalSamples: number }[] = [];
		for (const [origin] of originMap) {
			ranked.push({ origin, totalSamples: originVolume.get(origin) ?? 0 });
		}
		ranked.sort((a, b) => b.totalSamples - a.totalSamples);
		return ranked.map((r) => r.origin);
	});

	// User-selectable origins — default top 5 enabled
	let enabledOrigins = $state<Set<string>>(new Set());
	let enabledOriginsInitialized = $state(false);

	// Initialize enabledOrigins once we have data
	$effect(() => {
		if (!enabledOriginsInitialized && allRankedOrigins.length > 0) {
			enabledOrigins = new Set(allRankedOrigins.slice(0, 5));
			enabledOriginsInitialized = true;
		}
	});

	function toggleOrigin(origin: string) {
		const next = new Set(enabledOrigins);
		if (next.has(origin)) {
			next.delete(origin);
		} else {
			next.add(origin);
		}
		enabledOrigins = next;
	}

	// Color is assigned by rank in allRankedOrigins (stable palette)
	function originColor(origin: string): string {
		const idx = allRankedOrigins.indexOf(origin);
		return COLORS[idx % COLORS.length];
	}

	let seriesData = $derived.by(() =>
		allRankedOrigins
			.filter((origin) => enabledOrigins.has(origin))
			.map((origin) => ({
				origin,
				color: originColor(origin),
				points: [...(originMap.get(origin) ?? [])].sort(
					(a, b) => a.date.getTime() - b.date.getTime()
				)
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
			? [
					Math.max(0, (min(allValues) ?? 0) * 0.9),
					(() => {
						const sorted = [...allValues].sort((a, b) => a - b);
						const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 10;
						return p95 * 1.15;
					})()
				]
			: [0, 10]
	);

	const padding = { top: 20, right: 70, bottom: 40, left: 60 };

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
		// Guard against degenerate scale (0 or 1 date)
		if (dateRange === 0) return;
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

	// Hover tooltip state
	let mouseX = $state<number | null>(null);
	let mouseY = $state<number | null>(null);
	let isHovering = $state(false);

	interface TooltipRow {
		origin: string;
		color: string;
		price: number;
	}

	interface TooltipData {
		date: Date;
		x: number;
		rows: TooltipRow[];
	}

	let tooltipData = $derived.by((): TooltipData | null => {
		if (!isHovering || mouseX === null || innerW <= 0 || xScale == null || seriesData.length === 0)
			return null;

		// Convert pixel position to date
		const hoveredDate = xScale.invert(mouseX);
		const hoveredTime = hoveredDate.getTime();

		const rows: TooltipRow[] = [];
		for (const series of seriesData) {
			if (series.points.length === 0) continue;
			// Find nearest point
			let nearest = series.points[0];
			let minDiff = Math.abs(nearest.date.getTime() - hoveredTime);
			for (const pt of series.points) {
				const diff = Math.abs(pt.date.getTime() - hoveredTime);
				if (diff < minDiff) {
					minDiff = diff;
					nearest = pt;
				}
			}
			rows.push({ origin: series.origin, color: series.color, price: nearest.value });
		}

		return { date: hoveredDate, x: mouseX, rows };
	});

	function handleMouseMove(e: MouseEvent) {
		const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
		mouseX = e.clientX - rect.left;
		mouseY = e.clientY - rect.top;
		isHovering = true;
	}

	function handleMouseLeave() {
		isHovering = false;
		mouseX = null;
		mouseY = null;
	}

	// Tooltip position: keep within chart bounds
	let tooltipLeft = $derived.by(() => {
		if (tooltipData === null || mouseX === null) return 0;
		const tipWidth = 160;
		const chartRight = innerW;
		const x = tooltipData.x;
		// Flip to left side of cursor if near right edge
		if (x + 16 + tipWidth > chartRight) {
			return Math.max(0, x - tipWidth - 8);
		}
		return x + 16;
	});

	let tooltipTop = $derived.by(() => {
		if (mouseY === null) return 0;
		const tipHeight = (tooltipData?.rows.length ?? 0) * 22 + 36;
		return Math.max(0, Math.min(mouseY - tipHeight / 2, innerH - tipHeight));
	});
</script>

<div class="flex h-full w-full flex-col">
	{#if !hasEnoughData}
		<!-- Not enough data: show informative placeholder -->
		<div
			class="flex h-full w-full flex-col items-center justify-center rounded-lg bg-background-secondary-light px-6 text-center"
		>
			<div class="mb-2 text-2xl">📈</div>
			<p class="text-sm font-medium text-text-secondary-light">
				Price trend data collection started March 21, 2026.
			</p>
			<p class="mt-1 text-xs text-text-secondary-light">
				Charts will populate once 7+ days of data are available.
				{#if distinctDateCount > 0}
					<span class="mt-0.5 block text-text-secondary-light/60"
						>({distinctDateCount} of {MIN_DISTINCT_DATES} days collected)</span
					>
				{/if}
			</p>
		</div>
	{:else}
		<div class="min-h-0 flex-1" bind:clientHeight={containerH} bind:clientWidth={containerW}>
			{#if containerW > 0 && containerH > 0}
				<svg width={containerW} height={containerH} style="overflow: visible;">
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
								<path d={pathD} fill="none" stroke={series.color} stroke-width="2.5" />
							{/if}
							<!-- Dot + label on last point only -->
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

						<!-- Hover crosshair -->
						{#if tooltipData !== null}
							<line
								x1={tooltipData.x}
								x2={tooltipData.x}
								y1={0}
								y2={innerH}
								stroke="rgb(156 163 175)"
								stroke-width="1"
								stroke-dasharray="4 4"
								pointer-events="none"
							/>
						{/if}

						<!-- Invisible mouse capture rect -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<rect
							x={0}
							y={0}
							width={innerW}
							height={innerH}
							fill="transparent"
							onmousemove={handleMouseMove}
							onmouseleave={handleMouseLeave}
						/>

						<!-- Tooltip (rendered in SVG foreignObject for HTML styling) -->
						{#if tooltipData !== null}
							<foreignObject
								x={tooltipLeft}
								y={tooltipTop}
								width="164"
								height={tooltipData.rows.length * 22 + 38}
								pointer-events="none"
							>
								<div
									style="background:white; border:1px solid #e5e7eb; border-radius:6px; box-shadow:0 2px 8px rgba(0,0,0,0.12); padding:8px 10px; font-size:11px; line-height:1.4;"
								>
									<div style="color:#6b7280; font-weight:600; margin-bottom:4px;">
										{tooltipData.date.toLocaleDateString('en-US', {
											month: 'short',
											day: 'numeric',
											year: 'numeric'
										})}
									</div>
									{#each tooltipData.rows as row}
										<div style="display:flex; align-items:center; gap:5px; margin-top:2px;">
											<div
												style="width:8px; height:8px; border-radius:50%; background:{row.color}; flex-shrink:0;"
											></div>
											<span
												style="color:#374151; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"
												>{row.origin}</span
											>
											<span style="color:#111827; font-weight:600; flex-shrink:0;"
												>${row.price.toFixed(2)}</span
											>
										</div>
									{/each}
								</div>
							</foreignObject>
						{/if}
					</g>
				</svg>
			{/if}
		</div>

		<!-- Legend: all origins as clickable toggles -->
		{#if allRankedOrigins.length > 0}
			<div class="mt-4 flex flex-wrap gap-x-3 gap-y-2 border-t border-gray-200 px-6 pt-3">
				{#each allRankedOrigins as origin}
					{@const color = originColor(origin)}
					{@const active = enabledOrigins.has(origin)}
					{@const vol = originVolume.get(origin) ?? 0}
					<button
						type="button"
						onclick={() => toggleOrigin(origin)}
						class="flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-all"
						style={active
							? `background:${color}20; border-color:${color}; color:#374151;`
							: 'background:transparent; border-color:#d1d5db; color:#9ca3af;'}
					>
						<div
							class="h-2 w-2 flex-shrink-0 rounded-full"
							style={active ? `background:${color};` : 'background:#d1d5db;'}
						></div>
						{origin}
						{#if vol > 0}
							<span style="opacity:0.6;">({vol})</span>
						{/if}
					</button>
				{/each}
			</div>
		{/if}
	{/if}
</div>
