<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';
	import { formatDateForDisplay } from '$lib/utils/dates';
	import SalesTable from './SalesTable.svelte';
	import SaleForm from './SaleForm.svelte';

	interface ProfitData {
		id: number;
		purchase_date: string;
		coffee_name: string;
		purchased_qty_lbs: number;
		purchased_qty_oz: number;
		bean_cost: number; // Raw cost of beans
		tax_ship_cost: number; // Additional costs
		total_sales: number; // Total revenue from sales
		oz_sold: number; // Amount sold in ounces
		oz_in: number; // Amount roasted in ounces
		oz_out: number; // output after roast (accounts for water loss during roast)
		profit: number; // Calculated profit
		profit_margin: number; // Profit margin as percentage
	}

	interface RoastProfileData {
		roast_id: number;
		coffee_id: number;
		oz_in: number;
		oz_out: number;
	}

	// Add new interfaces and variables for sales functionality
	interface SaleData {
		id: number;
		green_coffee_inv_id: number;
		oz_sold: number;
		price: number;
		buyer: string;
		batch_name: string;
		sell_date: string;
		purchase_date: string;
		coffee_name?: string;
	}

	let profitData: ProfitData[] = [];
	let roastProfileData: RoastProfileData[] = [];
	let selectedDateRange: 'all' | '30' | '90' | '180' | '365' = 'all';
	let chartContainer: HTMLDivElement;
	let expandedDates = new Set<string>();
	let salesData: SaleData[] = [];
	let isFormVisible = false;
	let selectedSale: SaleData | null = null;
	let selectedCoffee: string | null = null;

	// Updated aggregate metrics
	$: totalRevenue = d3.sum(profitData, (d) => +d.total_sales || 0);
	$: totalCost = d3.sum(profitData, (d) => (+d.bean_cost || 0) + (+d.tax_ship_cost || 0));
	$: totalProfit = d3.sum(profitData, (d) => +d.profit || 0);
	$: averageMargin = (() => {
		// Calculate cost per oz for each item
		const margins = profitData.map((d) => {
			const totalOz = (+d.purchased_qty_lbs || 0) * 16 + (+d.purchased_qty_oz || 0);
			const costPerOz = totalOz ? ((+d.bean_cost || 0) + (+d.tax_ship_cost || 0)) / totalOz : 0;
			const soldCost = costPerOz * (+d.oz_sold || 0);
			const sales = +d.total_sales || 0;
			return sales > 0 ? ((sales - soldCost) / sales) * 100 : 0;
		});

		// Calculate weighted average margin based on sales
		const totalSales = d3.sum(profitData, (d) => +d.total_sales || 0);
		return totalSales > 0
			? d3.sum(margins.map((margin, i) => margin * (+profitData[i].total_sales || 0))) / totalSales
			: 0;
	})();
	$: totalPoundsRoasted = d3.sum(profitData, (d) => +d.purchased_qty_lbs || 0);

	// Add these reactive declarations after your existing ones
	$: sellThroughRate = (() => {
		const totalOzSold = d3.sum(profitData, (d) => +d.oz_sold || 0);
		const totalOzPurchased = d3.sum(profitData, (d) => (+d.purchased_qty_lbs || 0) * 16);
		return totalOzPurchased > 0 ? (totalOzSold / totalOzPurchased) * 100 : 0;
	})();
	$: avgCostPerPound = totalPoundsRoasted ? totalCost / totalPoundsRoasted : 0;
	$: avgRevenuePerPound = totalPoundsRoasted ? totalRevenue / totalPoundsRoasted : 0;
	$: avgProfitPerPound = totalPoundsRoasted ? totalProfit / totalPoundsRoasted : 0;

	$: roastLossRate = (() => {
		// Group roast data by coffee_id
		const roastsByBean = d3.group(roastProfileData, (d) => d.coffee_id);

		// Sum up oz_in and oz_out for each coffee
		let totalOzIn = 0;
		let totalOzOut = 0;

		roastsByBean.forEach((roasts) => {
			totalOzIn += d3.sum(roasts, (d) => Number(d.oz_in) || 0);
			totalOzOut += d3.sum(roasts, (d) => Number(d.oz_out) || 0);
		});

		// Calculate loss rate if we have valid data
		return totalOzIn > 0 ? ((totalOzIn - totalOzOut) / totalOzIn) * 100 : 0;
	})();

	// Add this reactive declaration after your existing ones
	$: groupedProfitData = d3.group(profitData, (d) => d.purchase_date);

	// Add sales chart related functions
	function createSalesChart() {
		// Get the container width
		width = chartContainer.clientWidth - margin.left - margin.right;

		// Clear existing chart
		d3.select(chartContainer).selectAll('*').remove();

		// Create SVG
		const svg = d3
			.select(chartContainer)
			.append('svg')
			.attr('width', '100%')
			.attr('height', height + margin.top + margin.bottom)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		// Create default scales for empty state
		const xScale = d3
			.scaleTime()
			.domain([new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), new Date()]) // Last 30 days
			.range([0, width]);

		const yScale = d3
			.scaleLinear()
			.domain([0, 21]) // Default y-axis range
			.range([height, 0]);

		// Create axes with white text
		const xAxis = d3.axisBottom(xScale).tickFormat((d) => (d as Date).toLocaleDateString());
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

		// Always add sales points using initial salesData
		// Update scales with actual data
		xScale.domain(d3.extent(salesData, (d) => new Date(d.sell_date)) as [Date, Date]);
		yScale.domain([0, Math.max(21, d3.max(salesData, (d) => d.price) || 0)]);

		// Update axes with new scales
		svg.select<SVGGElement>('g').call(xAxis);
		svg
			.selectAll<SVGGElement, unknown>('g')
			.filter((d, i) => i === 1)
			.call(yAxis);

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

	// Add tooltip helper functions
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

	// Also add these variables at the top of your script with other variables
	let width: number;
	let height = 400;
	let margin = { top: 20, right: 20, bottom: 50, left: 60 };

	// Add sales form handlers
	async function handleFormSubmit(saleData: any) {
		try {
			const response = await fetch(`/api/profit${selectedSale ? `?id=${selectedSale.id}` : ''}`, {
				method: selectedSale ? 'PUT' : 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(saleData)
			});

			if (!response.ok) {
				throw new Error(`Failed to ${selectedSale ? 'update' : 'create'} sale`);
			}

			// Refresh the sales data for the selected coffee
			await fetchSalesForCoffee(salesData[0].coffee_name || '');
		} catch (error) {
			console.error('Error updating sales data:', error);
		}
		isFormVisible = false;
		selectedSale = null;
	}

	async function fetchSalesForCoffee(coffeeName: string) {
		try {
			const response = await fetch(`/api/profit?coffee=${encodeURIComponent(coffeeName)}`);
			if (response.ok) {
				const data = await response.json();
				salesData = data.sales || [];
				setTimeout(createSalesChart, 0);
			}
		} catch (error) {
			console.error('Error fetching sales data:', error);
		}
	}

	// Modify toggleDate to set the selected coffee
	function toggleDate(date: string) {
		if (expandedDates.has(date)) {
			expandedDates.delete(date);
			salesData = [];
			selectedCoffee = null; // Clear selected coffee when closing
		} else {
			expandedDates.add(date);
			// Get the first coffee for this date
			const items = groupedProfitData.get(date) || [];
			if (items.length > 0) {
				selectedCoffee = items[0].coffee_name; // Set selected coffee
				fetchSalesForCoffee(items[0].coffee_name);
			}
		}
		expandedDates = expandedDates;
	}

	function handleSaleEdit(sale: SaleData) {
		selectedSale = sale;
		isFormVisible = true;
	}

	async function handleSaleDelete(id: number) {
		if (salesData.length > 0) {
			await fetchSalesForCoffee(salesData[0].coffee_name || '');
		}
	}

	// Modify onMount to include fetching sales data
	onMount(() => {
		const fetchData = async () => {
			await Promise.all([fetchProfitData(), fetchRoastProfileData(), fetchInitialSalesData()]);
			createSalesChart();
		};

		fetchData(); // Call the async function

		const handleResize = () => {
			createSalesChart();
		};

		window.addEventListener('resize', handleResize);

		return () => {
			window.removeEventListener('resize', handleResize);
		};
	});

	async function fetchProfitData() {
		try {
			const response = await fetch('/api/profit');
			if (response.ok) {
				const data = await response.json();
				profitData = data.profit || [];
			}
		} catch (error) {
			console.error('Error fetching profit data:', error);
		}
	}

	async function fetchRoastProfileData() {
		try {
			const response = await fetch('/api/roast-profiles');
			if (response.ok) {
				const data = await response.json();
				roastProfileData = data.data.filter(
					(profile: RoastProfileData) => profile.oz_in != null && profile.oz_out != null
				);
			}
		} catch (error) {
			console.error('Error fetching roast profile data:', error);
		}
	}

	async function fetchInitialSalesData() {
		try {
			const response = await fetch('/api/profit');
			if (response.ok) {
				const data = await response.json();
				salesData = data.sales || [];
				profitData = data.profit || [];
			}
		} catch (error) {
			console.error('Error fetching sales data:', error);
		}
	}
