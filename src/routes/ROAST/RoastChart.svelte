<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as d3 from 'd3';
	import { roastData, roastEvents, startTime, accumulatedTime, type RoastPoint } from './stores';
	import { curveStepAfter } from 'd3-shape';

	let chartContainer: HTMLDivElement;
	let svg: d3.Selection<SVGGElement, unknown, null, undefined>;
	let xScale: d3.ScaleLinear<number, number>;
	let yScaleFan: d3.ScaleLinear<number, number>;
	let yScaleHeat: d3.ScaleLinear<number, number>;
	let height: number;
	let width: number;

	// Add time tracker
	let timeTrackerInterval: ReturnType<typeof setInterval> | null;

	// Add isPaused prop
	export let isPaused = false;

	// Add props at the top of the script
	export let fanValue = 10;
	export let heatValue = 0;

	function startTimeTracker() {
		if (timeTrackerInterval) {
			clearInterval(timeTrackerInterval);
			timeTrackerInterval = null;
		}

		if (!svg || $startTime === null) return;

		// Use the current fan and heat values from props
		const initialPoint = {
			time: 0,
			heat: heatValue,
			fan: fanValue
		};

		// Add initial point to roast data if not exists
		if ($roastData.length === 0) {
			$roastData = [initialPoint];
		}

		timeTrackerInterval = setInterval(() => {
			const currentTime = isPaused
				? $accumulatedTime
				: performance.now() - $startTime! + $accumulatedTime;

			// Get the last data point
			const lastPoint = $roastData[$roastData.length - 1] || initialPoint;

			// Create current point with latest values but current time
			const currentPoint = {
				time: currentTime,
				heat: lastPoint.heat,
				fan: lastPoint.fan
			};

			// Update chart with current data plus the current point
			updateChart([...$roastData, currentPoint]);

			// Update time tracker line
			svg
				.select('.time-tracker')
				.attr('x1', xScale(currentTime / (1000 * 60)))
				.attr('x2', xScale(currentTime / (1000 * 60)))
				.style('display', 'block');
		}, 16);
	}

	// Update the reactive statement to watch for startTime changes
	$: if ($startTime !== null || isPaused || $startTime === null) {
		startTimeTracker();
	}

	// Create line generators
	const heatLine = d3
		.line<RoastPoint>()
		.x((d) => xScale(d.time / (1000 * 60)))
		.y((d) => yScaleHeat(d.heat ?? 0))
		.curve(curveStepAfter);

	const fanLine = d3
		.line<RoastPoint>()
		.x((d) => xScale(d.time / (1000 * 60)))
		.y((d) => yScaleFan(d.fan ?? 0))
		.curve(curveStepAfter);

	// Update function for the chart
	function updateChart(data: RoastPoint[]) {
		if (!svg || !xScale || !yScaleFan || !yScaleHeat) return;

		// Use the first data point's values
		const chartData =
			data.length > 0 ? [{ time: 0, heat: data[0].heat, fan: data[0].fan }, ...data] : data;

		// Update lines
		svg.select('.heat-line').datum(chartData).attr('d', heatLine);
		svg.select('.fan-line').datum(chartData).attr('d', fanLine);

		// Update heat value labels - only for points where heat changed
		const heatChanges = chartData.filter((d, i) => i === 0 || d.heat !== chartData[i - 1].heat);

		const heatLabels = svg
			.selectAll('.heat-label')
			.data(heatChanges, (d: any) => `${d.time}-${d.heat}`);

		heatLabels
			.enter()
			.append('text')
			.attr('class', 'heat-label')
			.merge(heatLabels as any)
			.attr('x', (d) => xScale(d.time / (1000 * 60)))
			.attr('y', (d) => yScaleHeat(d.heat ?? 0) - 5)
			.text((d) => d.heat)
			.attr('fill', '#b45309')
			.attr('font-size', '12px');

		heatLabels.exit().remove();

		// Update fan value labels - only for points where fan changed
		const fanChanges = chartData.filter((d, i) => i === 0 || d.fan !== chartData[i - 1].fan);

		const fanLabels = svg
			.selectAll('.fan-label')
			.data(fanChanges, (d: any) => `${d.time}-${d.fan}`);

		fanLabels
			.enter()
			.append('text')
			.attr('class', 'fan-label')
			.merge(fanLabels as any)
			.attr('x', (d) => xScale(d.time / (1000 * 60)))
			.attr('y', (d) => yScaleFan(d.fan ?? 0) - 5)
			.text((d) => d.fan)
			.attr('fill', '#3730a3')
			.attr('font-size', '12px');

		fanLabels.exit().remove();

		// Update event markers and vertical labels
		const events = svg.selectAll('.event-group').data($roastEvents);

		const eventGroups = events
			.enter()
			.append('g')
			.attr('class', 'event-group')
			.merge(events as any);

		// Update event lines
		eventGroups
			.selectAll('.event-marker')
			.data((d) => [d])
			.enter()
			.append('line')
			.attr('class', 'event-marker')
			.merge(eventGroups.selectAll('.event-marker'))
			.attr('x1', (d) => xScale(d.time / (1000 * 60)))
			.attr('x2', (d) => xScale(d.time / (1000 * 60)))
			.attr('y1', 0)
			.attr('y2', height)
			.attr('stroke', '#4ade80')
			.attr('stroke-width', 1)
			.attr('stroke-dasharray', '4,4');
		// Update event labels - now vertical
		eventGroups
			.selectAll('.event-label')
			.data((d) => [d])
			.enter()
			.append('text')
			.attr('class', 'event-label')
			.merge(eventGroups.selectAll('.event-label'))
			.attr('x', (d) => xScale(d.time / (1000 * 60)))
			.attr('y', 10)
			.text((d) => d.name)
			.attr('fill', '#4ade80')
			.attr('font-size', '12px')
			.attr('text-anchor', 'end')
			.attr('transform', (d) => `rotate(-90, ${xScale(d.time / (1000 * 60))}, 10)`);

		events.exit().remove();
	}

	// Subscribe to store changes
	$: if (
		svg &&
		typeof xScale !== 'undefined' &&
		typeof yScaleFan !== 'undefined' &&
		typeof yScaleHeat !== 'undefined'
	) {
		updateChart($roastData);
		// Update event markers separately
		const events = svg.selectAll('.event-marker').data($roastEvents);

		events
			.enter()
			.append('line')
			.attr('class', 'event-marker')
			.merge(events as any)
			.attr('x1', (d) => xScale(d.time / (1000 * 60))) // Convert ms to minutes
			.attr('x2', (d) => xScale(d.time / (1000 * 60)))
			.attr('y1', 0)
			.attr('y2', height)
			.attr('stroke', '#4ade80')
			.attr('stroke-width', 1)
			.attr('stroke-dasharray', '4,4');

		events.exit().remove();
	}

	onMount(() => {
		const margin = { top: 20, right: 60, bottom: 30, left: 60 };
		width = chartContainer.clientWidth - margin.left - margin.right;
		height = chartContainer.clientHeight - margin.top - margin.bottom;

		// Create SVG
		svg = d3
			.select(chartContainer)
			.append('svg')
			.attr('width', width + margin.left + margin.right)
			.attr('height', height + margin.top + margin.bottom)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		// Create scales
		xScale = d3.scaleLinear().domain([0, 10]).range([0, width]);

		yScaleFan = d3.scaleLinear().domain([10, 0]).range([height, 0]);

		yScaleHeat = d3.scaleLinear().domain([0, 10]).range([height, 0]);

		// Add time tracker line
		svg
			.append('line')
			.attr('class', 'time-tracker')
			.attr('y1', 0)
			.attr('y2', height)
			.attr('stroke', '#ffffff')
			.attr('stroke-width', 1)
			.style('display', 'none');

		// Create axes
		const xAxis = d3
			.axisBottom(xScale)
			.tickValues(d3.range(0, 10.25, 0.25))
			.tickFormat((d) => {
				if (Number.isInteger(d)) {
					return `${d}m`;
				}
				return '';
			})
			.tickSize(3)
			.tickSizeOuter(6);

		const yAxisFan = d3.axisLeft(yScaleFan).ticks(11);

		const yAxisHeat = d3.axisRight(yScaleHeat).ticks(11);

		// Add axes to chart
		svg.append('g').attr('transform', `translate(0,${height})`).call(xAxis);

		svg.append('g').call(yAxisFan);

		svg.append('g').attr('transform', `translate(${width},0)`).call(yAxisHeat);

		// Initialize empty paths
		svg
			.append('path')
			.attr('class', 'heat-line')
			.attr('fill', 'none')
			.attr('stroke', '#b45309')
			.attr('stroke-width', 2);

		svg
			.append('path')
			.attr('class', 'fan-line')
			.attr('fill', 'none')
			.attr('stroke', '#3730a3')
			.attr('stroke-width', 2);
	});

	// Cleanup on component destroy
	onDestroy(() => {
		if (timeTrackerInterval) {
			clearInterval(timeTrackerInterval);
		}
	});
</script>

<div bind:this={chartContainer} class="h-full w-full text-zinc-400"></div>
