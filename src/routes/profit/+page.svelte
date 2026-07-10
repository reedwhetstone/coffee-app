<script lang="ts">
	import SaleForm from './SaleForm.svelte';
	import FormShell from '$lib/components/FormShell.svelte';
	import PerformanceChart from './PerformanceChart.svelte';
	import SalesChart from './SalesChart.svelte';
	import ProfitPageSkeleton from '$lib/components/ProfitPageSkeleton.svelte';
	import MetricTile from '$lib/components/ui/MetricTile.svelte';
	import OperationsHero from '$lib/components/ui/OperationsHero.svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { canUseMallardControls } from '$lib/services/portfolioAccess';
	import type { UserRole } from '$lib/types/auth.types';
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
	let isLoading = $state(true);
	let loadError = $state<string | null>(null);
	let { data = { role: 'viewer' } } = $props<{ data?: { role?: UserRole } }>();
	let canLogSales = $derived(canUseMallardControls(data?.role ?? 'viewer'));
	let isFormVisible = $derived(canLogSales && page.url.searchParams.get('modal') === 'new');
	let selectedSale = $state<SaleData | null>(null);
	let isSaving = $state<string | null>(null);

	// Form data state
	let availableCoffees = $state<AvailableCoffee[]>([]);
	let availableBatches = $state<BatchItem[]>([]);

	// Convert reactive statements to use $derived
	// Removed unused derived values (totalRevenue, totalCost, totalProfit)

	// Removed unused derived values (averageMargin, totalPoundsRoasted, sellThroughRate, roastLossRate)
	const formatCurrency = (value: number) =>
		`$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
	const formatPercent = (value: number) => `${value.toFixed(1)}%`;
	const profitSummary = $derived.by(() => {
		const revenue = salesData.reduce((sum, sale) => sum + (Number(sale.price) || 0), 0);
		const invested = profitData.reduce(
			(sum, row) => sum + (Number(row.bean_cost) || 0) + (Number(row.tax_ship_cost) || 0),
			0
		);
		const profit = revenue - invested;
		const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
		const soldCoffeeIds = new Set(salesData.map((sale) => sale.green_coffee_inv_id));
		const poundsIn = profitData
			.filter((row) => soldCoffeeIds.has(row.id))
			.reduce((sum, row) => sum + (Number(row.purchased_qty_lbs) || 0), 0);

		return {
			revenue,
			invested,
			profit,
			margin,
			poundsIn,
			salesCount: salesData.length
		};
	});

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
			try {
				await Promise.all([fetchInitialSalesData(), fetchFormData()]);
			} catch (error) {
				console.error('Error loading profit data:', error);
				loadError = error instanceof Error ? error.message : 'Failed to load profit data';
			} finally {
				isLoading = false;
			}
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

	async function retryInitialLoad() {
		isLoading = true;
		loadError = null;
		try {
			await fetchInitialSalesData();
		} catch (error) {
			console.error('Error retrying profit data:', error);
			loadError = error instanceof Error ? error.message : 'Failed to load profit data';
		} finally {
			isLoading = false;
		}
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
	<div class="fixed right-4 top-4 z-50 rounded-lg bg-info-subtle p-4 ring-1 ring-info/30">
		<div class="flex items-center">
			<div
				class="mr-3 h-4 w-4 animate-spin rounded-full border-2 border-info border-t-transparent"
			></div>
			<span class="text-sm font-medium text-info-strong">{isSaving}</span>
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

<!-- Mounted-page states; client navigation shells are handled by the root layout. -->
{#if isLoading}
	<ProfitPageSkeleton />
{:else if loadError}
	<div class="rounded-lg bg-danger-subtle p-8 text-center ring-1 ring-danger/30">
		<h2 class="text-xl font-semibold text-danger-strong">Profit data could not be loaded</h2>
		<p class="mx-auto mt-2 max-w-xl text-danger">{loadError}</p>
		<button
			type="button"
			onclick={retryInitialLoad}
			class="mt-5 rounded-md bg-danger px-4 py-2 font-medium text-white transition-colors hover:bg-danger-strong"
		>
			Try again
		</button>
	</div>
{:else if profitData.length === 0 && salesData.length === 0}
	<div class="rounded-lg bg-surface-panel p-8 text-center ring-1 ring-line">
		<h2 class="text-xl font-semibold text-ink">No profit activity yet</h2>
		<p class="mx-auto mt-2 max-w-xl text-muted">
			Profit and margin insights will appear after purchased coffee and sales are recorded.
		</p>
		<div class="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
			<a
				href="/beans"
				class="rounded-md border border-accent px-4 py-2 font-medium text-accent transition-colors hover:bg-accent hover:text-ink"
			>
				Review portfolio
			</a>
			{#if canLogSales}
				<a
					href="/profit?modal=new"
					class="rounded-md bg-accent px-4 py-2 font-medium text-ink transition-colors hover:bg-accent/80"
				>
					Log first sale
				</a>
			{/if}
		</div>
	</div>
{:else}
	<div class="space-y-6">
		<OperationsHero
			kicker="Mallard Studio"
			title="Profit cockpit"
			description="Track coffee sales as an operating loop: inventory investment, sell-through, margin, and the lots creating or consuming cash."
			contextLabel="Current margin"
			contextValue={formatPercent(profitSummary.margin)}
			primaryLabel={canLogSales ? 'Log sale' : ''}
			primaryHref={canLogSales ? '/profit?modal=new' : ''}
			secondaryLabel="Review portfolio"
			secondaryHref="/beans"
		/>

		<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
			<MetricTile
				label="Revenue"
				value={formatCurrency(profitSummary.revenue)}
				detail={`${profitSummary.salesCount} recorded sales`}
				tone="success"
			/>
			<MetricTile
				label="Profit"
				value={formatCurrency(profitSummary.profit)}
				detail={`${formatCurrency(profitSummary.invested)} invested`}
				tone={profitSummary.profit >= 0 ? 'accent' : 'danger'}
			/>
			<MetricTile
				label="Coffee in play"
				value={`${profitSummary.poundsIn.toFixed(1)} lb`}
				detail="Purchased green coffee attached to recorded sales"
			/>
			<MetricTile
				label="Margin"
				value={formatPercent(profitSummary.margin)}
				detail="Revenue after recorded bean, tax, and shipping cost"
				tone={profitSummary.margin >= 20 ? 'success' : 'warning'}
			/>
		</div>

		<!-- Coffee Sales Analysis Chart -->
		<SalesChart {profitData} {salesData} />

		<!-- Performance Chart Component -->
		<PerformanceChart {salesData} {profitData} />
	</div>
{/if}
