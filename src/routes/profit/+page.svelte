<script lang="ts">
	import {
		sum,
		group,
		select,
		extent,
		max,
		axisBottom,
		axisLeft,
		scaleLinear,
		scaleTime,
		curveMonotoneX,
		line
	} from 'd3';
	import { onMount } from 'svelte';
	import SaleForm from './SaleForm.svelte';
	import { page } from '$app/state';
	import type { PageData } from './$types';

	// Lazy load the profit cards component
	let ProfitCards = $state<any>(null);
	let profitCardsLoading = $state(true);

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
		totalCost?: number;
	}

	// Convert state variables to use $state
	let profitData = $state<ProfitData[]>([]);
	let roastProfileData = $state<RoastProfileData[]>([]);
	let chartContainer: HTMLDivElement;
	let expandedDates = $state(new Set<string>());
	let salesData = $state<SaleData[]>([]);
	let isFormVisible = $state(false);
	let selectedSale = $state<SaleData | null>(null);
	let selectedCoffee = $state<string | null>(null);
	let width: number;
	let height = 400;
	let margin = { top: 20, right: 20, bottom: 50, left: 60 };

	let { data } = $props<{ data: PageData }>();

	// Convert reactive statements to use $derived
	let totalRevenue = $derived(sum(profitData, (d) => +d.total_sales || 0));
	let totalCost = $derived(sum(profitData, (d) => (+d.bean_cost || 0) + (+d.tax_ship_cost || 0)));
	let totalProfit = $derived(sum(profitData, (d) => +d.profit || 0));

	let averageMargin = $derived(() => {
		// Calculate cost per oz for each item
		const margins = profitData.map((d) => {
			const totalOz = (+d.purchased_qty_lbs || 0) * 16 + (+d.purchased_qty_oz || 0);
			const costPerOz = totalOz ? ((+d.bean_cost || 0) + (+d.tax_ship_cost || 0)) / totalOz : 0;
			const soldCost = costPerOz * (+d.oz_sold || 0);
			const sales = +d.total_sales || 0;
			return sales > 0 ? ((sales - soldCost) / sales) * 100 : 0;
		});

		// Calculate weighted average margin based on sales
		const totalSales = sum(profitData, (d) => +d.total_sales || 0);
		return totalSales > 0
			? sum(margins.map((margin, i) => margin * (+profitData[i].total_sales || 0))) / totalSales
			: 0;
	});

	let totalPoundsRoasted = $derived(sum(profitData, (d) => +d.purchased_qty_lbs || 0));
	let sellThroughRate = $derived(() => {
		const totalOzSold = sum(profitData, (d) => +d.oz_sold || 0);
		const totalOzPurchased = sum(profitData, (d) => (+d.purchased_qty_lbs || 0) * 16);
		return totalOzPurchased > 0 ? (totalOzSold / totalOzPurchased) * 100 : 0;
	});

	let avgCostPerPound = $derived(() => (totalPoundsRoasted ? totalCost / totalPoundsRoasted : 0));
	let avgRevenuePerPound = $derived(() =>
		totalPoundsRoasted ? totalRevenue / totalPoundsRoasted : 0
	);
	let avgProfitPerPound = $derived(() =>
		totalPoundsRoasted ? totalProfit / totalPoundsRoasted : 0
	);

	let roastLossRate = $derived(() => {
		// Group roast data by coffee_id
		const roastsByBean = group(roastProfileData, (d) => d.coffee_id);

		// Sum up oz_in and oz_out for each coffee
		let totalOzIn = 0;
		let totalOzOut = 0;

		roastsByBean.forEach((roasts) => {
			totalOzIn += sum(roasts, (d) => Number(d.oz_in) || 0);
			totalOzOut += sum(roasts, (d) => Number(d.oz_out) || 0);
		});

		// Calculate loss rate if we have valid data
		return totalOzIn > 0 ? ((totalOzIn - totalOzOut) / totalOzIn) * 100 : 0;
	});

	// Add sales chart related functions
	function createSalesChart() {
		// Get the container width
		width = chartContainer.clientWidth - margin.left - margin.right;

		// Clear existing chart
		select(chartContainer).selectAll('*').remove();

		// Sort data by date and calculate running totals
		const sortedSales = [...salesData].sort(
			(a, b) => new Date(a.sell_date).getTime() - new Date(b.sell_date).getTime()
		);

		const sortedProfitData = [...profitData].sort(
			(a, b) => new Date(a.purchase_date).getTime() - new Date(b.purchase_date).getTime()
		);

		let runningTotal = 0;
		let runningCost = 0;
		const cumulativeData = sortedSales.map((sale) => {
			runningTotal += sale.price;
			// Find all costs up to this sale date
			runningCost = sum(
				sortedProfitData.filter((p) => new Date(p.purchase_date) <= new Date(sale.sell_date)),
				(p) => (+p.bean_cost || 0) + (+p.tax_ship_cost || 0)
			);

			return {
				...sale,
				cumulativeTotal: runningTotal,
				cumulativeCost: runningCost
			};
		});

		// Calculate trend line data
		const trendData = sortedSales.map((sale) => {
			// Calculate total lbs purchased up to this date
			const lbsPurchased = sum(
				sortedProfitData.filter((p) => new Date(p.purchase_date) <= new Date(sale.sell_date)),
				(p) => +p.purchased_qty_lbs || 0
			);

			// Calculate total lbs sold up to this date
			const lbsSold = sum(
				sortedSales.filter((s) => new Date(s.sell_date) <= new Date(sale.sell_date)),
				(s) => (+s.oz_sold || 0) / 16
			);

			// Calculate trend value ($18 per lb of remaining inventory)
			const trendValue = (lbsPurchased - lbsSold) * 18;

			return {
				...sale,
				trendValue
			};
		});

		// Create SVG
		const svg = select(chartContainer)
			.append('svg')
			.attr('width', '100%')
			.attr('height', height + margin.top + margin.bottom)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		// Update scales with cumulative data
		const xScale = scaleTime()
			.domain(extent(cumulativeData, (d) => new Date(d.sell_date)) as [Date, Date])
			.range([0, width]);

		const yScale = scaleLinear()
			.domain([
				0,
				Math.max(
					max(cumulativeData, (d) => d.cumulativeTotal) || 0,
					max(cumulativeData, (d) => d.cumulativeCost) || 0
				)
			])
			.range([height, 0]);

		// Create axes with white text
		const xAxis = axisBottom(xScale).tickFormat((d) => (d as Date).toLocaleDateString());
		const yAxis = axisLeft(yScale).tickFormat((d) => `$${d}`);

		// Add axes to chart with white text styling
		svg
			.append('g')
			.attr('transform', `translate(0,${height})`)
			.call(xAxis)
			.attr('color', 'white')
			.selectAll('text')
			.style('fill', 'white');

		svg.append('g').call(yAxis).attr('color', 'white').selectAll('text').style('fill', 'white');

		// Create line generators for cumulative totals
		const salesLine = line<(typeof cumulativeData)[0]>()
			.x((d) => xScale(new Date(d.sell_date)))
			.y((d) => yScale(d.cumulativeTotal))
			.curve(curveMonotoneX);

		const costLine = line<(typeof cumulativeData)[0]>()
			.x((d) => xScale(new Date(d.sell_date)))
			.y((d) => yScale(d.cumulativeCost))
			.curve(curveMonotoneX);

		// Add the cumulative cost line (red)
		svg
			.append('path')
			.datum(cumulativeData)
			.attr('fill', 'none')
			.attr('stroke', '#dc2626')
			.attr('stroke-width', 2)
			.attr('d', costLine);

		// Add the cumulative sales line (blue)
		svg
			.append('path')
			.datum(cumulativeData)
			.attr('fill', 'none')
			.attr('stroke', '#3730a3')
			.attr('stroke-width', 2)
			.attr('d', salesLine);

		// Add trend line after existing lines
		svg
			.append('path')
			.datum(trendData)
			.attr('fill', 'none')
			.attr('stroke', '#a855f7') // purple-500
			.attr('stroke-width', 2)
			.attr('stroke-dasharray', '5,5')
			.attr(
				'd',
				line<(typeof trendData)[0]>()
					.x((d) => xScale(new Date(d.sell_date)))
					.y((d) => yScale(d.trendValue))
					.curve(curveMonotoneX)
			);

		// Add trend line to legend
		const legend = svg
			.append('g')
			.attr('class', 'legend')
			.attr('transform', `translate(${width - 100}, 20)`);

		// Sales legend item
		legend
			.append('line')
			.attr('x1', 0)
			.attr('x2', 20)
			.attr('y1', 0)
			.attr('y2', 0)
			.attr('stroke', '#3730a3')
			.attr('stroke-width', 2);

		legend
			.append('text')
			.attr('x', 25)
			.attr('y', 4)
			.text('Total Sales')
			.style('fill', 'white')
			.style('font-size', '12px');

		// Cost legend item
		legend
			.append('line')
			.attr('x1', 0)
			.attr('x2', 20)
			.attr('y1', 20)
			.attr('y2', 20)
			.attr('stroke', '#dc2626')
			.attr('stroke-width', 2);

		legend
			.append('text')
			.attr('x', 25)
			.attr('y', 24)
			.text('Total Cost')
			.style('fill', 'white')
			.style('font-size', '12px');

		// Add trend line legend item
		legend
			.append('line')
			.attr('x1', 0)
			.attr('x2', 20)
			.attr('y1', 40)
			.attr('y2', 40)
			.attr('stroke', '#a855f7')
			.attr('stroke-width', 2)
			.attr('stroke-dasharray', '5,5');

		legend
			.append('text')
			.attr('x', 25)
			.attr('y', 44)
			.text('Target ($18/lb)')
			.style('fill', 'white')
			.style('font-size', '12px');

		// Add sales points
		svg
			.selectAll('.sales-point')
			.data(cumulativeData)
			.enter()
			.append('circle')
			.attr('class', 'sales-point')
			.attr('cx', (d) => xScale(new Date(d.sell_date)))
			.attr('cy', (d) => yScale(d.cumulativeTotal))
			.attr('r', 5)
			.attr('fill', '#3730a3')
			.on('mouseover', function (event, d) {
				showTooltip(event, {
					...d,
					price: d.cumulativeTotal, // Show cumulative total in tooltip
					totalCost: d.cumulativeCost // Add cumulative cost to tooltip
				});
			})
			.on('mouseout', hideTooltip);
	}

	// Helper function to calculate cost per oz for a sale
	function calculateCostPerOz(sale: SaleData) {
		const matchingProfitData = profitData.find(
			(p) => p.coffee_name === sale.coffee_name && p.purchase_date === sale.purchase_date
		);

		if (!matchingProfitData) return 0;

		const totalOz = matchingProfitData.purchased_qty_lbs * 16 + matchingProfitData.purchased_qty_oz;
		const totalCost = matchingProfitData.bean_cost + matchingProfitData.tax_ship_cost;

		return totalOz > 0 ? totalCost / totalOz : 0;
	}

	// Add tooltip helper functions
	function showTooltip(
		event: MouseEvent,
		d: SaleData & { cumulativeTotal?: number; cumulativeCost?: number }
	) {
		const tooltip = select('body')
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
				<strong>Date:</strong> ${new Date(d.sell_date).toLocaleDateString()}<br>
				<strong>Total Sales:</strong> $${d.cumulativeTotal?.toFixed(2)}<br>
				<strong>Total Cost:</strong> $${d.cumulativeCost?.toFixed(2)}<br>
				<strong>Total Profit:</strong> $${(d.cumulativeTotal! - d.cumulativeCost!).toFixed(2)}<br>
				<hr style="margin: 5px 0; border-color: #374151;">
				<strong>Sale Details:</strong><br>
				<strong>Batch:</strong> ${d.batch_name}<br>
				<strong>Coffee:</strong> ${d.coffee_name || 'N/A'}<br>
				<strong>Buyer:</strong> ${d.buyer}<br>
				<strong>Amount:</strong> ${d.oz_sold}oz
			</div>
		`
			)
			.style('left', event.pageX + 10 + 'px')
			.style('top', event.pageY - 10 + 'px');
	}

	function hideTooltip() {
		select('.tooltip').remove();
	}

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
			const items = group(profitData, (d) => d.purchase_date).get(date) || [];
			if (items.length > 0) {
				selectedCoffee = items[0].coffee_name; // Set selected coffee
				fetchSalesForCoffee(items[0].coffee_name);
			}
		}
		// Create a new Set to trigger reactivity in Svelte 5
		expandedDates = new Set(expandedDates);
	}

	function handleSelectCoffee({ coffeeName, date }: { coffeeName: string; date: string }) {
		// If coffeeName is empty, hide sales
		if (coffeeName === '') {
			selectedCoffee = null;
			salesData = [];
		} else {
			selectedCoffee = coffeeName;
			fetchSalesForCoffee(coffeeName);
		}
	}

	function handleSaleEdit(sale: SaleData) {
		selectedSale = sale;
		isFormVisible = true;
	}

	async function handleSaleDelete(id: number) {
		try {
			const response = await fetch(`/api/profit?id=${id}`, {
				method: 'DELETE'
			});

			if (response.ok) {
				if (selectedCoffee) {
					await fetchSalesForCoffee(selectedCoffee);
				}
			} else {
				alert('Failed to delete sale');
			}
		} catch (error) {
			console.error('Error deleting sale:', error);
		}
	}

	// Convert onMount to use $effect
	$effect(() => {
		const fetchData = async () => {
			await Promise.all([fetchProfitData(), fetchRoastProfileData(), fetchInitialSalesData()]);
			createSalesChart();

			// Check if we should show the sale form based on the page state
			const state = page.state as any;
			console.log('Profit page state:', state);

			if (state?.showSaleForm) {
				console.log('Should show sale form based on state flag');
				setTimeout(() => {
					showSaleForm();
				}, 100);
			}
		};

		fetchData();

		// Add event listener for the custom show-sale-form event
		window.addEventListener('show-sale-form', showSaleForm);

		const handleResize = () => {
			createSalesChart();
		};

		window.addEventListener('resize', handleResize);

		return () => {
			window.removeEventListener('resize', handleResize);
			window.removeEventListener('show-sale-form', showSaleForm);
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

	// Add function to show sale form
	function showSaleForm(selectedBean?: any) {
		console.log('showSaleForm called with bean:', selectedBean);
		isFormVisible = true;
		selectedSale = null;
		// Store the selected bean data for the form
		if (selectedBean) {
			selectedSale = {
				...(selectedSale || {}),
				defaultBean: selectedBean
			} as any;
		}
	}

	// Expose the showSaleForm function to the template
	let onAddNewSale = showSaleForm;

	// Lazy load ProfitCards component
	onMount(async () => {
		const module = await import('./ProfitCards.svelte');
		ProfitCards = module.default;
		profitCardsLoading = false;
	});

	// Ensure the data object always has the callback
	$effect(() => {
		if (data) {
			// Always ensure the callback is attached
			data.onAddNewSale = showSaleForm;
		}
	});
</script>

<!-- Add form modal -->
{#if isFormVisible}
	<div
		class="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-75 backdrop-blur-sm"
	>
		<div class="w-full max-w-2xl rounded-lg bg-background-secondary-light p-6 shadow-2xl">
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

<div class="space-y-6">
	<!-- Header Section -->
	<div class="mb-6">
		<h1 class="text-primary-light mb-2 text-2xl font-bold">Coffee Sales & Profit</h1>
		<p class="text-text-secondary-light">Track your coffee sales performance and profitability</p>
	</div>

	<!-- KPI Cards Grid -->
	<div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<!-- Primary Metrics -->
		<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
			<h3 class="text-sm font-medium text-text-primary-light">Total Revenue</h3>
			<p class="mt-1 text-2xl font-bold text-green-500">${totalRevenue.toFixed(2)}</p>
			<p class="mt-1 text-xs text-text-secondary-light">From all coffee sales</p>
		</div>

		<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
			<h3 class="text-sm font-medium text-text-primary-light">Total Profit</h3>
			<p class="mt-1 text-2xl font-bold text-blue-500">${totalProfit.toFixed(2)}</p>
			<p class="mt-1 text-xs text-text-secondary-light">Net profit after costs</p>
		</div>

		<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
			<h3 class="text-sm font-medium text-text-primary-light">Average Margin</h3>
			<p class="mt-1 text-2xl font-bold text-purple-500">{averageMargin().toFixed(1)}%</p>
			<p class="mt-1 text-xs text-text-secondary-light">Weighted by sales volume</p>
		</div>

		<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
			<h3 class="text-sm font-medium text-text-primary-light">Sell-Through Rate</h3>
			<p class="mt-1 text-2xl font-bold text-orange-500">{sellThroughRate().toFixed(1)}%</p>
			<p class="mt-1 text-xs text-text-secondary-light">Inventory sold vs purchased</p>
		</div>
	</div>

	<!-- Secondary Metrics -->
	<div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
		<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
			<h3 class="text-sm font-medium text-text-primary-light">Total Investment</h3>
			<p class="mt-1 text-2xl font-bold text-red-500">${totalCost.toFixed(2)}</p>
			<p class="mt-1 text-xs text-text-secondary-light">Bean cost + shipping & tax</p>
		</div>

		<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
			<h3 class="text-sm font-medium text-text-primary-light">Coffee Purchased</h3>
			<p class="mt-1 text-2xl font-bold text-indigo-500">{totalPoundsRoasted.toFixed(1)} lbs</p>
			<p class="mt-1 text-xs text-text-secondary-light">Total green coffee inventory</p>
		</div>

		<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
			<h3 class="text-sm font-medium text-text-primary-light">Roast Loss Rate</h3>
			<p class="mt-1 text-2xl font-bold text-cyan-500">{roastLossRate().toFixed(1)}%</p>
			<p class="mt-1 text-xs text-text-secondary-light">Weight loss during roasting</p>
		</div>
	</div>

	<!-- Performance Chart -->
	<div class="mb-8 rounded-lg bg-background-secondary-light p-6 ring-1 ring-border-light">
		<div class="mb-4">
			<h3 class="text-lg font-semibold text-text-primary-light">Sales Performance Over Time</h3>
			<p class="text-sm text-text-secondary-light">
				Cumulative revenue, costs, and target performance
			</p>
		</div>
		<div bind:this={chartContainer} class="w-full"></div>
	</div>

	<!-- Coffee Sales Analysis -->
	<div class="space-y-4">
		<div class="flex items-center justify-between">
			<div>
				<h2 class="text-xl font-semibold text-text-primary-light">Coffee Sales Analysis</h2>
				<p class="text-sm text-text-secondary-light">
					Detailed breakdown by purchase date and coffee
				</p>
			</div>
			<button
				type="button"
				class="rounded-md bg-background-tertiary-light px-4 py-2 font-medium text-white transition-all duration-200 hover:bg-opacity-90"
				onclick={showSaleForm}
			>
				Add New Sale
			</button>
		</div>

		{#if profitCardsLoading}
			<div
				class="flex items-center justify-center rounded-lg bg-background-secondary-light p-8 ring-1 ring-border-light"
			>
				<div
					class="h-8 w-8 animate-spin rounded-full border-2 border-background-tertiary-light border-t-transparent"
				></div>
				<span class="ml-3 text-sm text-text-secondary-light">Loading profit analysis...</span>
			</div>
		{:else if ProfitCards}
			<ProfitCards
				{profitData}
				{salesData}
				{expandedDates}
				{selectedCoffee}
				onToggleDate={toggleDate}
				onSelectCoffee={handleSelectCoffee}
				onEditSale={handleSaleEdit}
				onDeleteSale={handleSaleDelete}
				onAddSale={showSaleForm}
			/>
		{:else}
			<div
				class="rounded-lg bg-background-secondary-light p-8 text-center ring-1 ring-border-light"
			>
				<div class="mb-4 text-6xl opacity-50">📊</div>
				<h3 class="mb-2 text-lg font-semibold text-text-primary-light">No Sales Data Yet</h3>
				<p class="mb-4 text-text-secondary-light">
					Start tracking your coffee sales to see detailed profit analysis.
				</p>
				<button
					type="button"
					class="rounded-md bg-background-tertiary-light px-4 py-2 font-medium text-white transition-all duration-200 hover:bg-opacity-90"
					onclick={showSaleForm}
				>
					Record Your First Sale
				</button>
			</div>
		{/if}
	</div>
</div>
