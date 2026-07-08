<script lang="ts">
	import CompositionTrendChart from '$lib/components/analytics/CompositionTrendChart.svelte';
	import {
		AXIS_LABEL_COLOR,
		CHART_SERIES,
		DISCLOSURE_COLORS,
		DISCLOSURE_LABELS,
		GRIDLINE_COLOR,
		NEUTRAL_CATEGORY_COLOR,
		PROCESS_COLORS
	} from '$lib/styles/chartColors';
	import type { MetadataSeriesItem } from '$lib/types/marketIndex.types';

	type ViewMode = 'retail' | 'wholesale' | 'all';

	interface Props {
		processSeries: MetadataSeriesItem[] | null;
		disclosureSeries: MetadataSeriesItem[] | null;
		purveyorScoreSeries: MetadataSeriesItem[] | null;
		purveyorScoreConfidenceSeries: MetadataSeriesItem[] | null;
		purveyorScoreTierSeries: MetadataSeriesItem[] | null;
		viewMode: ViewMode;
		isParchmentIntelligence: boolean;
	}

	let {
		processSeries,
		disclosureSeries,
		purveyorScoreSeries,
		purveyorScoreConfidenceSeries,
		purveyorScoreTierSeries,
		viewMode,
		isParchmentIntelligence
	}: Props = $props();

	// The metadata index is served from the retail market slice only; wholesale and
	// combined trends require expanded coverage that is not fetched here. When the
	// page scope is not retail, say so plainly instead of implying these charts
	// followed the scope toggle.
	let retailScopeNote = $derived(
		viewMode === 'retail'
			? null
			: 'Metadata trends reflect the retail market and do not change with the selected scope.'
	);

	const processFallback = new Map<string, string>();
	function processColor(key: string): string {
		if (key === 'undisclosed') return NEUTRAL_CATEGORY_COLOR;
		if (PROCESS_COLORS[key]) return PROCESS_COLORS[key];
		if (!processFallback.has(key)) {
			processFallback.set(key, CHART_SERIES[processFallback.size % CHART_SERIES.length]);
		}
		return processFallback.get(key) as string;
	}

	function disclosureColor(key: string): string {
		return DISCLOSURE_COLORS[key] ?? NEUTRAL_CATEGORY_COLOR;
	}

	function disclosureLabel(key: string): string {
		return DISCLOSURE_LABELS[key] ?? key;
	}

	function scoreTierColor(key: string): string {
		if (key === 'Unscored' || key === 'unscored') return NEUTRAL_CATEGORY_COLOR;
		const tierColors: Record<string, string> = {
			Exceptional: '#586048',
			exceptional: '#586048',
			Strong: '#7FB069',
			strong: '#7FB069',
			Developing: '#4E8098',
			developing: '#4E8098',
			Limited: '#D9A05B',
			limited: '#D9A05B'
		};
		return tierColors[key] ?? CHART_SERIES[4];
	}

	function scoreTierLabel(key: string): string {
		if (key === 'unscored') return 'Unscored';
		return key;
	}

	type PercentileRow = {
		period: string;
		p25: number | null;
		p50: number | null;
		p75: number | null;
		count: number;
		supplierCount: number;
	};

	type PercentileBucket = {
		key: 'p25' | 'p50' | 'p75';
		value: number | null;
		count: number;
		supplierCount: number;
	};

	function isPercentileBucket(
		bucket: MetadataSeriesItem['buckets'][number]
	): bucket is PercentileBucket {
		return 'value' in bucket;
	}

	function percentileRows(series: MetadataSeriesItem[] | null): PercentileRow[] {
		return (series ?? [])
			.map((item) => {
				const buckets = item.buckets.filter(isPercentileBucket);
				const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
				return {
					period: item.period,
					p25: byKey.get('p25')?.value ?? null,
					p50: byKey.get('p50')?.value ?? null,
					p75: byKey.get('p75')?.value ?? null,
					count: byKey.get('p50')?.count ?? item.lotCount,
					supplierCount: byKey.get('p50')?.supplierCount ?? item.supplierCount
				};
			})
			.filter((row) => row.p25 != null || row.p50 != null || row.p75 != null);
	}

	const SPARK_WIDTH = 640;
	const SPARK_HEIGHT = 176;
	const SPARK_PAD_TOP = 12;
	const SPARK_PAD_BOTTOM = 28;
	const SPARK_PAD_LEFT = 34;
	const SPARK_PAD_RIGHT = 8;

	function formatPeriod(period: string): string {
		const [year, month] = period.split('-');
		if (!month) return period;
		const date = new Date(Number(year), Number(month) - 1, 1);
		return date.toLocaleDateString('en-US', { month: 'short' });
	}

	function formatValue(value: number | null, asPercent = false): string {
		if (value == null) return 'N/A';
		return asPercent ? `${Math.round(value * 100)}%` : Math.round(value).toLocaleString();
	}

	function xFor(index: number, length: number): number {
		if (length <= 1) return SPARK_PAD_LEFT;
		const usable = SPARK_WIDTH - SPARK_PAD_LEFT - SPARK_PAD_RIGHT;
		return SPARK_PAD_LEFT + (usable * index) / (length - 1);
	}

	function yFor(value: number | null, maxValue: number): number {
		const usable = SPARK_HEIGHT - SPARK_PAD_TOP - SPARK_PAD_BOTTOM;
		const normalized = Math.max(0, Math.min(1, (value ?? 0) / maxValue));
		return SPARK_PAD_TOP + (1 - normalized) * usable;
	}

	function linePoints(rows: PercentileRow[], key: 'p25' | 'p50' | 'p75', maxValue: number): string {
		return rows
			.map((row, index) => {
				const value = row[key];
				if (value == null) return null;
				return `${xFor(index, rows.length)},${yFor(value, maxValue)}`;
			})
			.filter((point): point is string => Boolean(point))
			.join(' ');
	}

	function latestRow(rows: PercentileRow[]): PercentileRow | null {
		return rows.at(-1) ?? null;
	}

	let scoreRows = $derived(percentileRows(purveyorScoreSeries));
	let confidenceRows = $derived(percentileRows(purveyorScoreConfidenceSeries));
	let hasAnySeries = $derived(
		Boolean(
			processSeries?.length ||
				disclosureSeries?.length ||
				purveyorScoreSeries?.length ||
				purveyorScoreConfidenceSeries?.length ||
				purveyorScoreTierSeries?.length
		)
	);
