<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';

	interface ProfitData {
		purchase_date: string;
		coffee_name: string;
		purchased_qty_lbs: number;
		bean_cost: number;
		tax_ship_cost: number;
		total_sales: number;
		oz_sold: number;
		profit: number;
		profit_margin: number;
	}

	let profitData: ProfitData[] = [];
	let selectedDateRange: 'all' | '30' | '90' | '180' | '365' = 'all';
	let chartContainer: HTMLDivElement;

	// Aggregate metrics
	$: totalRevenue = d3.sum(profitData, (d) => d.total_sales);
	$: totalCost = d3.sum(profitData, (d) => d.bean_cost + d.tax_ship_cost);
	$: totalProfit = d3.sum(profitData, (d) => d.profit);
	$: averageMargin = d3.mean(profitData, (d) => d.profit_margin) || 0;
	$: totalPoundsRoasted = d3.sum(profitData, (d) => d.oz_sold) / 16;

	onMount(async () => {
		await fetchProfitData();
		createChart();
	});

	async function fetchProfitData() {
		try {
			const response = await fetch('/api/profit');
			if (response.ok) {
				profitData = await response.json();
			}
		} catch (error) {
			console.error('Error fetching profit data:', error);
		}
	}

	function createChart() {
		// Clear existing chart
		d3.select(chartContainer).selectAll('*').remove();

		const margin = { top: 20, right: 20, bottom: 50, left: 60 };
		const width = chartContainer.clientWidth - margin.left - margin.right;
		const height = 400 - margin.top - margin.bottom;

		const svg = d3
			.select(chartContainer)
			.append('svg')
			.attr('width', width + margin.left + margin.right)
			.attr('height', height + margin.top + margin.bottom)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		// Create scales
		const xScale = d3
			.scaleBand()
			.domain(profitData.map((d) => d.coffee_name))
			.range([0, width])
			.padding(0.1);

		const yScale = d3
			.scaleLinear()
			.domain([0, d3.max(profitData, (d) => d.profit) || 0])
			.range([height, 0]);

		// Create bars
		svg
			.selectAll('rect')
			.data(profitData)
			.enter()
			.append('rect')
			.attr('x', (d) => xScale(d.coffee_name) || 0)
			.attr('y', (d) => yScale(d.profit))
			.attr('width', xScale.bandwidth())
			.attr('height', (d) => height - yScale(d.profit))
			.attr('fill', '#3730a3');

		// Add axes
		svg
			.append('g')
			.attr('transform', `translate(0,${height})`)
			.call(d3.axisBottom(xScale))
			.selectAll('text')
			.attr('transform', 'rotate(-45)')
			.style('text-anchor', 'end');

		svg.append('g').call(d3.axisLeft(yScale));
	}
</script>

<div class="m-8">
	<h1 class="mb-4 text-2xl font-bold text-zinc-400">Profit Dashboard</h1>

	<!-- KPI Cards -->
	<div class="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
		<div class="rounded-lg bg-zinc-800 p-4">
			<h3 class="text-sm text-zinc-400">Total Revenue</h3>
			<p class="text-xl font-bold text-green-500">${totalRevenue.toFixed(2)}</p>
		</div>
		<div class="rounded-lg bg-zinc-800 p-4">
			<h3 class="text-sm text-zinc-400">Total Cost</h3>
			<p class="text-xl font-bold text-red-500">${totalCost.toFixed(2)}</p>
		</div>
		<div class="rounded-lg bg-zinc-800 p-4">
			<h3 class="text-sm text-zinc-400">Total Profit</h3>
			<p class="text-xl font-bold text-blue-500">${totalProfit.toFixed(2)}</p>
		</div>
		<div class="rounded-lg bg-zinc-800 p-4">
			<h3 class="text-sm text-zinc-400">Average Margin</h3>
			<p class="text-xl font-bold text-purple-500">{averageMargin.toFixed(1)}%</p>
		</div>
		<div class="rounded-lg bg-zinc-800 p-4">
			<h3 class="text-sm text-zinc-400">Total Pounds Roasted</h3>
			<p class="text-xl font-bold text-orange-500">{totalPoundsRoasted.toFixed(1)} lbs</p>
		</div>
	</div>

	<!-- Date Range Filter -->
	<div class="mb-4">
		<select bind:value={selectedDateRange} class="rounded bg-zinc-700 px-4 py-2 text-zinc-300">
			<option value="all">All Time</option>
			<option value="30">Last 30 Days</option>
			<option value="90">Last 90 Days</option>
			<option value="180">Last 180 Days</option>
			<option value="365">Last Year</option>
		</select>
	</div>

	<!-- Profit Chart -->
	<div class="rounded-lg bg-zinc-800 p-6">
		<div bind:this={chartContainer} class="w-full"></div>
	</div>

	<!-- Detailed Table -->
	<div class="mt-8 overflow-x-auto">
		<table class="w-full table-auto bg-zinc-800">
			<thead class="bg-zinc-700 text-xs uppercase text-zinc-400">
				<tr>
					<th class="px-6 py-3">Coffee</th>
					<th class="px-6 py-3">Purchase Date</th>
					<th class="px-6 py-3">Qty (lbs)</th>
					<th class="px-6 py-3">Cost</th>
					<th class="px-6 py-3">Sales</th>
					<th class="px-6 py-3">Profit</th>
					<th class="px-6 py-3">Margin</th>
				</tr>
			</thead>
			<tbody>
				{#each profitData as item}
					<tr class="border-b border-zinc-700 text-zinc-300">
						<td class="px-6 py-4">{item.coffee_name}</td>
						<td class="px-6 py-4">{new Date(item.purchase_date).toLocaleDateString()}</td>
						<td class="px-6 py-4">{item.purchased_qty_lbs.toFixed(2)}</td>
						<td class="px-6 py-4">${(item.bean_cost + item.tax_ship_cost).toFixed(2)}</td>
						<td class="px-6 py-4">${item.total_sales.toFixed(2)}</td>
						<td class="px-6 py-4">${item.profit.toFixed(2)}</td>
						<td class="px-6 py-4">{item.profit_margin.toFixed(1)}%</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
