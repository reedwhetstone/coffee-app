<script lang="ts">
	import { max } from 'd3-array';
	import { scaleBand, scaleLinear } from 'd3-scale';
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

	const DEFAULT_VISIBLE_COUNT = 8;
	const COLLAPSED_CHART_HEIGHT = 320;
	const MIN_EXPANDED_CHART_HEIGHT = 360;
	const EXPANDED_BASE_HEIGHT = 110;
	const ROW_HEIGHT = 34;
	const padding = { top: 32, right: 72, bottom: 36, left: 132 };

	let { data = [], expanded = false }: { data: OriginRangeRow[]; expanded?: boolean } = $props();

	let containerW = $state(0);
	let selectorOpen = $state(false);
	let selectedOrigins = $state<Set<string>>(new Set());
	let selectionInitialized = $state(false);

	function abbreviateOrigin(name: string, narrow: boolean): string {
		if (!narrow) return name;
		const abbrevMap: Record<string, string> = {
			'Papua New Guinea': 'P. New Guinea',
			'Dominican Republic': 'Dom. Republic',
			'Democratic Republic of Congo': 'DR Congo',
			'Central African Republic': 'C. African Rep.'
		};
		if (abbrevMap[name]) return abbrevMap[name];
		if (name.length > 14) return name.slice(0, 13) + '…';
		return name;
	}

	function sortRowsByMedian(rows: OriginRangeRow[]): OriginRangeRow[] {
		return [...rows].sort(
			(a, b) =>
				a.price_median - b.price_median ||
				b.sample_size - a.sample_size ||
				a.origin.localeCompare(b.origin)
		);
	}

	function clampX(value: number, width: number): number {
		return Math.max(0, Math.min(width, value));
	}

	function topOriginSet(rows: OriginRangeRow[], count: number): Set<string> {
		return new Set(rows.slice(0, count).map((row) => row.origin));
	}

	function getTailScaleUpper(maxValue: number): number {
		if (maxValue <= 25) return 25;
		if (maxValue <= 100) return 100;
		if (maxValue <= 250) return 250;
		if (maxValue <= 500) return 500;
		if (maxValue <= 1000) return 1000;
		return Math.ceil(maxValue / 250) * 250;
	}

	function getTailTickValues(upper: number): number[] {
		if (upper <= 25) return [0, 5, 10, 15, 20, 25];
		if (upper <= 100) return [0, 5, 10, 25, 50, 100];
		if (upper <= 250) return [0, 10, 25, 100, 250];
		if (upper <= 500) return [0, 10, 25, 100, 250, 500];
		if (upper <= 1000) return [0, 10, 25, 100, 250, 500, 1000];
		return [0, 10, 25, 100, 250, 500, 1000, upper];
	}

	function buildTailCompressedScale(width: number, upper: number) {
		if (upper <= 25) {
			return scaleLinear()
				.domain([0, 10, 25])
				.range([0, width * 0.4, width])
				.clamp(true);
		}

		if (upper <= 100) {
			return scaleLinear()
				.domain([0, 10, 25, 100])
				.range([0, width * 0.32, width * 0.7, width])
				.clamp(true);
		}

		return scaleLinear()
			.domain([0, 10, 25, 100, upper])
			.range([0, width * 0.3, width * 0.68, width * 0.9, width])
			.clamp(true);
	}

	function formatTailTick(value: number): string {
		if (value >= 1000) return `$${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
		return `$${value.toFixed(0)}`;
	}

	let rankedRows = $derived.by(() =>
		[...data].sort(
			(a, b) =>
				b.sample_size - a.sample_size ||
				a.price_median - b.price_median ||
				a.origin.localeCompare(b.origin)
		)
	);

	$effect(() => {
		if (!selectionInitialized && rankedRows.length > 0) {
			selectedOrigins = topOriginSet(rankedRows, DEFAULT_VISIBLE_COUNT);
			selectionInitialized = true;
		}
	});

	$effect(() => {
		if (!selectionInitialized) return;
		const validOrigins = new Set(rankedRows.map((row) => row.origin));
		let changed = false;
		const next = new Set<string>();
		for (const origin of selectedOrigins) {
			if (validOrigins.has(origin)) next.add(origin);
			else changed = true;
		}
		if (changed) selectedOrigins = next;
	});

	let visibleRows = $derived.by(() => {
		if (!expanded) return sortRowsByMedian(rankedRows.slice(0, DEFAULT_VISIBLE_COUNT));
		return sortRowsByMedian(rankedRows.filter((row) => selectedOrigins.has(row.origin)));
	});

	let chartHeight = $derived(
		expanded
			? Math.max(MIN_EXPANDED_CHART_HEIGHT, visibleRows.length * ROW_HEIGHT + EXPANDED_BASE_HEIGHT)
			: COLLAPSED_CHART_HEIGHT
	);

	let innerW = $derived(Math.max(0, containerW - padding.left - padding.right));
	let innerH = $derived(Math.max(0, chartHeight - padding.top - padding.bottom));
	let isNarrow = $derived(containerW < 500);

	let yScale = $derived(
		scaleBand()
			.domain(visibleRows.map((row) => row.origin))
			.range([0, innerH])
			.padding(expanded ? 0.28 : 0.34)
	);

	let tailScaleUpper = $derived.by(() => {
		const absoluteMax = max(visibleRows.map((row) => row.price_max)) ?? 25;
		return getTailScaleUpper(Math.max(absoluteMax, 25));
	});
	let tailTicks = $derived(getTailTickValues(tailScaleUpper));
	let xScale = $derived(buildTailCompressedScale(innerW, tailScaleUpper));

	let xAxisEl: SVGGElement | undefined = $state();
	let yAxisEl: SVGGElement | undefined = $state();

	$effect(() => {
		if (!yAxisEl || innerH <= 0) return;
		const g = select(yAxisEl);
		g.selectAll('*').remove();
		visibleRows.forEach((row) => {
			const y = (yScale(row.origin) ?? 0) + yScale.bandwidth() / 2;
			g.append('text')
				.attr('x', -8)
				.attr('y', y)
				.attr('text-anchor', 'end')
				.attr('dominant-baseline', 'middle')
				.attr('fill', 'rgb(107 114 128)')
				.attr('font-size', '12')
				.text(abbreviateOrigin(row.origin, isNarrow));
		});
	});

	$effect(() => {
		if (!xAxisEl || innerW <= 0) return;
		const g = select(xAxisEl);
		g.selectAll('*').remove();
		g.append('line')
			.attr('x1', 0)
			.attr('x2', innerW)
			.attr('y1', 0)
			.attr('y2', 0)
			.attr('stroke', 'rgb(156 163 175)');
		tailTicks.forEach((tick) => {
			const x = xScale(tick);
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
				.text(formatTailTick(tick));
		});
	});

	function toggleOrigin(origin: string) {
		const next = new Set(selectedOrigins);
		if (next.has(origin)) next.delete(origin);
		else next.add(origin);
		selectedOrigins = next;
	}

	function setTopOrigins(count: number) {
		selectedOrigins = topOriginSet(rankedRows, count);
	}

	function selectAllOrigins() {
		selectedOrigins = new Set(rankedRows.map((row) => row.origin));
	}

	function clearOrigins() {
		selectedOrigins = new Set();
	}

	// Tooltip state
	let tooltip = $state<{
		visible: boolean;
		x: number;
		y: number;
		row: OriginRangeRow | null;
	}>({ visible: false, x: 0, y: 0, row: null });

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

<div class="flex w-full flex-col">
	<div
		class="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-text-secondary-light"
	>
		<div>
			{#if expanded}
				{#if visibleRows.length > 0}
					Showing {visibleRows.length} selected origin{visibleRows.length === 1 ? '' : 's'}; rows
					stay sorted by median $/lb.
				{:else}
					No origins selected yet; use the selector to choose which origins to compare.
				{/if}
			{:else}
				Showing the top {Math.min(DEFAULT_VISIBLE_COUNT, rankedRows.length)} origins by bean count; rows
				stay sorted by median $/lb.
			{/if}
		</div>
		<div>
			Segmented tail scale reserves most width for $0–25/lb; higher ranges compress progressively.
		</div>
	</div>

	{#if expanded}
		<div class="mb-3 flex flex-wrap items-start gap-2">
			<span class="pt-1 text-sm font-medium text-text-secondary-light">Origins:</span>
			<div class="relative">
				<button
					type="button"
					onclick={() => (selectorOpen = !selectorOpen)}
					class="flex items-center gap-1.5 rounded-md border border-border-light bg-background-secondary-light px-3 py-1.5 text-sm text-text-primary-light transition-colors hover:border-background-tertiary-light"
				>
					{selectedOrigins.size} of {rankedRows.length} selected
					<svg
						class="h-4 w-4 text-text-secondary-light"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
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
						class="absolute left-0 top-full z-20 mt-1 max-h-72 w-72 overflow-y-auto rounded-lg border border-border-light bg-background-primary-light shadow-lg"
					>
						<div class="border-b border-border-light px-3 py-2">
							<div class="mb-1 text-xs text-text-secondary-light">
								Default selection = top {DEFAULT_VISIBLE_COUNT} origins by bean count.
							</div>
							<div class="flex flex-wrap gap-2">
								<button
									type="button"
									onclick={() => setTopOrigins(8)}
									class="text-xs font-medium text-background-tertiary-light hover:underline"
								>
									Top 8
								</button>
								<button
									type="button"
									onclick={() => setTopOrigins(12)}
									class="text-xs font-medium text-background-tertiary-light hover:underline"
								>
									Top 12
								</button>
								<button
									type="button"
									onclick={() => setTopOrigins(20)}
									class="text-xs font-medium text-background-tertiary-light hover:underline"
								>
									Top 20
								</button>
								<button
									type="button"
									onclick={selectAllOrigins}
									class="text-xs font-medium text-background-tertiary-light hover:underline"
								>
									All
								</button>
								<button
									type="button"
									onclick={clearOrigins}
									class="text-xs font-medium text-red-500 hover:underline"
								>
									Clear
								</button>
							</div>
						</div>
						{#each rankedRows as row}
							{@const active = selectedOrigins.has(row.origin)}
							<button
								type="button"
								onclick={() => toggleOrigin(row.origin)}
								class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-background-secondary-light"
							>
								<div
									class="h-3 w-3 flex-shrink-0 rounded-sm border"
									class:border-background-tertiary-light={active}
									class:bg-background-tertiary-light={active}
									class:border-border-light={!active}
								></div>
								<div class={active ? 'text-text-primary-light' : 'text-text-secondary-light'}>
									{row.origin}
								</div>
								<div class="ml-auto text-xs text-text-secondary-light/60">N {row.sample_size}</div>
							</button>
						{/each}
					</div>
				{/if}
			</div>
			{#each visibleRows.slice(0, 8) as row}
				<span
					class="inline-flex items-center rounded-full bg-background-secondary-light px-2 py-0.5 text-xs text-text-secondary-light"
				>
					{row.origin}
				</span>
			{/each}
			{#if visibleRows.length > 8}
				<span class="pt-1 text-xs text-text-secondary-light">+{visibleRows.length - 8} more</span>
			{/if}
		</div>
	{/if}

	{#if rankedRows.length === 0}
		<div
			class="flex h-40 items-center justify-center rounded-lg bg-background-secondary-light text-sm text-text-secondary-light"
		>
			No origin price data available yet.
		</div>
	{:else if visibleRows.length === 0}
		<div
			class="flex h-40 flex-col items-center justify-center rounded-lg bg-background-secondary-light px-6 text-center"
		>
			<p class="text-sm font-medium text-text-secondary-light">No origins selected</p>
			<p class="mt-1 text-xs text-text-secondary-light">
				Choose one or more origins from the selector to render the chart.
			</p>
		</div>
	{:else}
		<div class="relative w-full" style={`height:${chartHeight}px`} bind:clientWidth={containerW}>
			{#if containerW > 0}
				<svg
					width={containerW}
					height={chartHeight}
					role="img"
					aria-label="Origin price range chart"
					onmousemove={handleMouseMove}
				>
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
						<g bind:this={yAxisEl}></g>
						<g bind:this={xAxisEl} transform="translate(0,{innerH})"></g>

						{#each tailTicks as tick}
							<line
								x1={xScale(tick)}
								x2={xScale(tick)}
								y1={0}
								y2={innerH}
								stroke="rgb(156 163 175)"
								stroke-opacity="0.2"
								stroke-dasharray="4 4"
							/>
						{/each}

						{#each visibleRows as row}
							{@const y = yScale(row.origin) ?? 0}
							{@const cy = y + yScale.bandwidth() / 2}
							{@const xMin = clampX(xScale(row.price_min), innerW)}
							{@const xMax = clampX(xScale(row.price_max), innerW)}
							{@const xQ1 = clampX(xScale(row.price_q1), innerW)}
							{@const xQ3 = clampX(xScale(row.price_q3), innerW)}
							{@const xMedian = clampX(xScale(row.price_median), innerW)}
							{@const xMean = clampX(xScale(row.price_avg), innerW)}

							<rect
								role="img"
								aria-label="{row.origin} price range"
								x={0}
								{y}
								width={innerW}
								height={yScale.bandwidth()}
								fill="transparent"
								onmouseenter={(e) => handleMouseEnter(e, row)}
								onmouseleave={handleMouseLeave}
							/>

							<line
								x1={xMin}
								x2={xMax}
								y1={cy}
								y2={cy}
								stroke="rgb(156 163 175)"
								stroke-width="1.5"
								stroke-opacity="0.6"
							/>
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

							<rect
								x={xQ1}
								y={cy - yScale.bandwidth() * 0.28}
								width={Math.max(4, xQ3 - xQ1)}
								height={yScale.bandwidth() * 0.56}
								fill="#f59e0b"
								fill-opacity="0.4"
								rx="2"
							/>

							<circle cx={xMedian} {cy} r="5" fill="#f59e0b" />

							{#if row.price_median > 0 && Math.abs(row.price_avg - row.price_median) / row.price_median > 0.05}
								<polygon
									points="{xMean},{cy - 5} {xMean + 4},{cy} {xMean},{cy + 5} {xMean - 4},{cy}"
									fill="#14b8a6"
								/>
							{/if}

							<text
								x={innerW + 8}
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

				{#if tooltip.visible && tooltip.row}
					{@const row = tooltip.row}
					<div
						class="pointer-events-none absolute z-10 rounded-lg border border-border-light bg-background-primary-light px-3 py-2 text-xs shadow-lg"
						style="left:{Math.min(tooltip.x + 12, Math.max(16, containerW - 210))}px; top:{Math.max(
							4,
							Math.min(tooltip.y - 110, chartHeight - 150)
						)}px; min-width:180px"
					>
						<div class="mb-1 font-semibold text-text-primary-light">{row.origin}</div>
						<div class="space-y-0.5 text-text-secondary-light">
							<div class="flex justify-between gap-4">
								<span>Min</span><span class="font-medium text-text-primary-light"
									>${row.price_min.toFixed(2)}</span
								>
							</div>
							<div class="flex justify-between gap-4">
								<span>Q1</span><span class="font-medium text-text-primary-light"
									>${row.price_q1.toFixed(2)}</span
								>
							</div>
							<div class="flex justify-between gap-4">
								<span class="font-medium text-amber-500">Median</span><span
									class="font-semibold text-amber-500">${row.price_median.toFixed(2)}</span
								>
							</div>
							<div class="flex justify-between gap-4">
								<span class="text-teal-500">Mean</span><span class="font-medium text-teal-500"
									>${row.price_avg.toFixed(2)}</span
								>
							</div>
							<div class="flex justify-between gap-4">
								<span>Q3</span><span class="font-medium text-text-primary-light"
									>${row.price_q3.toFixed(2)}</span
								>
							</div>
							<div class="flex justify-between gap-4">
								<span>Max</span><span class="font-medium text-text-primary-light"
									>${row.price_max.toFixed(2)}</span
								>
							</div>
							<div class="mt-1 flex justify-between gap-4 border-t border-border-light pt-1">
								<span>N beans</span><span class="font-medium text-text-primary-light"
									>{row.sample_size}</span
								>
							</div>
						</div>
					</div>
				{/if}
			{/if}
		</div>

		<div
			class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-2 text-xs text-text-secondary-light"
		>
			<div class="flex items-center gap-1">
				<div class="h-1 w-5 rounded bg-gray-400 opacity-60"></div>
				<span>Full range</span>
			</div>
			<div class="flex items-center gap-1">
				<div class="h-3 w-5 rounded bg-amber-400 opacity-40"></div>
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
			<div class="flex items-center gap-1 text-text-secondary-light/80">
				<span>Segmented scale: $0–10, $10–25, $25–100, tail compressed beyond $100</span>
			</div>
			<div class="ml-auto flex items-center gap-1 text-text-secondary-light/70">
				<span>N = bean count</span>
			</div>
		</div>
	{/if}
</div>
