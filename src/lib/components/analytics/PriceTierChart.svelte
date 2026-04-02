<script lang="ts">
	import { scaleBand, scaleLinear } from 'd3-scale';
	import { max } from 'd3-array';
	import { select } from 'd3-selection';

	interface PriceSnapshot {
		snapshot_date: string;
		origin: string;
		price_avg: number | null;
		price_median: number | null;
		price_p25: number | null;
		price_p75: number | null;
		sample_size: number;
		wholesale_only: boolean;
	}

	interface TierRow {
		origin: string;
		retailMedian: number | null;
		wholesaleMedian: number | null;
		retailSamples: number;
		wholesaleSamples: number;
		spreadPct: number | null;
	}

	let { snapshots = [] }: { snapshots: PriceSnapshot[] } = $props();

	const RETAIL_COLOR = '#f59e0b';
	const WHOLESALE_COLOR = '#3b82f6';
	const MIN_SAMPLES = 3;
	const MAX_ORIGINS = 10;

	const padding = { top: 28, right: 16, bottom: 56, left: 52 };

	let containerW = $state(0);

	// Derive tier data: latest snapshot per origin, grouped by retail/wholesale
	let tierData = $derived.by((): TierRow[] => {
		if (!snapshots || snapshots.length === 0) return [];

		// Get latest date
		const latestDate = snapshots.reduce(
			(max, s) => (s.snapshot_date > max ? s.snapshot_date : max),
			''
		);

		// Group by origin
		const retailByOrigin = new Map<
			string,
			{ median: number; samples: number; p25: number | null; p75: number | null }
		>();
		const wholesaleByOrigin = new Map<
			string,
			{ median: number; samples: number; p25: number | null; p75: number | null }
		>();

		for (const s of snapshots) {
			if (s.snapshot_date !== latestDate) continue;
			const median = s.price_median ?? s.price_avg;
			if (median == null || s.sample_size < MIN_SAMPLES) continue;

			if (s.wholesale_only) {
				wholesaleByOrigin.set(s.origin, {
					median,
					samples: s.sample_size,
					p25: s.price_p25 ?? null,
					p75: s.price_p75 ?? null
				});
			} else {
				retailByOrigin.set(s.origin, {
					median,
					samples: s.sample_size,
					p25: s.price_p25 ?? null,
					p75: s.price_p75 ?? null
				});
			}
		}

		// Build rows for origins that have at least retail data
		const allOrigins = new Set([...retailByOrigin.keys(), ...wholesaleByOrigin.keys()]);
		const rows: TierRow[] = [];

		for (const origin of allOrigins) {
			const retail = retailByOrigin.get(origin) ?? null;
			const wholesale = wholesaleByOrigin.get(origin) ?? null;
			if (!retail && !wholesale) continue;

			let spreadPct: number | null = null;
			if (retail && wholesale && wholesale.median > 0) {
				spreadPct = Math.round(((retail.median - wholesale.median) / wholesale.median) * 1000) / 10;
			}

			rows.push({
				origin,
				retailMedian: retail?.median ?? null,
				wholesaleMedian: wholesale?.median ?? null,
				retailSamples: retail?.samples ?? 0,
				wholesaleSamples: wholesale?.samples ?? 0,
				spreadPct
			});
		}

		// Sort by total sample count descending, take top N
		return rows
			.sort(
				(a, b) =>
					b.retailSamples + b.wholesaleSamples - (a.retailSamples + a.wholesaleSamples) ||
					a.origin.localeCompare(b.origin)
			)
			.slice(0, MAX_ORIGINS);
	});

	let hasData = $derived(tierData.length > 0);

	const CHART_HEIGHT = 300;
	let innerW = $derived(Math.max(0, containerW - padding.left - padding.right));
	let innerH = $derived(Math.max(0, CHART_HEIGHT - padding.top - padding.bottom));

	// Scales
	let xScaleOuter = $derived(
		scaleBand()
			.domain(tierData.map((r) => r.origin))
			.range([0, innerW])
			.padding(0.25)
	);

	let xScaleInner = $derived(
		scaleBand().domain(['retail', 'wholesale']).range([0, xScaleOuter.bandwidth()]).padding(0.08)
	);

	let yMax = $derived.by(() => {
		const vals: number[] = [];
		for (const r of tierData) {
			if (r.retailMedian != null) vals.push(r.retailMedian);
			if (r.wholesaleMedian != null) vals.push(r.wholesaleMedian);
		}
		return Math.ceil((max(vals) ?? 10) * 1.15);
	});

	let yScale = $derived(scaleLinear().domain([0, yMax]).range([innerH, 0]).nice());

	let xAxisEl: SVGGElement | undefined = $state();
	let yAxisEl: SVGGElement | undefined = $state();

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
		const narrow = containerW < 520;
		tierData.forEach((row) => {
			const cx = (xScaleOuter(row.origin) ?? 0) + xScaleOuter.bandwidth() / 2;
			const label = narrow && row.origin.length > 10 ? row.origin.slice(0, 9) + '…' : row.origin;
			g.append('text')
				.attr('x', cx)
				.attr('y', 14)
				.attr('text-anchor', 'middle')
				.attr('fill', 'rgb(107 114 128)')
				.attr('font-size', narrow ? '9' : '11')
				.text(label);
		});
	});

	$effect(() => {
		if (!yAxisEl || innerH <= 0) return;
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
				.attr('x', -8)
				.attr('y', y)
				.attr('text-anchor', 'end')
				.attr('dominant-baseline', 'middle')
				.attr('fill', 'rgb(156 163 175)')
				.attr('font-size', '11')
				.text(`$${t.toFixed(0)}`);
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

	// Tooltip
	let tooltip = $state<{
		visible: boolean;
		x: number;
		y: number;
		row: TierRow | null;
	}>({ visible: false, x: 0, y: 0, row: null });

	function handleMouseEnter(e: MouseEvent, row: TierRow) {
		const svgEl = (e.currentTarget as SVGElement).closest('svg');
		const rect = svgEl?.getBoundingClientRect();
		if (!rect) return;
		tooltip = { visible: true, x: e.clientX - rect.left, y: e.clientY - rect.top, row };
	}

	function handleMouseMove(e: MouseEvent) {
		if (!tooltip.visible) return;
		const svgEl = (e.currentTarget as SVGElement).closest('svg');
		const rect = svgEl?.getBoundingClientRect();
		if (!rect) return;
		tooltip = { ...tooltip, x: e.clientX - rect.left, y: e.clientY - rect.top };
	}

	function handleMouseLeave() {
		tooltip = { visible: false, x: 0, y: 0, row: null };
	}
</script>

<div class="flex w-full flex-col" bind:clientWidth={containerW}>
	{#if !hasData}
		<div
			class="flex h-48 items-center justify-center rounded-lg bg-background-secondary-light text-sm text-text-secondary-light"
		>
			No price tier data available yet. Data accumulates as snapshots are collected.
		</div>
	{:else if containerW > 0}
		<div class="relative" style="height:{CHART_HEIGHT}px">
			<svg
				width={containerW}
				height={CHART_HEIGHT}
				role="img"
				aria-label="Price tier comparison: retail vs wholesale median prices by origin"
				onmousemove={handleMouseMove}
			>
				<!-- Y axis label -->
				<text
					transform="rotate(-90)"
					x={-(padding.top + innerH / 2)}
					y={14}
					text-anchor="middle"
					font-size="10"
					fill="rgb(156 163 175)"
				>
					Median $/lb
				</text>

				<g transform="translate({padding.left},{padding.top})">
					<g bind:this={yAxisEl}></g>
					<g bind:this={xAxisEl} transform="translate(0,{innerH})"></g>

					{#each tierData as row}
						{@const ox = xScaleOuter(row.origin) ?? 0}
						{@const bw = xScaleInner.bandwidth()}

						<!-- Hit area for tooltip -->
						<rect
							role="img"
							aria-label="{row.origin} price comparison"
							x={ox}
							y={0}
							width={xScaleOuter.bandwidth()}
							height={innerH}
							fill="transparent"
							onmouseenter={(e) => handleMouseEnter(e, row)}
							onmouseleave={handleMouseLeave}
						/>

						<!-- Retail bar -->
						{#if row.retailMedian != null}
							{@const rx = ox + (xScaleInner('retail') ?? 0)}
							{@const ry = yScale(row.retailMedian)}
							{@const rh = Math.max(2, innerH - ry)}
							<rect
								x={rx}
								y={ry}
								width={bw}
								height={rh}
								fill={RETAIL_COLOR}
								fill-opacity="0.85"
								rx="2"
							/>
							{#if rh > 14}
								<text
									x={rx + bw / 2}
									y={ry + 4}
									dominant-baseline="hanging"
									text-anchor="middle"
									font-size="9"
									fill="white"
									font-weight="600"
								>
									${row.retailMedian.toFixed(2)}
								</text>
							{/if}
						{/if}

						<!-- Wholesale bar -->
						{#if row.wholesaleMedian != null}
							{@const wx = ox + (xScaleInner('wholesale') ?? 0)}
							{@const wy = yScale(row.wholesaleMedian)}
							{@const wh = Math.max(2, innerH - wy)}
							<rect
								x={wx}
								y={wy}
								width={bw}
								height={wh}
								fill={WHOLESALE_COLOR}
								fill-opacity="0.85"
								rx="2"
							/>
							{#if wh > 14}
								<text
									x={wx + bw / 2}
									y={wy + 4}
									dominant-baseline="hanging"
									text-anchor="middle"
									font-size="9"
									fill="white"
									font-weight="600"
								>
									${row.wholesaleMedian.toFixed(2)}
								</text>
							{/if}
						{/if}

						<!-- Spread badge (if both tiers present) -->
						{#if row.spreadPct != null && xScaleOuter.bandwidth() >= 40}
							{@const labelX = ox + xScaleOuter.bandwidth() / 2}
							{@const labelY =
								Math.min(
									row.retailMedian != null ? yScale(row.retailMedian) : innerH,
									row.wholesaleMedian != null ? yScale(row.wholesaleMedian) : innerH
								) - 8}
							{#if labelY > 4}
								<text
									x={labelX}
									y={labelY}
									text-anchor="middle"
									font-size="9"
									fill={row.spreadPct >= 0 ? 'rgb(16 185 129)' : 'rgb(239 68 68)'}
									font-weight="600"
								>
									{row.spreadPct >= 0 ? '+' : ''}{row.spreadPct.toFixed(1)}%
								</text>
							{/if}
						{/if}
					{/each}
				</g>
			</svg>

			{#if tooltip.visible && tooltip.row}
				{@const row = tooltip.row}
				<div
					class="pointer-events-none absolute z-10 rounded-lg border border-border-light bg-background-primary-light px-3 py-2 text-xs shadow-lg"
					style="left:{Math.min(tooltip.x + 12, Math.max(4, containerW - 200))}px; top:{Math.max(
						4,
						tooltip.y - 80
					)}px; min-width:170px"
				>
					<div class="mb-1.5 font-semibold text-text-primary-light">{row.origin}</div>
					<div class="space-y-1 text-text-secondary-light">
						{#if row.retailMedian != null}
							<div class="flex items-center justify-between gap-3">
								<span class="flex items-center gap-1">
									<span class="inline-block h-2 w-2 rounded-sm" style="background:{RETAIL_COLOR}"
									></span>
									Retail median
								</span>
								<span class="font-semibold" style="color:{RETAIL_COLOR}"
									>${row.retailMedian.toFixed(2)}</span
								>
							</div>
							<div class="pl-3 text-xs text-text-secondary-light/70">N = {row.retailSamples}</div>
						{/if}
						{#if row.wholesaleMedian != null}
							<div class="flex items-center justify-between gap-3">
								<span class="flex items-center gap-1">
									<span class="inline-block h-2 w-2 rounded-sm" style="background:{WHOLESALE_COLOR}"
									></span>
									Wholesale median
								</span>
								<span class="font-semibold" style="color:{WHOLESALE_COLOR}"
									>${row.wholesaleMedian.toFixed(2)}</span
								>
							</div>
							<div class="pl-3 text-xs text-text-secondary-light/70">
								N = {row.wholesaleSamples}
							</div>
						{/if}
						{#if row.spreadPct != null}
							<div
								class="mt-1 flex justify-between gap-3 border-t border-border-light pt-1 font-medium"
							>
								<span>Spread</span>
								<span class={row.spreadPct >= 0 ? 'text-emerald-600' : 'text-red-500'}
									>{row.spreadPct >= 0 ? '+' : ''}{row.spreadPct.toFixed(1)}%</span
								>
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>

		<!-- Legend -->
		<div
			class="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 px-1 text-xs text-text-secondary-light"
		>
			<div class="flex items-center gap-1.5">
				<div class="h-3 w-3 rounded-sm" style="background:{RETAIL_COLOR}; opacity:0.85;"></div>
				<span>Retail median</span>
			</div>
			<div class="flex items-center gap-1.5">
				<div class="h-3 w-3 rounded-sm" style="background:{WHOLESALE_COLOR}; opacity:0.85;"></div>
				<span>Wholesale median</span>
			</div>
			<div class="flex items-center gap-1.5">
				<span class="font-semibold text-emerald-600">+%</span>
				<span>Retail premium over wholesale (spread)</span>
			</div>
		</div>
	{/if}
</div>