</script>

<!-- Add form modal -->
{#if isFormVisible}
	<div class="fixed inset-0 flex items-center justify-center bg-black bg-opacity-75">
		<div class="w-full max-w-2xl rounded-lg bg-zinc-800 p-6">
			<SaleForm
				sale={selectedSale}
				onClose={() => {
					isFormVisible = false;
					selectedSale = null;
				}}
				onSubmit={handleFormSubmit}
			/>
		</div>
	</div>
{/if}

<div class="m-8 p-8">
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
			<h3 class="text-sm text-zinc-400">Average Sales Margin</h3>
			<p class="text-xl font-bold text-purple-500">{averageMargin.toFixed(1)}%</p>
		</div>
		<div class="rounded-lg bg-zinc-800 p-4">
			<h3 class="text-sm text-zinc-400">Total Pounds Roasted</h3>
			<p class="text-xl font-bold text-orange-500">{totalPoundsRoasted.toFixed(1)} lbs</p>
		</div>
		<div class="rounded-lg bg-zinc-800 p-4">
			<h3 class="text-sm text-zinc-400">Avg. Sell-Through Rate</h3>
			<p class="text-xl font-bold text-yellow-500">{sellThroughRate.toFixed(1)}%</p>
		</div>
		<div class="rounded-lg bg-zinc-800 p-4">
			<h3 class="text-sm text-zinc-400">Avg. Profit/lb</h3>
			<p class="text-xl font-bold text-emerald-500">${avgProfitPerPound.toFixed(2)}</p>
		</div>
		<div class="rounded-lg bg-zinc-800 p-4">
			<h3 class="text-sm text-zinc-400">Avg. Cost/lb</h3>
			<p class="text-xl font-bold text-pink-500">${avgCostPerPound.toFixed(2)}</p>
		</div>
		<div class="rounded-lg bg-zinc-800 p-4">
			<h3 class="text-sm text-zinc-400">Avg. Revenue/lb</h3>
			<p class="text-xl font-bold text-indigo-500">${avgRevenuePerPound.toFixed(2)}</p>
		</div>
		<div class="rounded-lg bg-zinc-800 p-4">
			<h3 class="text-sm text-zinc-400">Avg. Roast Loss</h3>
			<p class="text-xl font-bold text-cyan-500">{roastLossRate.toFixed(2)}%</p>
		</div>
	</div>

	<div class="mb-8 w-full rounded-lg bg-zinc-800 p-6">
		<div bind:this={chartContainer} class="w-full"></div>
	</div>

	<!-- Detailed Profit Table -->
	<div class="mt-8 overflow-x-auto">
		<table class="w-full table-auto bg-zinc-800">
			<thead class="bg-zinc-700 text-xs uppercase text-zinc-400">
				<tr>
					<th class="px-6 py-3">Purchase Date</th>
					<th class="px-6 py-3">Details</th>
				</tr>
			</thead>
			<tbody>
				{#each [...groupedProfitData] as [date, items]}
					<!-- Purchase Date Group Header -->
					<tr
						class="cursor-pointer bg-zinc-700 hover:bg-zinc-600"
						on:click={() => toggleDate(date)}
					>
						<td class="px-6 py-2 text-left text-xs font-semibold text-zinc-300">
							{expandedDates.has(date) ? '▼' : '▶'}
							{formatDateForDisplay(date)}
						</td>
						<td class="px-6 py-2 text-left text-xs font-semibold text-zinc-300">
							<div class="flex gap-4">
								<span>{items.length} items</span>
								<span
									>Total Cost: ${items
										.reduce(
											(sum, item) => sum + Number(item.bean_cost) + Number(item.tax_ship_cost),
											0
										)
										.toFixed(2)}</span
								>
								<span
									>Total Sales: ${items
										.reduce((sum, item) => sum + Number(item.total_sales), 0)
										.toFixed(2)}</span
								>
								<span
									>Total Profit: ${items
										.reduce((sum, item) => sum + Number(item.profit), 0)
										.toFixed(2)}</span
								>
								<span
									>Avg Margin: {(
										items.reduce((sum, item) => sum + Number(item.profit_margin), 0) / items.length
									).toFixed(1)}%</span
								>
							</div>
						</td>
					</tr>
					<!-- Items for this purchase date -->
					{#if expandedDates.has(date)}
						{#each items as item}
							<tr class="border-b border-zinc-700 bg-zinc-800 transition-colors hover:bg-zinc-700">
								<td
									class="cursor-pointer px-6 py-4 pl-12 text-xs text-zinc-300 hover:text-blue-400"
									on:click={() => {
										selectedCoffee = item.coffee_name;
										fetchSalesForCoffee(item.coffee_name);
									}}
								>
									<span class={selectedCoffee === item.coffee_name ? 'text-blue-400' : ''}>
										{item.coffee_name}
									</span>
								</td>
								<td class="px-6 py-4 text-xs text-zinc-300">
									<div class="flex gap-4">
										<span>Qty: {item.purchased_qty_lbs.toFixed(2)} lbs</span>
										<span
											>Cost: ${(Number(item.bean_cost) + Number(item.tax_ship_cost)).toFixed(
												2
											)}</span
										>
										<span>Sales: ${Number(item.total_sales).toFixed(2)}</span>
										<span>Profit: ${Number(item.profit).toFixed(2)}</span>
										<span>Margin: {Number(item.profit_margin).toFixed(1)}%</span>
									</div>
								</td>
							</tr>
						{/each}
					{/if}
				{/each}
			</tbody>
		</table>
	</div>

	<!-- Modify the sales content section -->
	{#if salesData.length > 0 && selectedCoffee}
		<div class="mt-8">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-xl font-bold text-zinc-400">
					Sales for {selectedCoffee}
				</h2>
				<button
					class="rounded border-2 border-green-800 px-3 py-1 text-zinc-500 hover:bg-green-900"
					on:click={() => {
						selectedSale = null;
						isFormVisible = true;
					}}
				>
					New Sale
				</button>
			</div>

			<SalesTable
				salesData={salesData.filter((sale) => sale.coffee_name === selectedCoffee)}
				onEdit={handleSaleEdit}
				onDelete={handleSaleDelete}
			/>
		</div>
	{/if}
</div>
