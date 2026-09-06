<script lang="ts">
	import {
		reconstructTrend,
		RECONSTRUCTION_VERSION,
		type ReconstructedPoint
	} from './reconstructedTrend';
	import { CHART_SERIES } from '$lib/styles/chartColors';
	import { line as d3Line } from 'd3-shape';
	import {
		dailySegments,
		trendDomain,
		inspectionDate,
		observationOnDate,
		UTC_DAY_MS,
		cohortSeriesLabel
	} from './originTrend';
	import { scaleUtc, scaleLinear } from 'd3-scale';
	import { extent } from 'd3-array';
	import { select } from 'd3-selection';

	interface SnapshotRow {
		snapshot_date: string;
		origin: string;
		price_avg: number | null;
		price_median: number | null;
		price_min: number | null;
		price_max: number | null;
		price_p25: number | null;
		price_p75: number | null;
		sample_size: number;
		supplier_count?: number;
		wholesale_only: boolean;
		synthetic?: boolean;
	}

	interface SpreadRow {
		origin: string;
		snapshot_date: string;
		spread_pct: number;
		retail_price: number;
		wholesale_price: number;
	}

	let {
		snapshots = [],
		expanded = false,
		mode = 'price',
		spreadData = [],
		startDate = ''
	}: {
		snapshots: SnapshotRow[];
		expanded?: boolean;
		mode?: 'price' | 'spread';
		spreadData?: SpreadRow[];
		startDate?: string;
	} = $props();

	const COLORS = CHART_SERIES;
	const componentId = $props.id();

	const MIN_DISTINCT_DATES = 7;

	let includeEstimates = $state(false);
	let priceView = $state<'trend' | 'recorded'>('trend');
	let isReconstructed = $derived(mode === 'price' && (!expanded || priceView === 'trend'));
	let chartRoot: HTMLDivElement | undefined = $state();
	let pinned = $state(false);
	let keyboardInspection = $state(false);
	let hasEstimates = $derived(snapshots.some((row) => row.synthetic));
	let observedSnapshots = $derived(snapshots.filter((row) => includeEstimates || !row.synthetic));
	let activeData = $derived(
		mode === 'spread' ? spreadData : observedSnapshots.filter((s) => s.snapshot_date >= startDate)
	);
	let distinctDateCount = $derived(new Set(activeData.map((s) => s.snapshot_date)).size);

	interface DataPoint {
		date: Date;
		value: number;
		p25: number | null;
		p75: number | null;
		statistic?: 'Median' | 'Average' | 'Trend estimate';
		reconstruction?: ReconstructedPoint;
		sampleSize?: number;
		supplierCount?: number;
		synthetic?: boolean;
		retailPrice?: number;
		wholesalePrice?: number;
	}

	let mixedCohorts = $derived(new Set(snapshots.map((s) => s.wholesale_only)).size > 1);
	let priceRows = $derived(
		observedSnapshots
			.filter((s) => s.snapshot_date >= startDate)
			.map((s) => ({
				...s,
				origin: cohortSeriesLabel(s.origin, s.wholesale_only, mixedCohorts)
			}))
	);

	let originMap = $derived.by(() => {
		const map = new Map<string, DataPoint[]>();
		if (mode === 'spread') {
			for (const row of spreadData) {
				if (!Number.isFinite(row.spread_pct)) continue;
				if (!map.has(row.origin)) map.set(row.origin, []);
				map.get(row.origin)!.push({
					date: new Date(row.snapshot_date),
					value: row.spread_pct,
					p25: null,
					p75: null,
					retailPrice: row.retail_price,
					wholesalePrice: row.wholesale_price
				});
			}
		} else if (isReconstructed) {
			const groups = new Map<string, SnapshotRow[]>();
			for (const row of snapshots) {
				const label = cohortSeriesLabel(row.origin, row.wholesale_only, mixedCohorts);
				groups.set(label, [...(groups.get(label) ?? []), row]);
			}
			for (const [label, rows] of groups) {
				const points = reconstructTrend(rows).filter(
					(p) => p.date.toISOString().slice(0, 10) >= startDate
				);
				if (!points.length) continue;
				map.set(
					label,
					points.map((p) => ({
						date: p.date,
						value: p.value,
						p25: null,
						p75: null,
						statistic: p.kind === 'recorded_anchor' ? 'Median' : 'Trend estimate',
						reconstruction: p,
						sampleSize: p.original?.sample_size,
						supplierCount: p.original?.supplier_count
					}))
				);
			}
		} else {
			for (const row of priceRows) {
				const price = row.price_median ?? row.price_avg;
				if (price == null || !Number.isFinite(price)) continue;
				if (!map.has(row.origin)) map.set(row.origin, []);
				map.get(row.origin)!.push({
					date: new Date(row.snapshot_date),
					value: price,
					p25: row.price_p25 ?? null,
					p75: row.price_p75 ?? null,
					statistic: row.price_median != null ? 'Median' : 'Average',
					synthetic: row.synthetic ?? false,
					sampleSize: row.sample_size,
					supplierCount: row.supplier_count
				});
			}
		}
		return map;
	});

	let hasEnoughData = $derived(
		isReconstructed
			? [...originMap.values()].some((points) => points.length >= MIN_DISTINCT_DATES)
			: distinctDateCount >= MIN_DISTINCT_DATES
	);

	let originVolume = $derived.by(() => {
		const vol = new Map<string, number>();
		if (mode === 'spread') {
			// In spread mode, volume = number of data points per origin
			for (const row of spreadData) {
				vol.set(row.origin, (vol.get(row.origin) ?? 0) + 1);
			}
		} else {
			for (const row of priceRows) {
				const price = row.price_median ?? row.price_avg;
				if (price == null || !Number.isFinite(price)) continue;
				vol.set(row.origin, (vol.get(row.origin) ?? 0) + (row.sample_size ?? 0));
			}
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
	let originSelectionKey = $state('');

	$effect(() => {
		const key = [...allRankedOrigins].sort().join('|');
		if (key !== originSelectionKey) {
			const retained = [...enabledOrigins].filter((origin) => allRankedOrigins.includes(origin));
			enabledOrigins = new Set(retained.length ? retained : allRankedOrigins.slice(0, 5));
			originSelectionKey = key;
		}
	});

	// Dashboard mode always uses top 5, expanded mode uses user selection
	let visibleOrigins = $derived(expanded ? [...enabledOrigins] : allRankedOrigins.slice(0, 5));

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
		visibleOrigins.map((origin) => ({
			origin,
			color: originColor(origin),
			points: [...(originMap.get(origin) ?? [])].sort((a, b) => a.date.getTime() - b.date.getTime())
		}))
	);

	let allValues = $derived(seriesData.flatMap((s) => s.points.map((p) => p.value)));
	let allDates = $derived(seriesData.flatMap((s) => s.points.map((p) => p.date)));

	let xDomain = $derived(
		allDates.length >= 2 ? (extent(allDates) as [Date, Date]) : [new Date(), new Date()]
	);
	let yDomain = $derived(trendDomain(allValues, mode === 'spread'));

	const padding = { top: 12, right: 16, bottom: 32, left: 54 };

	let containerH = $state(0);
	let containerW = $state(0);

	let innerW = $derived(Math.max(0, containerW - padding.left - padding.right));
	let innerH = $derived(Math.max(0, containerH - padding.top - padding.bottom));

	let xScale = $derived(scaleUtc().domain(xDomain).range([0, innerW]));
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
			.attr('stroke', '#a39a8c');
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
				.attr('stroke', '#a39a8c');
			g.append('text')
				.attr('x', x)
				.attr('y', 18)
				.attr('text-anchor', 'middle')
				.attr('fill', '#a39a8c')
				.attr('font-size', '11')
				.text(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }));
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
			.attr('stroke', '#a39a8c');
		const ticks = yScale.ticks(5);
		ticks.forEach((t) => {
			const y = yScale(t);
			g.append('line')
				.attr('x1', -5)
				.attr('x2', 0)
				.attr('y1', y)
				.attr('y2', y)
				.attr('stroke', '#a39a8c');
			g.append('text')
				.attr('x', -10)
				.attr('y', y)
				.attr('text-anchor', 'end')
				.attr('dominant-baseline', 'middle')
				.attr('fill', '#a39a8c')
				.attr('font-size', '11')
				.text(mode === 'spread' ? `${t > 0 ? '+' : ''}${t.toFixed(1)}%` : `$${t.toFixed(2)}`);
			g.append('line')
				.attr('x1', 0)
				.attr('x2', innerW)
				.attr('y1', y)
				.attr('y2', y)
				.attr('stroke', '#a39a8c')
				.attr('stroke-opacity', '0.2')
				.attr('stroke-dasharray', '4 4');
		});

		// Zero reference line for spread mode
		if (mode === 'spread') {
			const zeroY = yScale(0);
			if (zeroY >= 0 && zeroY <= innerH) {
				g.append('line')
					.attr('x1', 0)
					.attr('x2', innerW)
					.attr('y1', zeroY)
					.attr('y2', zeroY)
					.attr('stroke', '#695c4d')
					.attr('stroke-width', '1.5')
					.attr('stroke-dasharray', '6 3');
			}
		}
	});

	let selectedDate = $state<Date | null>(null);
	let inspection = $derived(
		selectedDate && +selectedDate >= +xDomain[0] && +selectedDate <= +xDomain[1]
			? inspectionDate(selectedDate)
			: null
	);
	let inspectionX = $derived(inspection ? xScale(inspection) : null);
	let inspectedRows = $derived(
		seriesData.map((series) => ({
			...series,
			point: inspection ? observationOnDate(series.points, inspection) : series.points.at(-1)
		}))
	);

	function formatDate(date: Date): string {
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			timeZone: 'UTC'
		});
	}

	function formatValue(value: number): string {
		return mode === 'spread'
			? `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
			: `$${value.toFixed(2)}`;
	}

	function dismissInspection() {
		selectedDate = null;
		pinned = false;
		keyboardInspection = false;
	}
	function outsidePointer(e: PointerEvent) {
		if (chartRoot && e.target instanceof Node && !chartRoot.contains(e.target)) dismissInspection();
	}
	function leaveChart() {
		if (!pinned && !keyboardInspection) selectedDate = null;
	}
	let tooltipWidth = $derived(Math.min(expanded ? 310 : 260, Math.max(0, containerW - 16)));
	let tooltipLeft = $derived(
		Math.max(8, Math.min(containerW - tooltipWidth - 8, (inspectionX ?? 0) + padding.left + 12))
	);
	function handlePointer(e: PointerEvent) {
		keyboardInspection = false;
		if (e.type === 'pointerdown') pinned = e.pointerType !== 'mouse';
		const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
		selectedDate = inspectionDate(
			xScale.invert(Math.max(0, Math.min(innerW, e.clientX - rect.left)))
		);
	}
</script>

<svelte:window
	onpointerdown={outsidePointer}
	onkeydown={(e) => {
		if (e.key === 'Escape') dismissInspection();
	}}
/>
<div class="flex h-full min-h-0 w-full flex-col" bind:this={chartRoot}>
	{#if mode === 'price' && expanded}
		<div class="mb-2 flex gap-1" aria-label="Price history view">
			{#each [{ value: 'trend', label: 'Reconstructed trend' }, { value: 'recorded', label: 'Recorded prices' }] as option}
				<button
					type="button"
					class="min-h-11 rounded-md border border-line px-3 text-xs font-medium {priceView ===
					option.value
						? 'bg-surface-panel text-ink'
						: 'text-muted'}"
					aria-pressed={priceView === option.value}
					onclick={() => {
						priceView = option.value as 'trend' | 'recorded';
					}}>{option.label}</button
				>
			{/each}
		</div>
		{#if isReconstructed}
			<details class="mb-2 text-xs text-muted">
				<summary class="cursor-pointer py-2">Includes estimated periods · Methodology</summary>
				<p class="py-2">
					Published medians anchor the trend when sample and supplier counts each reach 60% of their
					local 28-day baseline. Other dates are estimated between those anchors. This reduces
					coverage-dropout jumps; it does not measure price changes during missing periods or fully
					correct supplier mix. No estimates extend beyond supported history. Method: {RECONSTRUCTION_VERSION}.
				</p>
			</details>
		{/if}
	{/if}
	{#if mode === 'price' && expanded && !isReconstructed && hasEstimates}
		<label class="mb-2 flex min-h-11 items-center gap-2 text-xs text-muted">
			<input
				type="checkbox"
				bind:checked={includeEstimates}
				class="rounded border-line accent-accent"
			/>
			Include historical estimates (not observed prices)
		</label>
	{/if}
	{#if !hasEnoughData}
		<div
			class="flex h-full w-full flex-col items-center justify-center rounded-lg bg-surface-panel px-6 text-center"
		>
			<div class="mb-2 text-2xl">📈</div>
			<p class="text-sm font-medium text-muted">
				{isReconstructed
					? 'Not enough supported history in this range.'
					: 'Not enough published history in this range.'}
			</p>
			<p class="mt-1 text-xs text-muted">
				{isReconstructed
					? expanded
						? 'Try Recorded prices to inspect the available observations.'
						: 'Expand the chart to inspect the available recorded prices.'
					: 'Charts will populate once 7+ days of data are available.'}
				{#if distinctDateCount > 0}
					<span class="mt-0.5 block text-muted/60"
						>({distinctDateCount} of {MIN_DISTINCT_DATES} days collected)</span
					>
				{/if}
			</p>
		</div>
	{:else}
		<!-- Origin selector: only in expanded mode -->
		{#if expanded}
			<div class="mb-3 flex flex-wrap items-center gap-2">
				<span class="text-sm font-medium text-muted">{mixedCohorts ? 'Series:' : 'Origins:'}</span>
				<div class="relative">
					<button
						type="button"
						onclick={() => (selectorOpen = !selectorOpen)}
						aria-expanded={selectorOpen}
						class="flex min-h-11 items-center gap-1.5 rounded-md border border-line bg-surface-panel px-3 py-1.5 text-sm text-ink transition-colors hover:border-accent"
					>
						{enabledOrigins.size} of {allRankedOrigins.length} selected
						<svg class="h-4 w-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M19 9l-7 7-7-7"
							/>
						</svg>
					</button>
					{#if selectorOpen}
						<div
							class="absolute left-0 top-full z-20 mt-1 max-h-64 w-64 overflow-y-auto rounded-lg border border-line bg-surface-canvas shadow-lg"
						>
							<div class="border-b border-line px-3 py-2">
								<div class="flex gap-2">
									<button
										type="button"
										onclick={() => {
											enabledOrigins = new Set(allRankedOrigins.slice(0, 5));
										}}
										class="text-xs font-medium text-accent hover:underline">Top 5</button
									>
									<button
										type="button"
										onclick={() => {
											enabledOrigins = new Set(allRankedOrigins.slice(0, 10));
										}}
										class="text-xs font-medium text-accent hover:underline">Top 10</button
									>
									<button
										type="button"
										onclick={() => {
											enabledOrigins = new Set(allRankedOrigins);
										}}
										class="text-xs font-medium text-accent hover:underline">All</button
									>
									<button
										type="button"
										onclick={() => {
											enabledOrigins = new Set();
										}}
										class="text-xs font-medium text-danger hover:underline">Clear</button
									>
								</div>
							</div>
							{#each allRankedOrigins as origin}
								{@const active = enabledOrigins.has(origin)}
								{@const color = originColor(origin)}
								{@const vol = originVolume.get(origin) ?? 0}
								<button
									type="button"
									onclick={() => toggleOrigin(origin)}
									aria-pressed={active}
									class="flex min-h-11 w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-surface-panel"
								>
									<div
										class="h-3 w-3 flex-shrink-0 rounded-sm border"
										style={active
											? `background:${color}; border-color:${color};`
											: 'background:transparent; border-color:#d1d5db;'}
									></div>
									<span class={active ? 'text-ink' : 'text-muted'}>{origin}</span>
									<span class="ml-auto text-xs text-muted/60">({vol})</span>
								</button>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Chart area: flexible height -->
		<div
			class="relative min-h-56 flex-1"
			bind:clientHeight={containerH}
			bind:clientWidth={containerW}
			onpointerleave={leaveChart}
		>
			{#if containerW > 0 && containerH > 0}
				<svg
					width={containerW}
					height={containerH}
					role="img"
					aria-label={isReconstructed
						? 'Reconstructed origin price trend. Includes estimates. Hover, tap or use the date control to inspect.'
						: 'Published origin trend chart. Hover, tap or use the date control to inspect.'}
				>
					<g transform="translate({padding.left},{padding.top})">
						<g bind:this={xAxisEl} transform="translate(0,{innerH})"></g>
						<g bind:this={yAxisEl}></g>

						{#each seriesData as series}
							{@const lineGen = d3Line<DataPoint>()
								.x((d) => xScale(d.date))
								.y((d) => yScale(d.value))}
							{#each isReconstructed ? [series.points] : dailySegments(series.points) as segment}
								<path
									d={lineGen(segment) ?? ''}
									fill="none"
									stroke={series.color}
									stroke-width="2"
									stroke-dasharray={segment[0].synthetic ? '5 4' : undefined}
								/>
								{#each segment.length === 1 ? segment : [segment[0], segment[segment.length - 1]] as point}
									<circle
										cx={xScale(point.date)}
										cy={yScale(point.value)}
										r={point.synthetic ? 4 : 2.5}
										fill={point.synthetic ? 'none' : series.color}
										stroke={point.synthetic ? series.color : 'none'}
										stroke-width={point.synthetic ? 2 : undefined}
									/>
								{/each}
							{/each}
						{/each}
						{#if inspectionX !== null}
							<line
								x1={inspectionX}
								x2={inspectionX}
								y1={0}
								y2={innerH}
								stroke="#a39a8c"
								stroke-dasharray="4 4"
							/>
						{/if}
						<!-- The date slider below provides the equivalent keyboard interaction. -->
						<rect
							x={0}
							y={0}
							width={innerW}
							height={innerH}
							fill="transparent"
							style="touch-action: pan-y;"
							onpointerdown={handlePointer}
							onpointermove={handlePointer}
						/>
					</g>
				</svg>
			{/if}
			{#if inspection}
				<aside
					aria-label="Price inspection"
					class="absolute top-2 z-10 max-h-[85%] overflow-y-auto rounded-lg border border-line bg-surface-canvas p-3 shadow-lg"
					style="left:{tooltipLeft}px;width:{tooltipWidth}px;"
				>
					<div class="mb-2 flex items-center justify-between gap-2 border-b border-line pb-2">
						<p class="text-xs font-medium text-ink">{formatDate(inspection)} · UTC</p>
						{#if pinned || keyboardInspection}<button
								type="button"
								aria-label="Close price inspection"
								class="flex h-8 w-8 items-center justify-center rounded text-muted hover:bg-surface-panel"
								onclick={dismissInspection}>×</button
							>{/if}
					</div>

					<div class="grid gap-2" aria-live="polite">
						{#each inspectedRows as row}
							<div class="flex min-w-0 items-start gap-2 text-xs">
								<span class="mt-1 h-2 w-2 shrink-0 rounded-full" style="background:{row.color}"
								></span>
								<div class="min-w-0 flex-1">
									<span class="text-ink">{row.origin}</span>
									{#if expanded && row.point}<span class="block text-muted"
											>{!inspection ? formatDate(row.point.date) + ' · ' : ''}{row.point
												.statistic ?? 'Spread'}{row.point.synthetic
												? ' · Historical estimate'
												: ''}</span
										>{/if}
									{#if expanded && row.point?.reconstruction && row.point.reconstruction.kind !== 'recorded_anchor'}
										<span class="block text-muted"
											>Between {row.point.reconstruction.anchorDates.join(' and ')} · {row.point
												.reconstruction.intervalDays}-day interval</span
										>
										{#if row.point.reconstruction.original}<span class="block text-muted"
												>Recorded median: {formatValue(
													row.point.reconstruction.original.price_median!
												)}
												· reduced coverage</span
											>{/if}
									{/if}
									{#if expanded && row.point?.sampleSize != null}
										<span class="block text-muted"
											>{row.point.sampleSize.toLocaleString()} prices{row.point.supplierCount !=
											null
												? ` · ${row.point.supplierCount} suppliers`
												: ''}</span
										>
									{/if}
								</div>
								<span class="shrink-0 font-medium tabular-nums text-ink"
									>{row.point
										? formatValue(row.point.value)
										: 'No published index'}{#if !expanded && row.point?.reconstruction && row.point.reconstruction.kind !== 'recorded_anchor'}<span
											class="ml-1 text-[10px] font-normal text-muted">est.</span
										>{/if}</span
								>
							</div>
						{/each}
					</div>
				</aside>
			{/if}
		</div>

		<div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Chart legend">
			{#each seriesData as series}
				<span class="flex items-center gap-1.5"
					><span class="h-2 w-2 rounded-full" style="background:{series.color}"
					></span>{series.origin}</span
				>
			{/each}
		</div>
		{#if mode === 'price' && !expanded}<p class="mt-2 text-xs text-muted">
				Includes estimated periods · Hover or tap to inspect
			</p>{/if}
		<div class={expanded ? 'mt-3 shrink-0' : 'sr-only focus-within:not-sr-only focus-within:mt-2'}>
			<label for="trend-date-{componentId}" class="text-xs text-muted"
				>{inspection ? formatDate(inspection) + ' · UTC' : 'Inspect a date'}</label
			>
			<input
				id="trend-date-{componentId}"
				aria-label="Inspect observation date"
				aria-valuetext={formatDate(inspection ?? xDomain[1]) + ' · UTC'}
				type="range"
				class="h-8 w-full accent-accent"
				min={+xDomain[0]}
				max={+xDomain[1]}
				step={UTC_DAY_MS}
				value={+(inspection ?? xDomain[1])}
				onfocus={() => {
					keyboardInspection = true;
					selectedDate ??= inspectionDate(xDomain[1]);
				}}
				oninput={(e) => {
					keyboardInspection = true;
					selectedDate = new Date(Number(e.currentTarget.value));
				}}
			/>
		</div>
	{/if}
</div>
