<script lang="ts">
	import { page } from '$app/stores';
	import { clickOutside } from '$lib/utils/clickOutside';

	// Props for filter configuration
	let { filters = {}, onFilterChange } = $props<{
		filters: Record<string, any>;
		onFilterChange: (filters: Record<string, any>) => void;
	}>();

	// State
	let isOpen = $state(false);
	let expandedFilters = $state(true);

	// Get current route to determine which filters to show
	let routeId = $derived($page.url.pathname);

	// Helper function to format column names
	function formatColumnName(column: string): string {
		return column.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
	}

	// Get filterable columns based on route
	function getFilterableColumns(): string[] {
		switch (routeId) {
			case '/':
				return [
					'source',
					'name',
					'processing',
					'region',
					'cost_lb',
					'score_value',
					'arrival_date',
					'harvest_date',
					'cultivar_detail'
				];
			case '/beans':
				return [
					'name',
					'purchase_date',
					'score_value',
					'rank',
					'cultivar_detail',
					'processing',
					'vendor',
					'price_per_lb',
					'arrival_date'
				];
			case '/roast':
				return ['coffee_name', 'batch_name', 'roast_date', 'notes'];
			default:
				return [];
		}
	}

	function closePanel() {
		isOpen = false;
	}
</script>

<!-- Settings button -->
<div class="fixed left-4 top-4 z-50">
	<button
		on:click={() => (isOpen = !isOpen)}
		class="bg-background-secondary-light text-background-primary-light hover:bg-background-secondary-light/90 rounded-full p-2 shadow-lg"
		aria-label="Toggle settings"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="h-8 w-8"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
			/>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
			/>
		</svg>
	</button>

	{#if isOpen}
		<!-- Settings panel -->
		<div
			class="bg-background-secondary-light fixed left-0 top-0 h-full w-64 transform shadow-xl transition-transform"
			class:translate-x-0={isOpen}
			class:-translate-x-full={!isOpen}
			use:clickOutside={{ handler: closePanel }}
		>
			<div class="flex h-full flex-col">
				<!-- Header -->
				<div class="flex items-center justify-between p-4">
					<h3 class="text-secondary-light text-lg font-semibold">Filters</h3>
					<button
						class="text-primary-light hover:text-secondary-light text-sm"
						on:click={() => (expandedFilters = !expandedFilters)}
					>
						{expandedFilters ? 'Hide Filters' : 'Show Filters'}
					</button>
				</div>

				<!-- Filter content -->
				<div class="flex-1 overflow-y-auto p-4">
					<div class={`space-y-4 ${expandedFilters ? 'block' : 'hidden'}`}>
						<!-- Sort Controls -->
						{#if filters.sortField !== undefined}
							<div class="space-y-2">
								<label for="sort-field" class="text-primary-light block text-sm">Sort by</label>
								<select
									id="sort-field"
									bind:value={filters.sortField}
									on:change={() => onFilterChange(filters)}
									class="bg-background-tertiary-light text-secondary-light w-full rounded p-2 text-sm"
								>
									<option value={null}>None</option>
									{#each getFilterableColumns() as column}
										<option value={column}>
											{formatColumnName(column)}
										</option>
									{/each}
								</select>

								{#if filters.sortField}
									<select
										id="sort-direction"
										bind:value={filters.sortDirection}
										on:change={() => onFilterChange(filters)}
										class="bg-background-tertiary-light text-secondary-light w-full rounded p-2 text-sm"
									>
										<option value="asc">Ascending</option>
										<option value="desc">Descending</option>
									</select>
								{/if}
							</div>
						{/if}

						<!-- Filter Controls -->
						<div class="space-y-2">
							<h4 class="text-primary-light block text-sm">Filters</h4>
							{#each getFilterableColumns() as column}
								<div class="space-y-1">
									<label for={column} class="text-primary-light block text-xs">
										{formatColumnName(column)}
									</label>
									{#if column === 'source' && filters.uniqueSources}
										<div class="space-y-2">
											{#each filters.uniqueSources as source}
												<label class="flex items-center gap-2">
													<input
														type="checkbox"
														bind:group={filters.source}
														value={source}
														on:change={() => onFilterChange(filters)}
														class="border-background-primary-light bg-background-tertiary-light rounded text-blue-600"
													/>
													<span class="text-secondary-light text-sm">{source}</span>
												</label>
											{/each}
										</div>
									{:else if column === 'score_value'}
										<div class="flex gap-2">
											<input
												type="number"
												bind:value={filters[column].min}
												on:input={() => onFilterChange(filters)}
												class="bg-background-tertiary-light text-secondary-light w-full rounded p-2 text-sm"
												placeholder="Min"
												min="0"
												max="100"
												step="0.1"
											/>
											<input
												type="number"
												bind:value={filters[column].max}
												on:input={() => onFilterChange(filters)}
												class="bg-background-tertiary-light text-secondary-light w-full rounded p-2 text-sm"
												placeholder="Max"
												min="0"
												max="100"
												step="0.1"
											/>
										</div>
									{:else if column === 'purchase_date' && filters.uniquePurchaseDates}
										<select
											bind:value={filters[column]}
											on:change={() => onFilterChange(filters)}
											class="bg-background-tertiary-light text-secondary-light w-full rounded p-2 text-sm"
										>
											<option value="">All Dates</option>
											{#each filters.uniquePurchaseDates as date}
												<option value={date}>{date}</option>
											{/each}
										</select>
									{:else}
										<input
											type="text"
											bind:value={filters[column]}
											on:input={() => onFilterChange(filters)}
											class="bg-background-tertiary-light text-secondary-light w-full rounded p-2 text-sm"
											placeholder={`Filter by ${column.replace(/_/g, ' ')}`}
										/>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
