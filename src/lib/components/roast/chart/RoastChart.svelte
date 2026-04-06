<script lang="ts">
	import { LayerCake, Svg } from 'layercake';
	import { scaleLinear } from 'd3-scale';
	import type { ProcessedChartData, TooltipData, LegendEntry } from './chart-types';

	import AxisX from './AxisX.svelte';
	import AxisY from './AxisY.svelte';
	import AxisYRight from './AxisYRight.svelte';
	import Line from './Line.svelte';
	import MilestoneMarkers from './MilestoneMarkers.svelte';
	import TimeTracker from './TimeTracker.svelte';
	import ChartLegend from './ChartLegend.svelte';
	import ChargeLine from './ChargeLine.svelte';
	import InteractiveOverlay from './InteractiveOverlay.svelte';

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
	const padding = { top: 20, right: 80, bottom: 40, left: 80 };

	let rorScale = $derived.by(() => {
		const innerH = containerHeight - padding.top - padding.bottom;
		if (innerH <= 0) return scaleLinear().domain([0, 50]).range([0, 0]);
		return scaleLinear().domain(chartData.yRorDomain).range([innerH, 0]);
	});

	let controlScale = $derived.by(() => {
		const innerH = containerHeight - padding.top - padding.bottom;
		if (innerH <= 0) return scaleLinear().domain([0, 10]).range([0, 0]);
		// Compute max value across all control series
		let maxVal = 10;
		for (const series of chartData.controlSeries) {
			for (const pt of series.points) {
				if (pt.value > maxVal) maxVal = pt.value;
			}
		}
		// Snap to clean ceiling: 10, 50, 100, 200, etc.
		let ceiling: number;
		if (maxVal <= 10) ceiling = 10;
		else if (maxVal <= 50) ceiling = 50;
		else if (maxVal <= 100) ceiling = 100;
		else ceiling = Math.ceil(maxVal / 100) * 100;
		// Control values use bottom 30% of chart height
		return scaleLinear()
			.domain([0, ceiling])
			.range([innerH, innerH * 0.7]);
	});

	// Build legend entries
	let legendEntries = $derived.by(() => {
		const entries: LegendEntry[] = [];
		if (chartData.temperaturePoints.length > 0) {
			entries.push({
				label: 'Bean Temp (BT)',
				color: '#f59e0b',
				strokeWidth: 3,
				dashed: true
			});
		}
		if (chartData.envTempPoints.length > 0) {
			entries.push({
				label: 'Env Temp (ET)',
				color: '#dc2626',
				strokeWidth: 2
			});
		}
		if (chartData.rorPoints.length > 0) {
			entries.push({
				label: 'BT RoR (°F/min)',
				color: '#2563eb',
				strokeWidth: 2
			});
		}
		for (const series of chartData.controlSeries) {
			entries.push({
				label: series.name.replace(/_setting/g, '').replace(/_/g, ' '),
				color: series.color,
				strokeWidth: series.strokeWidth
			});
		}
		return entries;
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

<div class="h-full w-full" bind:clientHeight={containerHeight} bind:clientWidth={containerWidth}>
	<LayerCake
		data={chartData.temperaturePoints}
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
			<AxisY label="Temperature (°F)" />
			<AxisYRight scale={rorScale} label="RoR (°F/min)" />

			<!-- Charge line (vertical at time = 0) -->
			<ChargeLine />

			<!-- BT line (orange dashed) -->
			{#if chartData.temperaturePoints.length > 0}
				<Line
					data={chartData.temperaturePoints}
					color="#f59e0b"
					strokeWidth={3}
					dashArray="5,5"
					curve="basis"
					className="bean-temp-line"
				/>
			{/if}

			<!-- ET line (red solid) -->
			{#if chartData.envTempPoints.length > 0}
				<Line
					data={chartData.envTempPoints}
					color="#dc2626"
					strokeWidth={2}
					curve="basis"
					className="env-temp-line"
				/>
			{/if}

			<!-- RoR line (blue, right axis) -->
			{#if chartData.rorPoints.length > 0}
				<Line
					data={chartData.rorPoints}
					color="#2563eb"
					strokeWidth={2}
					yScaleOverride={rorScale}
					curve="basis"
					className="ror-line"
				/>
			{/if}

			<!-- Control series (fan, heat, Artisan events) -->
			{#each chartData.controlSeries as series}
				<Line
					data={series.points}
					color={series.color}
					strokeWidth={series.strokeWidth}
					yScaleOverride={controlScale}
					curve="stepAfter"
					className="control-event-line"
				/>
			{/each}

			<!-- Milestone markers -->
			<MilestoneMarkers events={chartData.events} />

			<!-- Time tracker for live roasting -->
			<TimeTracker {currentTimeMinutes} visible={isLive} />

			<!-- Legend (positioned in top-right of inner chart area) -->
			{#if legendEntries.length > 0}
				{@const innerWidth = containerWidth - padding.left - padding.right}
				<g class="temp-legend" transform="translate({Math.max(innerWidth - 160, 0)}, 20)">
					<ChartLegend entries={legendEntries} />
				</g>
			{/if}

			<!-- Interactive overlay for tooltip (saved profiles only) -->
			{#if !isLive && onTooltipChange}
				<InteractiveOverlay {chartData} onTooltipChange={handleTooltip} />
			{/if}
		</Svg>
	</LayerCake>
</div>
