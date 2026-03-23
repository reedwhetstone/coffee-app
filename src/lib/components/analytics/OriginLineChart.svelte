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
		price_min: number | null;
		price_max: number | null;
		sample_size: number;
		wholesale_only: boolean;
	}

	let {
		snapshots = [],
		expanded = false
	}: { snapshots: SnapshotRow[]; expanded?: boolean } = $props();

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

	const MIN_DISTINCT_DATES = 7;

	let distinctDateCount = $derived(new Set(snapshots.map((s) => s.snapshot_date)).size);
	let hasEnoughData = $derived(distinctDateCount >= MIN_DISTINCT_DATES);

	interface DataPoint {
		date: Date;
		value: number;
		min: number | null;
		max: number | null;
	}

	let originMap = $derived.by(() => {
		const map = new Map<string, DataPoint[]>();
		for (const row of snapshots) {
			const price = row.price_median ?? row.price_avg;
			if (price == null) continue;
			if (!map.has(row.origin)) map.set(row.origin, []);
			map.get(row.origin)!.push({
				date: new Date(row.snapshot_date),
				value: price,
				min: row.price_min ?? null,
				max: row.price_max ?? null
			});
		}
		return map;
	});

	let originVolume = $derived.by(() => {
		const vol = new Map<string, number>();
		for (const row of snapshots) {
			const price = row.price_median ?? row.price_avg;
			if (price == null) continue;
			vol.set(row.origin, (vol.get(row.origin) ?? 0) + (row.sample_size ?? 0));
		}
		return vol;
	});

	let allRankedOrigins = $derived.by(() => {
		const ranked: { origin: string; totalSamples: number }[] = [];
		for (const [origin] of originMap) {
			ranked.push({ origin, totalSamples: originVolume.get(origin) ?? 0 });
		}
		ranked.sort((a, b) => b.totalSamples - a.totalSamples);
		return ranked.map((r) => r.origin);
	});

	// In dashboard mode: always top 5. In expanded mode: user-selectable.
	let enabledOrigins = $state<Set<string>>(new Set());
	let enabledOriginsInitialized = $state(false);

	$effect(() => {
		if (!enabledOriginsInitialized && allRankedOrigins.length > 0) {
			enabledOrigins = new Set(allRankedOrigins.slice(0, 5));
			enabledOriginsInitialized = true;
		}
	});

	// Dashboard mode always uses top 5, expanded mode uses user selection
	let visibleOrigins = $derived(
		expanded ? [...enabledOrigins] : allRankedOrigins.slice(0, 5)
	);

	function toggleOrigin(origin: string) {
		const next = new Set(enabledOrigins);
		if (next.has(origin)) {
			next.delete(origin);
		} else {
			next.add(origin);
		}
		enabledOrigins = next;
	}

	// Origin selector dropdown state (expanded mode only)
	let selectorOpen = $state(false);

	function originColor(origin: string): string {
		const idx = allRankedOrigins.indexOf(origin);
		return COLORS[idx % COLORS.length];
	}

	let seriesData = $derived.by(() =>
		visibleOrigins
			.map((origin) => ({
				origin,
				color: originColor(origin),
				points: [...(originMap.get(origin) ?? [])].sort(
					(a, b) => a.date.getTime() - b.date.getTime()
				)
			}))
	);

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

	interface TooltipRow {
		origin: string;
		color: string;
		price: number;
		min: number | null;
		max: number | null;
	}

	interface TooltipData {
		x: number;
		date: Date;
		rows: TooltipRow[];
	}

	let tooltipData = $derived.by((): TooltipData | null => {
		if (mouseX === null || innerW <= 0) return null;
		const hoveredDate = xScale.invert(mouseX);
		const rows: TooltipRow[] = [];
		for (const s of seriesData) {
			if (s.points.length === 0) continue;
			let closest = s.points[0];
			let closestDist = Math.abs(closest.date.getTime() - hoveredDate.getTime());
			for (const p of s.points) {
				const dist = Math.abs(p.date.getTime() - hoveredDate.getTime());
				if (dist < closestDist) {
					closest = p;
					closestDist = dist;
				}
			}
			rows.push({
				origin: s.origin,
				color: s.color,
				price: closest.value,
				min: closest.min,
				max: closest.max
			});
		}
		return rows.length > 0 ? { x: mouseX, date: hoveredDate, rows } : null;
	});

	let tooltipLeft = $derived.by(() => {
		if (!tooltipData) return 0;
		return tooltipData.x > innerW - 180 ? tooltipData.x - 170 : tooltipData.x + 12;
	});

	let tooltipTop = $derived(10);

	function handleMouseMove(e: MouseEvent) {
		const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
		mouseX = e.clientX - rect.left;
	}

	function handleMouseLeave() {
		mouseX = null;
	}
</script>

