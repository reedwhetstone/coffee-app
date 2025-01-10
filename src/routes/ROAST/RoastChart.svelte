<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as d3 from 'd3';
	import {
		roastData,
		roastEvents,
		startTime,
		accumulatedTime,
		profileLogs,
		type RoastPoint
	} from './stores';
	import { curveStepAfter } from 'd3-shape';

	let chartContainer: HTMLDivElement;
	let svg: d3.Selection<SVGGElement, unknown, null, undefined>;
	let xScale: d3.ScaleLinear<number, number>;
	let yScaleFan: d3.ScaleLinear<number, number>;
	let yScaleHeat: d3.ScaleLinear<number, number>;
	let height: number;
	let width: number;

	export let isPaused = false;
	export let currentRoastProfile: any | null = null;

	// Remove the unused exports and track current values from roastData
	let currentFanValue = 10;
	let currentHeatValue = 0;

	// Update current values when roastData changes
	$: if ($roastData.length > 0) {
		const lastDataPoint = $roastData[$roastData.length - 1];
		currentFanValue = lastDataPoint.fan;
		currentHeatValue = lastDataPoint.heat;
	}

	// Create line generators
	const heatLine = d3
		.line<RoastPoint>()
		.x((d) => xScale(d.time / (1000 * 60)))
		.y((d) => yScaleHeat(d.heat))
		.curve(curveStepAfter);

	const fanLine = d3
		.line<RoastPoint>()
		.x((d) => xScale(d.time / (1000 * 60)))
		.y((d) => yScaleFan(d.fan))
		.curve(curveStepAfter);

	function updateChart(data: RoastPoint[]) {
		if (!svg || !xScale || !yScaleFan || !yScaleHeat) return;

		// Clear existing elements
		svg.selectAll('.heat-line').remove();
		svg.selectAll('.fan-line').remove();
		svg.selectAll('.heat-label').remove();
		svg.selectAll('.fan-label').remove();
		svg.selectAll('.event-marker').remove();
		svg.selectAll('.event-label').remove();
		svg.select('.time-tracker').style('display', 'none');

		// Update x-axis scale based on data duration
		const maxTime = Math.max(...data.map((d) => d.time));
		const timeInMinutes = maxTime / (1000 * 60);
		xScale.domain([0, Math.max(10, Math.ceil(timeInMinutes))]);

		// Update axes
		svg.select('.x-axis').call(d3.axisBottom(xScale));

		// Add heat line
		svg
			.append('path')
			.attr('class', 'heat-line')
			.datum(data)
			.attr('fill', 'none')
			.attr('stroke', '#b45309')
			.attr('stroke-width', 2)
			.attr('d', heatLine);

		// Add fan line
		svg
			.append('path')
			.attr('class', 'fan-line')
			.datum(data)
			.attr('fill', 'none')
			.attr('stroke', '#3730a3')
			.attr('stroke-width', 2)
			.attr('d', fanLine);

		// Add heat value labels
		const heatChanges = data.filter((d, i) => i === 0 || d.heat !== data[i - 1].heat);
		svg
			.selectAll('.heat-label')
			.data(heatChanges)
			.enter()
			.append('text')
			.attr('class', 'heat-label')
			.attr('x', (d) => xScale(d.time / (1000 * 60)))
			.attr('y', (d) => yScaleHeat(d.heat))
			.attr('dy', -5)
			.attr('fill', '#b45309')
			.attr('font-size', '12px')
			.text((d) => d.heat);

		// Add fan value labels
		const fanChanges = data.filter((d, i) => i === 0 || d.fan !== data[i - 1].fan);
		svg
			.selectAll('.fan-label')
			.data(fanChanges)
			.enter()
			.append('text')
			.attr('class', 'fan-label')
			.attr('x', (d) => xScale(d.time / (1000 * 60)))
			.attr('y', (d) => yScaleFan(d.fan))
			.attr('dy', -5)
			.attr('fill', '#3730a3')
			.attr('font-size', '12px')
			.text((d) => d.fan);

		// Update event markers
		const eventGroups = svg
			.selectAll('.event-group')
			.data($roastEvents)
			.enter()
			.append('g')
			.attr('class', 'event-group');

		eventGroups
			.append('line')
			.attr('class', 'event-marker')
			.attr('x1', (d) => xScale(d.time / (1000 * 60)))
			.attr('x2', (d) => xScale(d.time / (1000 * 60)))
			.attr('y1', 0)
			.attr('y2', height)
			.attr('stroke', '#4ade80')
			.attr('stroke-width', 1)
			.attr('stroke-dasharray', '4,4');

		eventGroups
			.append('text')
			.attr('class', 'event-label')
			.attr('x', (d) => xScale(d.time / (1000 * 60)))
			.attr('y', 10)
			.text((d) => d.name)
			.attr('fill', '#4ade80')
			.attr('font-size', '12px')
			.attr('text-anchor', 'end')
			.attr('transform', (d) => `rotate(-90, ${xScale(d.time / (1000 * 60))}, 10)`);
	}

	// Handle profile changes
	$: if (currentRoastProfile) {
		if (!currentRoastProfile.has_log_data) {
			$roastData = [];
			$roastEvents = [];
			$profileLogs = [];
			$startTime = null;
			$accumulatedTime = 0;
		}
		updateChart($roastData);
	}

	// Update chart when roastData changes
	$: if (svg && xScale && yScaleFan && yScaleHeat) {
		updateChart($roastData);
	}

	onMount(() => {
		const margin = { top: 20, right: 60, bottom: 30, left: 60 };
		width = chartContainer.clientWidth - margin.left - margin.right;
		height = chartContainer.clientHeight - margin.top - margin.bottom;

		svg = d3
			.select(chartContainer)
			.append('svg')
			.attr('width', width + margin.left + margin.right)
			.attr('height', height + margin.top + margin.bottom)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

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

		// Add axes
		svg
			.append('g')
			.attr('class', 'x-axis')
			.attr('transform', `translate(0,${height})`)
			.call(d3.axisBottom(xScale));

		svg.append('g').call(d3.axisLeft(yScaleFan));

		svg.append('g').attr('transform', `translate(${width},0)`).call(d3.axisRight(yScaleHeat));

		// Initial chart update
		updateChart($roastData);
	});
</script>

<div bind:this={chartContainer} class="h-full w-full text-zinc-400"></div>
