<script lang="ts">
	import { page } from '$app/stores';
	import { clickOutside } from '$lib/utils/clickOutside';

	// Props for filter configuration and data
	let { data, filteredData, onFilteredData } = $props<{
		data: any[];
		filteredData: any[];
		onFilteredData: (filteredData: any[]) => void;
	}>();

	// State
	let isOpen = $state(false);
	let expandedFilters = $state(true);

	// Get current route to determine which filters to show
	let routeId = $derived($page.url.pathname);

	// Local state for filters
	let filters = $state<Record<string, any>>({
		sortField: 'arrival_date',
		sortDirection: 'desc',
		source: [],
		name: '',
		processing: '',
		region: '',
		cost_lb: '',
		score_value: { min: '', max: '' },
		arrival_date: '',
		harvest_date: '',
		cultivar_detail: '',
		uniqueSources: [],
		uniqueDates: {}
	});

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

	// Initialize unique values for filters
	function initializeFilters() {
		switch (routeId) {
			case '/':
				filters.uniqueSources = [...new Set(data.map((item: { source: string }) => item.source))];
				break;
			case '/beans':
				filters.uniqueDates = {
					purchase_date: Array.from(
						new Set(data.map((item: { purchase_date: string }) => item.purchase_date))
					)
						.filter((date): date is string => typeof date === 'string')
						.sort((a, b) => b.localeCompare(a))
				};
				break;
			case '/roast':
				filters.uniqueDates = {
					roast_date: Array.from(
						new Set(data.map((item: { roast_date: string }) => item.roast_date))
					)
						.filter((date): date is string => typeof date === 'string')
						.sort((a, b) => b.localeCompare(a))
				};
				break;
		}
	}

	// Helper function to parse month/year dates
	function parseMonthYear(dateStr: string | null): Date {
		if (!dateStr) return new Date(0);
		const [month, year] = dateStr.split(' ');
		const monthIndex = new Date(Date.parse(month + ' 1, 2000')).getMonth();
		return new Date(parseInt(year), monthIndex);
	}

	// Filter data based on current filters
	function filterData(data: any[]): any[] {
		return data.filter((item) => {
			return Object.entries(filters).every(([key, value]) => {
				if (
					key === 'sortField' ||
					key === 'sortDirection' ||
					key === 'uniqueSources' ||
					key === 'uniqueDates'
				)
					return true;
				if (!value) return true;
				const itemValue = item[key as keyof typeof item];

				// Special handling for source
				if (key === 'source') {
					return value.length === 0 || value.includes(itemValue);
				}

				// Special handling for score_value
				if (key === 'score_value') {
					const score = Number(itemValue);
					return (
						(!value.min || score >= Number(value.min)) && (!value.max || score <= Number(value.max))
					);
				}

				// Default string filtering
				if (typeof value === 'string') {
					return String(itemValue).toLowerCase().includes(value.toLowerCase());
				}
				return true;
			});
		});
	}

	// Sort data based on current sort settings
	function sortData(data: any[]): any[] {
		if (!filters.sortField || !filters.sortDirection) return data;

		return [...data].sort((a, b) => {
			const aVal = a[filters.sortField];
			const bVal = b[filters.sortField];

			// Special handling for dates
			if (
				filters.sortField === 'arrival_date' ||
				filters.sortField === 'purchase_date' ||
				filters.sortField === 'roast_date'
			) {
				if (!aVal && !bVal) return 0;
				if (!aVal) return filters.sortDirection === 'asc' ? -1 : 1;
				if (!bVal) return filters.sortDirection === 'asc' ? 1 : -1;

				if (filters.sortField === 'arrival_date') {
					const dateA = parseMonthYear(aVal as string);
					const dateB = parseMonthYear(bVal as string);
					return filters.sortDirection === 'asc'
						? dateA.getTime() - dateB.getTime()
						: dateB.getTime() - dateA.getTime();
				} else {
					const aStr = String(aVal);
					const bStr = String(bVal);
					return filters.sortDirection === 'asc'
						? aStr.localeCompare(bStr)
						: bStr.localeCompare(aStr);
				}
			}

			// String comparison
			if (typeof aVal === 'string' && typeof bVal === 'string') {
				return filters.sortDirection === 'asc'
					? aVal.localeCompare(bVal)
					: bVal.localeCompare(aVal);
			}

			// Number comparison
			return filters.sortDirection === 'asc'
				? Number(aVal) - Number(bVal)
				: Number(bVal) - Number(aVal);
		});
	}

	// Process and emit filtered data
	function processData(): void {
		const filteredData = filterData(data);
		const sortedData = sortData(filteredData);
		onFilteredData(sortedData);
	}

	function closePanel() {
		isOpen = false;
	}

	// Initialize filters when data changes
	$effect(() => {
		if (data?.length > 0) {
			initializeFilters();
			processData();
		}
	});

	// Reset filters when route changes
	$effect(() => {
		const currentRoute = $page.url.pathname;
		if (currentRoute !== routeId) {
			filters = {
				sortField: 'arrival_date',
				sortDirection: 'desc',
				source: [],
				name: '',
				processing: '',
				region: '',
				cost_lb: '',
				score_value: { min: '', max: '' },
				arrival_date: '',
				harvest_date: '',
				cultivar_detail: '',
				uniqueSources: [],
				uniqueDates: {}
			};
			processData();
		}
	});
</script>

<!-- Settings button -->
<div class="fixed left-4 top-4 z-50">
	<button
		onclick={() => (isOpen = !isOpen)}
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
						onclick={() => (expandedFilters = !expandedFilters)}
					>
						{expandedFilters ? 'Hide Filters' : 'Show Filters'}
					</button>
				</div>

				<!-- Filter content -->
				<div class="flex-1 overflow-y-auto p-4">
					<div class={`space-y-4 ${expandedFilters ? 'block' : 'hidden'}`}>
						<!-- Sort Controls -->
						<div class="space-y-2">
							<label for="sort-field" class="text-primary-light block text-sm">Sort by</label>
							<select
								id="sort-field"
								bind:value={filters.sortField}
								onchange={processData}
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
									onchange={processData}
									class="bg-background-tertiary-light text-secondary-light w-full rounded p-2 text-sm"
								>
									<option value="asc">Ascending</option>
									<option value="desc">Descending</option>
								</select>
							{/if}
						</div>

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
											{#each filters.uniqueSources.map((item: any) => item.source) as source}
												<label class="flex items-center gap-2">
													<input
														type="checkbox"
														bind:group={filters.source}
														value={source}
														onchange={processData}
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
												oninput={processData}
												class="bg-background-tertiary-light text-secondary-light w-full rounded p-2 text-sm"
												placeholder="Min"
												min="0"
												max="100"
												step="0.1"
											/>
											<input
												type="number"
												bind:value={filters[column].max}
												oninput={processData}
												class="bg-background-tertiary-light text-secondary-light w-full rounded p-2 text-sm"
												placeholder="Max"
												min="0"
												max="100"
												step="0.1"
											/>
										</div>
									{:else if (column === 'purchase_date' || column === 'roast_date') && filters.uniqueDates?.[column]}
										<select
											bind:value={filters[column]}
											onchange={processData}
											class="bg-background-tertiary-light text-secondary-light w-full rounded p-2 text-sm"
										>
											<option value="">All Dates</option>
											{#each filters.uniqueDates[column].map((item: any) => item.date) as date}
												<option value={date}>{date}</option>
											{/each}
										</select>
									{:else}
										<input
											type="text"
											bind:value={filters[column]}
											oninput={processData}
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
