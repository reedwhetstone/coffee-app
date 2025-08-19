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
		weight_loss_percent: number | null;
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

	// Form data state
	let availableCoffees = $state<any[]>([]);
	let availableBatches = $state<any[]>([]);
	let formDataLoading = $state(false);

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
		// Filter roasts that have weight loss percentage data
		const roastsWithLossData = roastProfileData.filter(
			(d) => d.weight_loss_percent !== null && d.weight_loss_percent !== undefined
		);

		if (roastsWithLossData.length === 0) return 0;

		// Calculate weighted average weight loss percentage based on input weight
		const totalWeightedLoss = sum(
			roastsWithLossData,
			(d) => d.weight_loss_percent! * (Number(d.oz_in) || 0)
		);
		const totalOzIn = sum(roastsWithLossData, (d) => Number(d.oz_in) || 0);

		return totalOzIn > 0 ? totalWeightedLoss / totalOzIn : 0;
	});

	// Add sales form handlers
	async function handleFormSubmit(saleData: any) {
		try {
			const isUpdate = selectedSale?.id !== undefined && selectedSale?.id !== null;
			const response = await fetch(`/api/profit${isUpdate && selectedSale ? `?id=${selectedSale.id}` : ''}`, {
				method: isUpdate ? 'PUT' : 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(saleData)
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || `Failed to ${isUpdate ? 'update' : 'create'} sale`);
			}

			// Refresh all profit and sales data
			await fetchInitialSalesData();
		} catch (error) {
			console.error('Error updating sales data:', error);
			alert(`Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
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

	// Function to fetch available coffees for sale form
	async function fetchAvailableCoffees() {
		try {
			const response = await fetch('/api/beans');
			if (response.ok) {
				const result = await response.json();
				// Filter for stocked coffees only
				const stockedCoffees = (result.data || []).filter((coffee: any) => coffee.stocked === true);
				availableCoffees = stockedCoffees;
			} else {
				console.error('Failed to fetch available coffees');
				availableCoffees = [];
			}
		} catch (error) {
			console.error('Error fetching available coffees:', error);
			availableCoffees = [];
		}
	}

	// Function to fetch available batches (roast profiles) for sale form
	async function fetchAvailableBatches() {
		try {
			const response = await fetch('/api/roast-profiles');
			if (response.ok) {
				const result = await response.json();
				// Get roast profiles with coffee relationships for batch selection
				availableBatches = result.data || [];
			} else {
				console.error('Failed to fetch available batches');
				availableBatches = [];
			}
		} catch (error) {
			console.error('Error fetching available batches:', error);
			availableBatches = [];
		}
	}

	// Function to fetch form data (coffees and batches)
	async function fetchFormData() {
		formDataLoading = true;
		try {
			await Promise.all([fetchAvailableCoffees(), fetchAvailableBatches()]);
		} finally {
			formDataLoading = false;
		}
	}

	// Convert onMount to use $effect
	$effect(() => {
		const fetchData = async () => {
			await Promise.all([fetchInitialSalesData(), fetchRoastProfileData(), fetchFormData()]);

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
					(profile: RoastProfileData) =>
						profile.oz_in != null && profile.oz_out != null && profile.weight_loss_percent != null
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
				{availableCoffees}
				{availableBatches}
				catalogBeans={data?.catalogData || []}
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

	<!-- Coffee Sales Analysis Chart -->
	<SalesChart {profitData} {salesData} />

	<!-- Performance Chart Component -->
	<PerformanceChart {salesData} {profitData} />
</div>
