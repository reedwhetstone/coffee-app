<script lang="ts">
	import SaleForm from './SaleForm.svelte';
	import PerformanceChart from './PerformanceChart.svelte';
	import SalesChart from './SalesChart.svelte';
	import ProfitPageSkeleton from '$lib/components/ProfitPageSkeleton.svelte';
	import { page } from '$app/state';
	import type { PageData } from './$types';
	import type { AvailableCoffee, BatchItem } from '$lib/types/component.types';

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
	// Removed unused roastProfileData
	let salesData = $state<SaleData[]>([]);
	let isFormVisible = $state(false);
	let selectedSale = $state<SaleData | null>(null);

	// Form data state
	let availableCoffees = $state<AvailableCoffee[]>([]);
	let availableBatches = $state<BatchItem[]>([]);

	let { data } = $props<{ data: PageData }>();

	// Convert reactive statements to use $derived
	// Removed unused derived values (totalRevenue, totalCost, totalProfit)

	// Removed unused derived values (averageMargin, totalPoundsRoasted, sellThroughRate, roastLossRate)

	// Add sales form handlers
	async function handleFormSubmit(data: unknown) {
		const saleData = data as SaleData;
		// Keeping simple since form just passes object
		try {
			const isUpdate = selectedSale?.id !== undefined && selectedSale?.id !== null;
			const response = await fetch(
				`/api/profit${isUpdate && selectedSale ? `?id=${selectedSale.id}` : ''}`,
				{
					method: isUpdate ? 'PUT' : 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(saleData)
				}
			);

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

	// Removed unused fetchSalesForCoffee

	// Function to fetch available coffees for sale form
	async function fetchAvailableCoffees() {
		try {
			const response = await fetch('/api/beans');
			if (response.ok) {
				const result = await response.json();
				// Filter for stocked coffees only
				const stockedCoffees = (result.data || []).filter(
					(coffee: AvailableCoffee) => coffee.stocked === true
				);
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
		// formDataLoading = true;
		try {
			await Promise.all([fetchAvailableCoffees(), fetchAvailableBatches()]);
		} finally {
			// formDataLoading = false;
		}
	}

	// Convert onMount to use $effect
	$effect(() => {
		const fetchData = async () => {
			await Promise.all([fetchInitialSalesData(), fetchFormData()]);

			// Check if we should show the sale form based on the page state
			const state = page.state as Record<string, unknown>;
			if (state?.showSaleForm) {
				setTimeout(() => {
					showSaleForm();
				}, 100);
			}
		};

		fetchData();

		// Add event listener for the custom show-sale-form event
		const handleShowSaleForm = (e: Event) => {
			const customEvent = e as CustomEvent;
			showSaleForm(customEvent.detail);
		};

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		window.addEventListener('show-sale-form', handleShowSaleForm as any);

		return () => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			window.removeEventListener('show-sale-form', handleShowSaleForm as any);
		};
	});

	// Removed unused fetchProfitData

	// Removed fetchRoastProfileData

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
	function showSaleForm(selectedBean?: AvailableCoffee) {
		isFormVisible = true;
		selectedSale = null;
		// Store the selected bean data for the form
		if (selectedBean) {
			selectedSale = {
				...(selectedSale || {}),
				defaultBean: selectedBean
			} as unknown as SaleData;
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
				sale={selectedSale as unknown as Record<string, unknown> | undefined}
				{availableCoffees}
				{availableBatches}
				onClose={() => {
					isFormVisible = false;
					selectedSale = null;
				}}
				onSubmit={handleFormSubmit}
			/>
		</div>
	</div>
{/if}

<!-- Show instant skeleton only briefly while data loads -->
{#if profitData.length === 0 && salesData.length === 0}
	<ProfitPageSkeleton />
{:else}
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
{/if}
