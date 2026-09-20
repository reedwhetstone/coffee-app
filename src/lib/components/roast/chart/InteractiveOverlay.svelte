<script lang="ts">
	import { getContext } from 'svelte';
	import { bisector } from 'd3-array';
	import type { Writable } from 'svelte/store';
	import type { ScaleLinear } from 'd3-scale';
	import type { ChartPoint, ChartSeries, TooltipData, ProcessedChartData } from './chart-types';

	let {
		chartData,
		series = chartData.series,
		onTooltipChange
	}: {
		chartData: ProcessedChartData;
		series?: ChartSeries[];
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

	function nearestPoint(points: ChartPoint[], time: number): ChartPoint | null {
		const index = bisectTime(points, time);
		const left = points[index - 1];
		const right = points[index];
		return left && right
			? time - left.timeMinutes > right.timeMinutes - time
				? right
				: left
			: (left ?? right ?? null);
	}

	function handleMouseMove(e: MouseEvent) {
		const svg = (e.currentTarget as SVGRectElement).closest('svg');
		if (!svg) return;

		const svgRect = svg.getBoundingClientRect();
		const mouseX = e.clientX - svgRect.left;

		// Invert x position to get time in minutes
		const timeAtMouse = $xScale.invert(mouseX);

		const anchorSeries =
			series.find((entry) => entry.kind === 'bean_temperature') ??
			series.find((entry) => entry.axis === 'temperature') ??
			series[0];
		if (!anchorSeries) return;
		const nearest = nearestPoint(anchorSeries.points, timeAtMouse);

		if (!nearest) {
			onTooltipChange({ visible: false, x: 0, y: 0, data: null });
			return;
		}

		const beanPoint = nearestPoint(
			series.find((entry) => entry.kind === 'bean_temperature')?.points ?? [],
			nearest.timeMinutes
		);
		const etPoint = nearestPoint(
			series.find((entry) => entry.kind === 'environmental_temperature')?.points ?? [],
			nearest.timeMinutes
		);
		const rorPoint = nearestPoint(
			series.find((entry) => entry.kind === 'rate_of_rise')?.points ?? [],
			nearest.timeMinutes
		);

		// Find milestones at this time
		const milestones = chartData.events
			.filter((ev) => Math.abs(ev.timeMinutes - nearest.timeMinutes) < 0.1)
			.map((ev) => ({
				event: ev.name,
				time: (ev.timeMinutes + chartData.chargeTime / (1000 * 60)) * 1000 * 60
			}));

		// Find control values at this time
		const eventData: Record<string, number> = {};
		for (const entry of series.filter((candidate) => candidate.axis === 'control')) {
			const cIdx = bisector<ChartPoint, number>((d) => d.timeMinutes).right(
				entry.points,
				nearest.timeMinutes
			);
			const controlPoint = entry.points[cIdx - 1];
			if (controlPoint) {
				eventData[entry.label] = controlPoint.value;
			}
		}
		const seriesValues = series.flatMap((entry) => {
			const point =
				entry.axis === 'control'
					? entry.points[
							bisector<ChartPoint, number>((candidate) => candidate.timeMinutes).right(
								entry.points,
								nearest.timeMinutes
							) - 1
						]
					: nearestPoint(entry.points, nearest.timeMinutes);
			if (
				!point ||
				(entry.axis !== 'control' && Math.abs(point.timeMinutes - nearest.timeMinutes) > 0.5)
			)
				return [];
			return [{ id: entry.id, label: entry.label, unit: entry.unit, value: point.value }];
		});

		// Convert timeMinutes back to absolute ms for tooltip
		const absoluteTimeMs = nearest.timeMinutes * 1000 * 60 + chartData.chargeTime;

		onTooltipChange({
			visible: true,
			x: e.clientX,
			y: e.clientY,
			data: {
				time: absoluteTimeMs,
				chargeTime: chartData.chargeTime,
				bean_temp: beanPoint?.value ?? null,
				environmental_temp: etPoint?.value ?? null,
				rorValue:
					rorPoint && Math.abs(rorPoint.timeMinutes - nearest.timeMinutes) < 0.5
						? rorPoint.value
						: null,
				milestones,
				eventData,
				seriesValues
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
