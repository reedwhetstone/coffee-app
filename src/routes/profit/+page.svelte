<script lang="ts">
	import SaleForm from './SaleForm.svelte';
	import FormShell from '$lib/components/FormShell.svelte';
	import PerformanceChart from './PerformanceChart.svelte';
	import SalesChart from './SalesChart.svelte';
	import ProfitPageSkeleton from '$lib/components/ProfitPageSkeleton.svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
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
		wholesale?: boolean;
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
		wholesale?: boolean;
	}

	// Convert state variables to use $state
	let profitData = $state<ProfitData[]>([]);
	// Removed unused roastProfileData
	let salesData = $state<SaleData[]>([]);
	let isFormVisible = $derived(page.url.searchParams.get('modal') === 'new');
	let selectedSale = $state<SaleData | null>(null);
	let isSaving = $state<string | null>(null);

	// Form data state
	let availableCoffees = $state<AvailableCoffee[]>([]);
	let availableBatches = $state<BatchItem[]>([]);

	// Convert reactive statements to use $derived
	// Removed unused derived values (totalRevenue, totalCost, totalProfit)

	// Removed unused derived values (averageMargin, totalPoundsRoasted, sellThroughRate, roastLossRate)

	// Add sales form handlers
	// SaleForm submits to the API, then waits for the parent refresh before closing the modal.
	async function handleFormSubmit(_data: unknown) {
		isSaving = 'Refreshing data...';
		try {
			await fetchInitialSalesData();
			hideForm();
			selectedSale = null;
		} catch (error) {
			console.error('Error refreshing sales data:', error);
			throw new Error(
				error instanceof Error ? error.message : 'Failed to refresh profit data after saving sale'
			);
		} finally {
			isSaving = null;
		}
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
			await fetchInitialSalesData();
			await fetchFormData();
		};

		fetchData();
	});

	// Removed unused fetchProfitData

	// Removed fetchRoastProfileData

	async function fetchInitialSalesData() {
		const response = await fetch('/api/profit');

		if (!response.ok) {
			throw new Error(`Failed to refresh profit data (${response.status})`);
		}

		const data = await response.json();
		salesData = data.sales || [];
		profitData = data.profit || [];
	}

	function hideForm() {
		const url = new URL(page.url);
		url.searchParams.delete('modal');
		const search = url.searchParams.toString();
		goto(url.pathname + (search ? '?' + search : ''), {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	}
</script>

<!-- Saving Operation Status -->
{#if isSaving}
	<div class="fixed right-4 top-4 z-50 rounded-lg bg-blue-50 p-4 ring-1 ring-blue-200">
		<div class="flex items-center">
			<div
				class="mr-3 h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
			></div>
			<span class="text-sm font-medium text-blue-900">{isSaving}</span>
		</div>
	</div>
{/if}

<!-- Add form modal -->
<FormShell visible={isFormVisible}>
	<SaleForm
		sale={selectedSale as unknown as Record<string, unknown> | undefined}
		{availableCoffees}
		{availableBatches}
		onClose={() => {
			hideForm();
			selectedSale = null;
		}}
		onSubmit={handleFormSubmit}
	/>
</FormShell>

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
