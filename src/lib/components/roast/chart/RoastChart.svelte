<script lang="ts">
	import { LayerCake, Svg } from 'layercake';
	import { scaleLinear } from 'd3-scale';
	import type { ProcessedChartData, TooltipData } from './chart-types';

	import AxisX from './AxisX.svelte';
	import AxisY from './AxisY.svelte';
	import AxisYRight from './AxisYRight.svelte';
	import Line from './Line.svelte';
	import MilestoneMarkers from './MilestoneMarkers.svelte';
	import TimeTracker from './TimeTracker.svelte';
	import ChargeLine from './ChargeLine.svelte';
	import InteractiveOverlay from './InteractiveOverlay.svelte';
	import { controlScaleDomain } from './chart-utils';

	let {
		chartData,
		isLive = false,
		currentTimeMinutes = 0,
		onTooltipChange
	}: {
		chartData: ProcessedChartData;
		isLive?: boolean;
		currentTimeMinutes?: number;
		onTooltipChange?: (state: {
			visible: boolean;
			x: number;
			y: number;
			data: TooltipData | null;
		}) => void;
	} = $props();

	// Secondary Y scales (RoR and control values) managed manually
	// since LayerCake only supports one Y scale natively
	let containerHeight = $state(0);
	let containerWidth = $state(0);
	let hiddenSeriesIds = $state<string[]>([]);
	const padding = { top: 20, right: 80, bottom: 40, left: 80 };
	let visibleSeries = $derived(
		chartData.series.filter((series) => !hiddenSeriesIds.includes(series.id))
	);
	let anchorPoints = $derived(
		visibleSeries.find((series) => series.axis === 'temperature')?.points ??
			visibleSeries[0]?.points ??
			[]
	);

	function toggleSeries(id: string) {
		hiddenSeriesIds = hiddenSeriesIds.includes(id)
			? hiddenSeriesIds.filter((entry) => entry !== id)
			: [...hiddenSeriesIds, id];
	}

	let rorScale = $derived.by(() => {
		const innerH = containerHeight - padding.top - padding.bottom;
		if (innerH <= 0) return scaleLinear().domain([0, 50]).range([0, 0]);
		return scaleLinear().domain(chartData.yRorDomain).range([innerH, 0]);
	});

	let controlScale = $derived.by(() => {
		const innerH = containerHeight - padding.top - padding.bottom;
		if (innerH <= 0) return scaleLinear().domain([0, 10]).range([0, 0]);
		// Control values use bottom 30% of chart height
		return scaleLinear()
			.domain(controlScaleDomain(visibleSeries))
			.range([innerH, innerH * 0.7]);
	});

	function handleTooltip(state: {
		visible: boolean;
		x: number;
		y: number;
		data: TooltipData | null;
	}) {
		onTooltipChange?.(state);
	}
</script>

<div class="flex h-full w-full flex-col">
	{#if !isLive && chartData.series.length > 1}
		<div class="flex flex-wrap gap-1.5 px-2 pb-2" aria-label="Chart series visibility">
			{#each chartData.series as series}
				<button
					type="button"
					class="hover:bg-surface-muted inline-flex min-h-8 items-center gap-1.5 rounded-full border border-line bg-surface-canvas px-2.5 py-1 text-xs text-ink transition"
					class:opacity-50={hiddenSeriesIds.includes(series.id)}
					aria-pressed={!hiddenSeriesIds.includes(series.id)}
					onclick={() => toggleSeries(series.id)}
				>
					<span class="h-0.5 w-3 rounded" style:background-color={series.color}></span>
					{series.label}{series.unit ? ` (${series.unit})` : ''}
				</button>
			{/each}
		</div>
	{/if}
	<div class="min-h-0 flex-1" bind:clientHeight={containerHeight} bind:clientWidth={containerWidth}>
		<LayerCake
			data={anchorPoints}
			x={(d: { timeMinutes: number; value: number }) => d.timeMinutes}
			y={(d: { timeMinutes: number; value: number }) => d.value}
			xDomain={chartData.xDomain}
			yDomain={chartData.yTempDomain}
			yReverse
			{padding}
		>
			<Svg>
				<!-- Axes -->
				<AxisX />
				<AxisY label={`Temperature (${chartData.temperatureUnit})`} />
				<AxisYRight scale={rorScale} label={`RoR (${chartData.temperatureUnit}/min)`} />

				<!-- Charge line (vertical at time = 0) -->
				<ChargeLine />

				{#each visibleSeries as series}
					<Line
						data={series.points}
						color={series.color}
						strokeWidth={series.strokeWidth}
						dashArray={series.dashed ? '5,5' : undefined}
						yScaleOverride={series.axis === 'ror'
							? rorScale
							: series.axis === 'control'
								? controlScale
								: undefined}
						curve={series.curve}
						className={`chart-series chart-series-${series.kind}`}
					/>
				{/each}

				<!-- Milestone markers -->
				<MilestoneMarkers events={chartData.events} />

				<!-- Time tracker for live roasting -->
				<TimeTracker {currentTimeMinutes} visible={isLive} />

				<!-- Interactive overlay for tooltip (saved profiles only) -->
				{#if !isLive && onTooltipChange}
					<InteractiveOverlay {chartData} series={visibleSeries} onTooltipChange={handleTooltip} />
				{/if}
			</Svg>
		</LayerCake>
	</div>
</div>