</script>

{#snippet percentileTrend(
	rows: PercentileRow[],
	label: string,
	maxValue: number,
	asPercent = false
)}
	{@const latest = latestRow(rows)}
	{#if rows.length > 0}
		<div class="rounded-lg border border-line bg-surface-canvas p-6 shadow-sm">
			<div class="flex items-start justify-between gap-4">
				<div>
					<h3 class="text-base font-semibold text-ink">{label}</h3>
					<p class="mt-1 text-sm text-muted">
						Monthly market-wide percentile trend from indexed stocked retail listings.
					</p>
				</div>
				{#if latest}
					<div class="shrink-0 text-right">
						<p class="text-xs uppercase tracking-wide text-muted">Latest median</p>
						<p class="text-xl font-semibold text-ink">{formatValue(latest.p50, asPercent)}</p>
					</div>
				{/if}
			</div>

			<svg
				viewBox="0 0 {SPARK_WIDTH} {SPARK_HEIGHT}"
				class="mt-4 h-auto w-full"
				role="img"
				aria-label="{label} over time"
			>
				<line
					x1={SPARK_PAD_LEFT}
					y1={SPARK_HEIGHT - SPARK_PAD_BOTTOM}
					x2={SPARK_WIDTH - SPARK_PAD_RIGHT}
					y2={SPARK_HEIGHT - SPARK_PAD_BOTTOM}
					stroke={GRIDLINE_COLOR}
				/>
				<line
					x1={SPARK_PAD_LEFT}
					y1={SPARK_PAD_TOP}
					x2={SPARK_PAD_LEFT}
					y2={SPARK_HEIGHT - SPARK_PAD_BOTTOM}
					stroke={GRIDLINE_COLOR}
				/>
				<polyline
					points={linePoints(rows, 'p75', maxValue)}
					fill="none"
					stroke={CHART_SERIES[2]}
					stroke-width="2"
					stroke-dasharray="5 5"
					stroke-linecap="round"
					stroke-linejoin="round"
					opacity="0.7"
				/>
				<polyline
					points={linePoints(rows, 'p50', maxValue)}
					fill="none"
					stroke={CHART_SERIES[0]}
					stroke-width="4"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
				<polyline
					points={linePoints(rows, 'p25', maxValue)}
					fill="none"
					stroke={CHART_SERIES[5]}
					stroke-width="2"
					stroke-dasharray="5 5"
					stroke-linecap="round"
					stroke-linejoin="round"
					opacity="0.7"
				/>
				<text x="4" y={SPARK_PAD_TOP + 4} font-size="11" fill={AXIS_LABEL_COLOR}>
					{formatValue(maxValue, asPercent)}
				</text>
				<text x="16" y={SPARK_HEIGHT - SPARK_PAD_BOTTOM} font-size="11" fill={AXIS_LABEL_COLOR}>
					0
				</text>
				{#each rows as row, index}
					{#if index === 0 || index === rows.length - 1}
						<text
							x={xFor(index, rows.length)}
							y={SPARK_HEIGHT - 8}
							text-anchor={index === 0 ? 'start' : 'end'}
							font-size="11"
							fill={AXIS_LABEL_COLOR}
						>
							{formatPeriod(row.period)}
						</text>
					{/if}
				{/each}
			</svg>

			<div class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
				<span><span class="font-semibold text-ink">p50</span> median</span>
				<span><span class="font-semibold text-ink">p25/p75</span> range edges</span>
				{#if latest}
					<span>
						{latest.count.toLocaleString()} lots · {latest.supplierCount.toLocaleString()} suppliers
					</span>
				{/if}
			</div>
		</div>
	{/if}
{/snippet}

{#if hasAnySeries}
	{#if retailScopeNote}
		<p class="mb-4 text-sm text-muted" aria-label="Metadata scope note">
			{retailScopeNote}
		</p>
	{/if}

	<section class="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2" aria-label="Metadata trends">
		{#if processSeries && processSeries.length > 0}
			<div class="rounded-lg border border-line bg-surface-canvas p-6 shadow-sm">
				<h3 class="text-base font-semibold text-ink">How is processing changing?</h3>
				<p class="mb-4 mt-1 text-sm text-muted">
					Share of stocked retail supply by processing method, month over month.
				</p>
				<CompositionTrendChart series={processSeries} colorFor={processColor} />
			</div>
		{/if}

		{#if isParchmentIntelligence}
			{#if disclosureSeries && disclosureSeries.length > 0}
				<div class="rounded-lg border border-line bg-surface-canvas p-6 shadow-sm">
					<h3 class="text-base font-semibold text-ink">Is the market disclosing more?</h3>
					<p class="mb-4 mt-1 text-sm text-muted">
						Processing disclosure levels across stocked retail supply — the transparency trend.
					</p>
					<CompositionTrendChart
						series={disclosureSeries}
						colorFor={disclosureColor}
						labelFor={disclosureLabel}
					/>
				</div>
			{/if}

			{@render percentileTrend(scoreRows, 'Purveyor Score over time', 100)}

			{@render percentileTrend(confidenceRows, 'Purveyor Score confidence over time', 1, true)}

			{#if purveyorScoreTierSeries && purveyorScoreTierSeries.length > 0}
				<div class="rounded-lg border border-line bg-surface-canvas p-6 shadow-sm">
					<h3 class="text-base font-semibold text-ink">How is listing quality distributed?</h3>
					<p class="mb-4 mt-1 text-sm text-muted">
						Purveyor Score tiers across stocked retail supply, month over month.
					</p>
					<CompositionTrendChart
						series={purveyorScoreTierSeries}
						colorFor={scoreTierColor}
						labelFor={scoreTierLabel}
					/>
				</div>
			{/if}
		{:else}
			<div
				class="rounded-lg border border-line bg-surface-panel p-6"
				aria-label="Gated metadata trends"
			>
				<div class="flex h-full flex-col items-start justify-between gap-4">
					<div>
						<h3 class="font-serif text-lg font-medium text-ink">
							The transparency trend runs deeper.
						</h3>
						<p class="mt-1 text-sm text-muted">
							Parchment Intelligence adds disclosure-level trends, Purveyor Score movement,
							confidence, and tier distribution over time.
						</p>
					</div>
					<a
						href="/subscription?plan=intelligence-monthly&intent=checkout"
						class="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-ink transition-all duration-200 hover:bg-accent/85"
					>
						Start Intelligence
					</a>
				</div>
			</div>
		{/if}
	</section>
{/if}
