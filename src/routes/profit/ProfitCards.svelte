<script lang="ts">
	import { formatDateForDisplay } from '$lib/utils/dates';
	import { group } from 'd3';

	// Define interfaces for type safety
	interface ProfitData {
		id: number;
		purchase_date: string;
		coffee_name: string;
		purchased_qty_lbs: number;
		purchased_qty_oz: number;
		bean_cost: number;
		tax_ship_cost: number;
		total_sales: number;
		oz_sold: number;
		oz_in: number;
		oz_out: number;
		profit: number;
		profit_margin: number;
	}

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

	// Component props using $props() with callback functions instead of event dispatching
	let {
		profitData = [],
		salesData = [],
		expandedDates,
		selectedCoffee,
		onToggleDate = (date: string) => {},
		onSelectCoffee = (data: { coffeeName: string; date: string }) => {},
		onEditSale = (sale: SaleData) => {},
		onDeleteSale = (id: number) => {},
		onAddSale = () => {}
	} = $props<{
		profitData: ProfitData[];
		salesData: SaleData[];
		expandedDates: Set<string>;
		selectedCoffee: string | null;
		onToggleDate?: (date: string) => void;
		onSelectCoffee?: (data: { coffeeName: string; date: string }) => void;
		onEditSale?: (sale: SaleData) => void;
		onDeleteSale?: (id: number) => void;
		onAddSale?: () => void;
	}>();

	// Group profit data by purchase date - using $derived instead of $:
	let groupedProfitData = $derived(group(profitData, (d: ProfitData) => d.purchase_date));

	// Sort sales data
	let sortField: string | null = $state('sell_date');
	let sortDirection: 'asc' | 'desc' | null = $state('desc');

	function toggleSort(field: string) {
		if (sortField === field) {
			if (sortDirection === 'asc') sortDirection = 'desc';
			else if (sortDirection === 'desc') {
				sortField = null;
				sortDirection = null;
			}
		} else {
			sortField = field;
			sortDirection = 'asc';
		}
	}

	// Use $derived instead of $: for reactive statements
	let sortedSales = $derived(
		[...salesData].sort((a, b) => {
			if (!sortField) return 0;

			const aVal = a[sortField as keyof SaleData];
			const bVal = b[sortField as keyof SaleData];

			if (sortField === 'sell_date' || sortField === 'purchase_date') {
				const aDate = new Date(aVal as string);
				const bDate = new Date(bVal as string);
				return sortDirection === 'asc'
					? aDate.getTime() - bDate.getTime()
					: bDate.getTime() - aDate.getTime();
			}

			if (typeof aVal === 'string' && typeof bVal === 'string') {
				return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
			}

			return sortDirection === 'asc' ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
		})
	);

	// Event handlers that call the callback props
	function handleToggleDate(date: string) {
		onToggleDate(date);
		console.log('handleToggleDate', date);
	}

	function handleSelectCoffee(coffeeName: string, date: string) {
		onSelectCoffee({ coffeeName, date });
	}

	function handleEditSale(sale: SaleData) {
		onEditSale(sale);
	}

	function handleDeleteSale(id: number) {
		onDeleteSale(id);
	}

	function handleAddSale() {
		onAddSale();
	}
</script>

