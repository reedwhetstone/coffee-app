<script>
	import { onMount } from 'svelte';
	import * as d3 from 'd3';

	let chartContainer;

	onMount(() => {
		const margin = { top: 20, right: 60, bottom: 30, left: 60 };
		const width = chartContainer.clientWidth - margin.left - margin.right;
		const height = chartContainer.clientHeight - margin.top - margin.bottom;

		// Create SVG
		const svg = d3
			.select(chartContainer)
			.append('svg')
			.attr('width', width + margin.left + margin.right)
			.attr('height', height + margin.top + margin.bottom)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		// Create scales
		const xScale = d3
			.scaleLinear()
			.domain([0, 12]) // 0-12 minutes
			.range([0, width]);

		const yScaleFan = d3
			.scaleLinear()
			.domain([10, 0]) // Fan settings 10-0 (inverted)
			.range([0, height]);

		const yScaleHeat = d3
			.scaleLinear()
			.domain([0, 10]) // Heat settings 0-10
			.range([height, 0]);

		// Create axes
		const xAxis = d3
			.axisBottom(xScale)
			.ticks(12)
			.tickFormat((d) => `${d}m`);

		const yAxisFan = d3.axisLeft(yScaleFan).ticks(11);

		const yAxisHeat = d3.axisRight(yScaleHeat).ticks(11);

		// Add axes to chart
		svg.append('g').attr('transform', `translate(0,${height})`).call(xAxis);

		svg.append('g').call(yAxisFan);

		svg.append('g').attr('transform', `translate(${width},0)`).call(yAxisHeat);

		// Add axis labels
		svg
			.append('text')
			.attr('transform', 'rotate(-90)')
			.attr('y', -margin.left + 20)
			.attr('x', -height / 2)
			.attr('text-anchor', 'middle')
			.text('Fan Setting');

		svg
			.append('text')
			.attr('transform', 'rotate(90)')
			.attr('y', -width - margin.right + 20)
			.attr('x', height / 2)
			.attr('text-anchor', 'middle')
			.text('Heat Setting');

		svg
			.append('text')
			.attr('x', width / 2)
			.attr('y', height + margin.bottom)
			.attr('text-anchor', 'middle')
			.text('Time (minutes)');
	});
</script>

<div bind:this={chartContainer} class="chart"></div>

<style>
	.chart {
		width: 100%;
		height: 100%;
	}
</style>