<div class="flex h-full w-full flex-col">
	{#if !hasEnoughData}
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
		<!-- Origin selector: only in expanded mode -->
		{#if expanded}
			<div class="mb-3 flex flex-wrap items-center gap-2">
				<span class="text-sm font-medium text-text-secondary-light">Origins:</span>
				<div class="relative">
					<button
						type="button"
						onclick={() => (selectorOpen = !selectorOpen)}
						class="flex items-center gap-1.5 rounded-md border border-border-light bg-background-secondary-light px-3 py-1.5 text-sm text-text-primary-light transition-colors hover:border-background-tertiary-light"
					>
						{enabledOrigins.size} of {allRankedOrigins.length} selected
						<svg class="h-4 w-4 text-text-secondary-light" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
						</svg>
					</button>
					{#if selectorOpen}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div class="absolute left-0 top-full z-20 mt-1 max-h-64 w-64 overflow-y-auto rounded-lg border border-border-light bg-background-primary-light shadow-lg">
							<div class="border-b border-border-light px-3 py-2">
								<div class="flex gap-2">
									<button
										type="button"
										onclick={() => { enabledOrigins = new Set(allRankedOrigins.slice(0, 5)); }}
										class="text-xs font-medium text-background-tertiary-light hover:underline"
									>Top 5</button>
									<button
										type="button"
										onclick={() => { enabledOrigins = new Set(allRankedOrigins.slice(0, 10)); }}
										class="text-xs font-medium text-background-tertiary-light hover:underline"
									>Top 10</button>
									<button
										type="button"
										onclick={() => { enabledOrigins = new Set(allRankedOrigins); }}
										class="text-xs font-medium text-background-tertiary-light hover:underline"
									>All</button>
									<button
										type="button"
										onclick={() => { enabledOrigins = new Set(); }}
										class="text-xs font-medium text-red-500 hover:underline"
									>Clear</button>
								</div>
							</div>
							{#each allRankedOrigins as origin}
								{@const active = enabledOrigins.has(origin)}
								{@const color = originColor(origin)}
								{@const vol = originVolume.get(origin) ?? 0}
								<button
									type="button"
									onclick={() => toggleOrigin(origin)}
									class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-background-secondary-light"
								>
									<div
										class="h-3 w-3 flex-shrink-0 rounded-sm border"
										style={active
											? `background:${color}; border-color:${color};`
											: 'background:transparent; border-color:#d1d5db;'}
									></div>
									<span class={active ? 'text-text-primary-light' : 'text-text-secondary-light'}>{origin}</span>
									<span class="ml-auto text-xs text-text-secondary-light/60">({vol})</span>
								</button>
							{/each}
						</div>
					{/if}
				</div>
				<!-- Active origin chips (compact) -->
				{#each visibleOrigins.slice(0, 8) as origin}
					<span
						class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
						style="background:{originColor(origin)}15; color:{originColor(origin)};"
					>
						<div class="h-1.5 w-1.5 rounded-full" style="background:{originColor(origin)};"></div>
						{origin}
					</span>
				{/each}
				{#if visibleOrigins.length > 8}
					<span class="text-xs text-text-secondary-light">+{visibleOrigins.length - 8} more</span>
				{/if}
			</div>
		{/if}

		<!-- Chart area: flexible height -->
		<div class="min-h-0 flex-1" bind:clientHeight={containerH} bind:clientWidth={containerW}>
			{#if containerW > 0 && containerH > 0}
				<svg width={containerW} height={containerH}>
					<g transform="translate({padding.left},{padding.top})">
						<g bind:this={xAxisEl} transform="translate(0,{innerH})"></g>
						<g bind:this={yAxisEl}></g>

						<!-- Lines -->
						{#each seriesData as series}
							{@const lineGen = d3Line<DataPoint>()
								.x((d) => xScale(d.date))
								.y((d) => yScale(d.value))
								.curve(curveMonotoneX)}
							{@const pathD = lineGen(series.points)}
							{#if pathD}
								<path d={pathD} fill="none" stroke={series.color} stroke-width="2.5" />
							{/if}
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

						{#if tooltipData !== null}
							<foreignObject
								x={tooltipLeft}
								y={tooltipTop}
								width="164"
								height={tooltipData.rows.length * 36 + 38}
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
										{#if row.min != null && row.max != null}
											<div style="margin-left:13px; font-size:10px; color:#9ca3af;">
												${row.min.toFixed(2)} – ${row.max.toFixed(2)}
											</div>
										{/if}
									{/each}
								</div>
							</foreignObject>
						{/if}
					</g>
				</svg>
			{/if}
		</div>

		<!-- Dashboard legend: simple color dots + names (no toggles) -->
		{#if !expanded && seriesData.length > 0}
			<div class="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-gray-200 px-4 pt-2">
				{#each seriesData as series}
					<div class="flex items-center gap-1.5 text-xs text-text-secondary-light">
						<div class="h-2.5 w-2.5 rounded-full" style="background:{series.color}"></div>
						{series.origin}
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>
