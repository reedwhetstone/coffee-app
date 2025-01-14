<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';

	interface SaleData {
		id: number;
		green_coffee_inv_id: number;
		oz_sold: number;
		price: number;
		buyer: string;
		batch_name: string;
		sell_date: string;
		purchase_date: string;
		coffee_name?: string; // From green_coffee_inv
		roast_date?: string; // From roast_profiles
	}

	let salesData: SaleData[] = [];
	let chartContainer: HTMLDivElement;
	let svg: d3.Selection<SVGGElement, unknown, null, undefined>;
	let margin = { top: 20, right: 20, bottom: 50, left: 60 };
	let width = 800;
	let height = 400;

	onMount(async () => {
		try {
			const response = await fetch('/api/sales');
			if (response.ok) {
				salesData = await response.json();
				createChart();
			}
		} catch (error) {
			console.error('Error fetching sales data:', error);
		}
	});

	function createChart() {
		// Clear existing chart
		d3.select(chartContainer).selectAll('*').remove();

		// Create SVG
		svg = d3
			.select(chartContainer)
			.append('svg')
			.attr('width', width + margin.left + margin.right)
			.attr('height', height + margin.top + margin.bottom)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		// Create scales
		const xScale = d3
			.scaleTime()
			.domain(d3.extent(salesData, (d) => new Date(d.sell_date)) as [Date, Date])
			.range([0, width]);
		// set the price range in the chart
		const yScale = d3.scaleLinear().domain([0, 20]).range([height, 0]);

		// Create axes with white text
		const xAxis = d3.axisBottom(xScale).tickFormat((d) => d.toLocaleDateString());
		const yAxis = d3.axisLeft(yScale).tickFormat((d) => `$${d}`);

		// Add axes to chart with white text styling
		svg
			.append('g')
			.attr('transform', `translate(0,${height})`)
			.call(xAxis)
			.attr('color', 'white')
			.selectAll('text')
			.style('fill', 'white');

		svg.append('g').call(yAxis).attr('color', 'white').selectAll('text').style('fill', 'white');

		// Add sales points
		svg
			.selectAll('circle')
			.data(salesData)
			.enter()
			.append('circle')
			.attr('cx', (d) => xScale(new Date(d.sell_date)))
			.attr('cy', (d) => yScale(d.price))
			.attr('r', 5)
			.attr('fill', '#3730a3')
			.on('mouseover', function (event, d) {
				showTooltip(event, d);
			})
			.on('mouseout', hideTooltip);
	}

	function showTooltip(event: MouseEvent, d: SaleData) {
		const tooltip = d3
			.select('body')
			.append('div')
			.attr('class', 'tooltip')
			.style('position', 'absolute')
			.style('background', '#1f2937')
			.style('padding', '10px')
			.style('border-radius', '5px')
			.style('color', 'white')
			.style('font-size', '12px');

		tooltip
			.html(
				`
            <div>
                <strong>Batch:</strong> ${d.batch_name}<br>
                <strong>Coffee:</strong> ${d.coffee_name || 'N/A'}<br>
                <strong>Buyer:</strong> ${d.buyer}<br>
                <strong>Amount:</strong> ${d.oz_sold}oz<br>
                <strong>Price:</strong> $${d.price}<br>
                <strong>Sale Date:</strong> ${new Date(d.sell_date).toLocaleDateString()}
            </div>
        `
			)
			.style('left', event.pageX + 10 + 'px')
			.style('top', event.pageY - 10 + 'px');
	}

	function hideTooltip() {
		d3.select('.tooltip').remove();
	}
</script>

<div class="m-8">
	<h1 class="mb-4 text-2xl font-bold text-zinc-400">Sales Overview</h1>
	<div class="rounded-lg bg-zinc-800 p-6">
		<div bind:this={chartContainer}></div>
	</div>
</div>
