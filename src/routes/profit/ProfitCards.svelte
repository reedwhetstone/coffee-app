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
		onAddSale = (bean?: ProfitData) => {}
	} = $props<{
		profitData: ProfitData[];
		salesData: SaleData[];
		expandedDates: Set<string>;
		selectedCoffee: string | null;
		onToggleDate?: (date: string) => void;
		onSelectCoffee?: (data: { coffeeName: string; date: string }) => void;
		onEditSale?: (sale: SaleData) => void;
		onDeleteSale?: (id: number) => void;
		onAddSale?: (bean?: ProfitData) => void;
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
		// If the same coffee is already selected, hide sales by clearing the selection
		if (selectedCoffee === coffeeName) {
			onSelectCoffee({ coffeeName: '', date });
		} else {
			onSelectCoffee({ coffeeName, date });
		}
	}

	function handleEditSale(sale: SaleData) {
		onEditSale(sale);
	}

	function handleDeleteSale(id: number) {
		onDeleteSale(id);
	}

	function handleAddSale(bean?: ProfitData) {
		onAddSale(bean);
	}
</script>

<div class="space-y-4">
	{#if !groupedProfitData || groupedProfitData.size === 0}
		<div class="rounded-lg bg-background-secondary-light p-8 text-center ring-1 ring-border-light">
			<div class="mb-4 text-6xl opacity-50">☕</div>
			<h3 class="mb-2 text-lg font-semibold text-text-primary-light">No Coffee Purchases Yet</h3>
			<p class="text-text-secondary-light">
				Add coffee beans to your inventory to start tracking sales and profit.
			</p>
		</div>
	{:else}
		<div class="space-y-4">
			{#each [...groupedProfitData] as [date, items]}
				<!-- Purchase Date Group Card -->
				<div class="rounded-lg bg-background-secondary-light ring-1 ring-border-light">
					<button
						type="button"
						class="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-background-primary-light"
						onclick={() => handleToggleDate(date)}
					>
						<div class="flex items-center gap-3">
							<div class="text-text-primary-light">
								{expandedDates.has(date) ? '▼' : '▶'}
							</div>
							<div>
								<h3 class="text-lg font-semibold text-text-primary-light">
									{formatDateForDisplay(date)}
								</h3>
								<p class="text-sm text-text-secondary-light">
									{items.length} coffee{items.length !== 1 ? 's' : ''} purchased
								</p>
							</div>
						</div>
						<div class="hidden text-right sm:block">
							<div class="grid grid-cols-4 gap-6 text-sm">
								<div>
									<p class="text-text-secondary-light">Investment</p>
									<p class="font-semibold text-red-500">
										${items
											.reduce(
												(sum: number, item: ProfitData) =>
													sum + Number(item.bean_cost) + Number(item.tax_ship_cost),
												0
											)
											.toFixed(2)}
									</p>
								</div>
								<div>
									<p class="text-text-secondary-light">Revenue</p>
									<p class="font-semibold text-green-500">
										${items
											.reduce((sum: number, item: ProfitData) => sum + Number(item.total_sales), 0)
											.toFixed(2)}
									</p>
								</div>
								<div>
									<p class="text-text-secondary-light">Profit</p>
									<p class="font-semibold text-blue-500">
										${items
											.reduce((sum: number, item: ProfitData) => sum + Number(item.profit), 0)
											.toFixed(2)}
									</p>
								</div>
								<div>
									<p class="text-text-secondary-light">Avg Margin</p>
									<p class="font-semibold text-purple-500">
										{(
											items.reduce(
												(sum: number, item: ProfitData) => sum + Number(item.profit_margin),
												0
											) / items.length
										).toFixed(1)}%
									</p>
								</div>
							</div>
						</div>
					</button>

					{#if expandedDates.has(date)}
						<div class="border-t border-border-light bg-background-primary-light p-4">
							<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
								{#each items as item}
									<!-- Individual Coffee Card -->
									<div
										class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light transition-all hover:scale-[1.02] hover:ring-background-tertiary-light"
									>
										<div class="mb-3 flex items-start justify-between">
											<div>
												<h4 class="font-semibold text-text-primary-light">
													{item.coffee_name}
												</h4>
												<p class="text-sm text-text-secondary-light">
													{item.purchased_qty_lbs.toFixed(1)} lbs purchased
												</p>
											</div>
											<button
												type="button"
												class="rounded-md border border-background-tertiary-light px-3 py-1 text-sm text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white"
												onclick={() => handleSelectCoffee(item.coffee_name, date)}
											>
												{selectedCoffee === item.coffee_name ? 'Hide Sales' : 'View Sales'}
											</button>
										</div>

										<!-- Coffee Metrics Grid -->
										<div class="grid grid-cols-2 gap-3 text-sm">
											<div>
												<p class="text-text-secondary-light">Investment</p>
												<p class="font-semibold text-red-500">
													${(Number(item.bean_cost) + Number(item.tax_ship_cost)).toFixed(2)}
												</p>
											</div>
											<div>
												<p class="text-text-secondary-light">Revenue</p>
												<p class="font-semibold text-green-500">
													${Number(item.total_sales).toFixed(2)}
												</p>
											</div>
											<div>
												<p class="text-text-secondary-light">Profit</p>
												<p class="font-semibold text-blue-500">${Number(item.profit).toFixed(2)}</p>
											</div>
											<div>
												<p class="text-text-secondary-light">Margin</p>
												<p class="font-semibold text-purple-500">
													{Number(item.profit_margin).toFixed(1)}%
												</p>
											</div>
										</div>

										<!-- Sales Cards for Selected Coffee -->
										{#if selectedCoffee === item.coffee_name}
											<div class="mt-4 border-t border-border-light pt-4">
												<div class="mb-3 flex items-center justify-between">
													<h5 class="font-medium text-text-primary-light">Individual Sales</h5>
													<button
														type="button"
														class="rounded-md bg-background-tertiary-light px-3 py-1 text-sm font-medium text-white transition-all duration-200 hover:bg-opacity-90"
														onclick={() => handleAddSale(item)}
													>
														Add Sale
													</button>
												</div>

												{#if sortedSales.filter((sale) => sale.coffee_name === item.coffee_name).length === 0}
													<div class="rounded-md bg-background-primary-light p-4 text-center">
														<div class="mb-2 text-2xl opacity-50">💰</div>
														<p class="text-sm text-text-secondary-light">No sales recorded yet</p>
														<button
															type="button"
															class="mt-2 rounded-md bg-background-tertiary-light px-3 py-1 text-sm font-medium text-white transition-all duration-200 hover:bg-opacity-90"
															onclick={() => handleAddSale(item)}
														>
															Record First Sale
														</button>
													</div>
												{:else}
													<div class="space-y-2">
														{#each sortedSales.filter((sale) => sale.coffee_name === item.coffee_name) as sale}
															<div
																class="rounded-md bg-background-primary-light p-3 ring-1 ring-border-light"
															>
																<div class="flex items-start justify-between">
																	<div class="flex-1">
																		<div class="flex items-center gap-4 text-sm">
																			<div>
																				<p class="text-text-secondary-light">Date</p>
																				<p class="font-medium text-text-primary-light">
																					{formatDateForDisplay(sale.sell_date)}
																				</p>
																			</div>
																			<div>
																				<p class="text-text-secondary-light">Buyer</p>
																				<p class="font-medium text-text-primary-light">
																					{sale.buyer}
																				</p>
																			</div>
																			<div>
																				<p class="text-text-secondary-light">Amount</p>
																				<p class="font-medium text-text-primary-light">
																					{sale.oz_sold} oz
																				</p>
																			</div>
																			<div>
																				<p class="text-text-secondary-light">Price</p>
																				<p class="font-medium text-green-500">${sale.price}</p>
																			</div>
																		</div>
																		{#if sale.batch_name}
																			<p class="mt-1 text-xs text-text-secondary-light">
																				Batch: {sale.batch_name}
																			</p>
																		{/if}
																	</div>
																	<div class="flex gap-2">
																		<button
																			type="button"
																			class="rounded-md border border-blue-500 px-2 py-1 text-xs text-blue-500 transition-all duration-200 hover:bg-blue-500 hover:text-white"
																			onclick={() => handleEditSale(sale)}
																		>
																			Edit
																		</button>
																		<button
																			type="button"
																			class="rounded-md border border-red-500 px-2 py-1 text-xs text-red-500 transition-all duration-200 hover:bg-red-500 hover:text-white"
																			onclick={() => handleDeleteSale(sale.id)}
																		>
																			Delete
																		</button>
																	</div>
																</div>
															</div>
														{/each}
													</div>
												{/if}
											</div>
										{/if}
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
