<script lang="ts">
	import { getContext } from 'svelte';
	import { bisector } from 'd3-array';
	import type { Writable } from 'svelte/store';
	import type { ScaleLinear } from 'd3-scale';
	import type { ChartPoint, TooltipData, ProcessedChartData } from './chart-types';

	let {
		chartData,
		onTooltipChange
	}: {
		chartData: ProcessedChartData;
		onTooltipChange: (state: {
			visible: boolean;
			x: number;
			y: number;
			data: TooltipData | null;
		}) => void;
	} = $props();

	const { width, height, xScale } = getContext('LayerCake') as {
		width: Writable<number>;
		height: Writable<number>;
		xScale: Writable<ScaleLinear<number, number>>;
	};

	const bisectTime = bisector<ChartPoint, number>((d) => d.timeMinutes).left;

	function handleMouseMove(e: MouseEvent) {
		const svg = (e.currentTarget as SVGRectElement).closest('svg');
		if (!svg) return;

		const svgRect = svg.getBoundingClientRect();
		const mouseX = e.clientX - svgRect.left;

		// Invert x position to get time in minutes
		const timeAtMouse = $xScale.invert(mouseX);

		// Find nearest BT point
		const btPoints = chartData.temperaturePoints;
		if (btPoints.length === 0) return;

		const idx = bisectTime(btPoints, timeAtMouse);
		const d0 = btPoints[idx - 1];
		const d1 = btPoints[idx];
		const nearest =
			d0 && d1
				? timeAtMouse - d0.timeMinutes > d1.timeMinutes - timeAtMouse
					? d1
					: d0
				: (d0 ?? d1);

		if (!nearest) {
			onTooltipChange({ visible: false, x: 0, y: 0, data: null });
			return;
		}

		// Find matching ET point
		const etIdx = bisectTime(chartData.envTempPoints, nearest.timeMinutes);
		const etPoint = chartData.envTempPoints[etIdx] ?? chartData.envTempPoints[etIdx - 1];

		// Find matching RoR point
		const rorIdx = bisectTime(chartData.rorPoints, nearest.timeMinutes);
		const rorPoint = chartData.rorPoints[rorIdx] ?? chartData.rorPoints[rorIdx - 1];

		// Find milestones at this time
		const milestones = chartData.events
			.filter((ev) => Math.abs(ev.timeMinutes - nearest.timeMinutes) < 0.1)
			.map((ev) => ({
				event: ev.name,
				time: (ev.timeMinutes + chartData.chargeTime / (1000 * 60)) * 1000 * 60
			}));

		// Find control values at this time
		const eventData: Record<string, number> = {};
		for (const series of chartData.controlSeries) {
			const cIdx = bisector<ChartPoint, number>((d) => d.timeMinutes).right(
				series.points,
				nearest.timeMinutes
			);
			const controlPoint = series.points[cIdx - 1];
			if (controlPoint) {
				eventData[series.name] = controlPoint.value;
			}
		}

		// Convert timeMinutes back to absolute ms for tooltip
		const absoluteTimeMs = nearest.timeMinutes * 1000 * 60 + chartData.chargeTime;

		onTooltipChange({
			visible: true,
			x: e.clientX,
			y: e.clientY,
			data: {
				time: absoluteTimeMs,
				chargeTime: chartData.chargeTime,
				bean_temp: nearest.value,
				environmental_temp: etPoint?.value ?? null,
				rorValue:
					rorPoint && Math.abs(rorPoint.timeMinutes - nearest.timeMinutes) < 0.5
						? rorPoint.value
						: null,
				milestones,
				eventData
			}
		});
	}

	function handleMouseLeave() {
		onTooltipChange({ visible: false, x: 0, y: 0, data: null });
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<rect
	x={0}
	y={0}
	width={$width}
	height={$height}
	fill="transparent"
	style="cursor: crosshair;"
	onmousemove={handleMouseMove}
	onmouseleave={handleMouseLeave}
/>
