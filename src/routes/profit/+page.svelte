<script lang="ts">
	import { sum, group } from 'd3';
	import { onMount } from 'svelte';
	import SaleForm from './SaleForm.svelte';
	import PerformanceChart from './PerformanceChart.svelte';
	import SalesChart from './SalesChart.svelte';
	import { page } from '$app/state';
	import type { PageData } from './$types';

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
	let salesData = $state<SaleData[]>([]);
	let isFormVisible = $state(false);
	let selectedSale = $state<SaleData | null>(null);

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
			}
		} catch (error) {
			console.error('Error fetching sales data:', error);
		}
	}

	// Convert onMount to use $effect
	$effect(() => {
		const fetchData = async () => {
			await Promise.all([fetchProfitData(), fetchRoastProfileData(), fetchInitialSalesData()]);

			// Check if we should show the sale form based on the page state
			const state = page.state as any;
			if (state?.showSaleForm) {
				setTimeout(() => {
					showSaleForm();
				}, 100);
			}
		};

		fetchData();

		// Add event listener for the custom show-sale-form event
		window.addEventListener('show-sale-form', showSaleForm);

		return () => {
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

	<!-- Performance Chart Component -->
	<PerformanceChart {salesData} {profitData} />

	<!-- Coffee Sales Analysis -->
	<div class="space-y-4">
		<div class="flex items-center justify-between">
			<div>
				<h2 class="text-xl font-semibold text-text-primary-light">Coffee Sales Analysis</h2>
				<p class="text-sm text-text-secondary-light">
					Interactive visual analysis with comprehensive filtering and metrics
				</p>
			</div>
			<button
				type="button"
				class="rounded-md bg-background-tertiary-light px-4 py-2 font-medium text-white transition-all duration-200 hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-background-tertiary-light focus:ring-offset-2"
				onclick={showSaleForm}
			>
				Add New Sale
			</button>
		</div>

		<SalesChart {profitData} {salesData} />
	</div>
</div>