<div class="flex flex-col gap-4">
	{#if !groupedProfitData || groupedProfitData.size === 0}
		<p class="p-4 text-text-primary-light">No profit data available</p>
	{:else}
		<div class="space-y-4">
			{#each [...groupedProfitData] as [date, items]}
				<!-- Purchase Date Group Card -->
				<div class="rounded-lg bg-background-tertiary-light p-4 shadow-md">
					<button
						type="button"
						class="flex w-full items-center justify-between"
						onclick={() => handleToggleDate(date)}
					>
						<h3 class="text-primary-light text-lg font-semibold">
							{expandedDates.has(date) ? '▼' : '▶'}
							{formatDateForDisplay(date)}
						</h3>
						<div class="text-primary-light text-sm">
							<span class="mr-4">{items.length} items</span>
							<span class="mr-4">
								Total Cost: ${items
									.reduce(
										(sum: number, item: ProfitData) =>
											sum + Number(item.bean_cost) + Number(item.tax_ship_cost),
										0
									)
									.toFixed(2)}
							</span>
							<span class="mr-4">
								Total Sales: ${items
									.reduce((sum: number, item: ProfitData) => sum + Number(item.total_sales), 0)
									.toFixed(2)}
							</span>
							<span class="mr-4">
								Total Profit: ${items
									.reduce((sum: number, item: ProfitData) => sum + Number(item.profit), 0)
									.toFixed(2)}
							</span>
							<span>
								Avg Margin: {(
									items.reduce(
										(sum: number, item: ProfitData) => sum + Number(item.profit_margin),
										0
									) / items.length
								).toFixed(1)}%
							</span>
						</div>
					</button>

					{#if expandedDates.has(date)}
						<div class="mt-4 space-y-2">
							{#each items as item}
								<!-- Individual Coffee Item -->
								<button
									type="button"
									class="w-full cursor-pointer rounded-lg bg-background-secondary-light p-3 text-left transition-colors hover:bg-background-tertiary-light {selectedCoffee ===
									item.coffee_name
										? 'bg-background-tertiary-light'
										: ''}"
									onclick={() => handleSelectCoffee(item.coffee_name, date)}
								>
									<div class="flex flex-col gap-2 sm:flex-row sm:justify-between">
										<div>
											<h4 class="text-primary-light text-base font-semibold">
												{item.coffee_name}
											</h4>
											<p class="text-primary-light text-sm">
												Qty: {item.purchased_qty_lbs.toFixed(2)} lbs
											</p>
										</div>
										<div class="text-left text-sm text-text-primary-light sm:text-right">
											<div class="flex flex-col gap-1 sm:items-end">
												<span
													>Cost: ${(Number(item.bean_cost) + Number(item.tax_ship_cost)).toFixed(
														2
													)}</span
												>
												<span>Sales: ${Number(item.total_sales).toFixed(2)}</span>
												<span>Profit: ${Number(item.profit).toFixed(2)}</span>
												<span>Margin: {Number(item.profit_margin).toFixed(1)}%</span>
											</div>
										</div>
									</div>
								</button>

								<!-- Sales Table for Selected Coffee -->
								{#if selectedCoffee === item.coffee_name}
									<div class="mt-2 rounded-lg bg-background-primary-light p-4">
										<div class="mb-4 flex items-center justify-between">
											<h4 class="text-primary-light text-lg font-semibold">
												Sales for {item.coffee_name}
											</h4>
											<button
												type="button"
												class="rounded bg-green-600 px-3 py-1 text-sm text-white"
												onclick={handleAddSale}
											>
												Add Sale
											</button>
										</div>

										{#if sortedSales.length === 0}
											<p class="p-2 text-text-primary-light">No sales data available</p>
										{:else}
											<div class="overflow-x-auto">
												<table class="w-full table-auto">
													<thead
														class="text-primary-light bg-background-tertiary-light text-xs uppercase"
													>
														<tr>
															<th
																class="group cursor-pointer px-4 py-2 hover:bg-background-primary-light"
																onclick={() => toggleSort('sell_date')}
															>
																<div class="flex items-center gap-2">
																	Sell Date
																	{#if sortField === 'sell_date'}
																		{#if sortDirection === 'asc'}
																			<span>↑</span>
																		{:else if sortDirection === 'desc'}
																			<span>↓</span>
																		{/if}
																	{:else}
																		<span class="opacity-0 group-hover:opacity-50">↕</span>
																	{/if}
																</div>
															</th>
															<th
																class="group cursor-pointer px-4 py-2 hover:bg-background-primary-light"
																onclick={() => toggleSort('batch_name')}
															>
																<div class="flex items-center gap-2">
																	Batch
																	{#if sortField === 'batch_name'}
																		{#if sortDirection === 'asc'}
																			<span>↑</span>
																		{:else if sortDirection === 'desc'}
																			<span>↓</span>
																		{/if}
																	{:else}
																		<span class="opacity-0 group-hover:opacity-50">↕</span>
																	{/if}
																</div>
															</th>
															<th
																class="group cursor-pointer px-4 py-2 hover:bg-background-primary-light"
																onclick={() => toggleSort('buyer')}
															>
																<div class="flex items-center gap-2">
																	Buyer
																	{#if sortField === 'buyer'}
																		{#if sortDirection === 'asc'}
																			<span>↑</span>
																		{:else if sortDirection === 'desc'}
																			<span>↓</span>
																		{/if}
																	{:else}
																		<span class="opacity-0 group-hover:opacity-50">↕</span>
																	{/if}
																</div>
															</th>
															<th
																class="group cursor-pointer px-4 py-2 hover:bg-background-primary-light"
																onclick={() => toggleSort('oz_sold')}
															>
																<div class="flex items-center gap-2">
																	Amount (oz)
																	{#if sortField === 'oz_sold'}
																		{#if sortDirection === 'asc'}
																			<span>↑</span>
																		{:else if sortDirection === 'desc'}
																			<span>↓</span>
																		{/if}
																	{:else}
																		<span class="opacity-0 group-hover:opacity-50">↕</span>
																	{/if}
																</div>
															</th>
															<th
																class="group cursor-pointer px-4 py-2 hover:bg-background-primary-light"
																onclick={() => toggleSort('price')}
															>
																<div class="flex items-center gap-2">
																	Price
																	{#if sortField === 'price'}
																		{#if sortDirection === 'asc'}
																			<span>↑</span>
																		{:else if sortDirection === 'desc'}
																			<span>↓</span>
																		{/if}
																	{:else}
																		<span class="opacity-0 group-hover:opacity-50">↕</span>
																	{/if}
																</div>
															</th>
															<th class="px-4 py-2">Actions</th>
														</tr>
													</thead>
													<tbody>
														{#each sortedSales.filter((sale) => sale.coffee_name === item.coffee_name) as sale}
															<tr
																class="border-b border-background-tertiary-light bg-background-secondary-light transition-colors hover:bg-background-tertiary-light"
															>
																<td
																	class="whitespace-nowrap px-4 py-2 text-xs text-text-primary-light"
																>
																	{formatDateForDisplay(sale.sell_date)}
																</td>
																<td
																	class="whitespace-nowrap px-4 py-2 text-xs text-text-primary-light"
																>
																	{sale.batch_name}
																</td>
																<td
																	class="whitespace-nowrap px-4 py-2 text-xs text-text-primary-light"
																>
																	{sale.buyer}
																</td>
																<td
																	class="whitespace-nowrap px-4 py-2 text-xs text-text-primary-light"
																>
																	{sale.oz_sold}
																</td>
																<td
																	class="whitespace-nowrap px-4 py-2 text-xs text-text-primary-light"
																>
																	${sale.price}
																</td>
																<td
																	class="whitespace-nowrap px-4 py-2 text-xs text-text-primary-light"
																>
																	<div class="flex gap-2">
																		<button
																			class="rounded border border-blue-800 px-2 py-1 hover:bg-blue-900"
																			onclick={() => handleEditSale(sale)}
																		>
																			Edit
																		</button>
																		<button
																			class="rounded border border-red-800 px-2 py-1 hover:bg-red-900"
																			onclick={() => handleDeleteSale(sale.id)}
																		>
																			Delete
																		</button>
																	</div>
																</td>
															</tr>
														{/each}
													</tbody>
												</table>
											</div>
										{/if}
									</div>
								{/if}
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
