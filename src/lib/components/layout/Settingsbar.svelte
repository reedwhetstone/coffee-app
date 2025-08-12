<!-- src/lib/components/layout/Settingsbar.svelte -->
<!--
	Settings sidebar component that provides filtering and sorting controls
	Dynamically shows relevant filter options based on the current route
	Integrates with the global filter store to manage data filtering and sorting
-->
<script lang="ts">
	import { page } from '$app/state';
	import { filterStore } from '$lib/stores/filterStore';
	import { afterNavigate } from '$app/navigation';

	// Component props interface
	let { onClose = () => {} } = $props<{
		data: any;
		isOpen?: boolean;
		onClose?: () => void;
	}>();

	// Track current route for dynamic filter options
	let routeId = $state(page.url.pathname);

	// Update route tracking and close sidebar on navigation
	afterNavigate(() => {
		routeId = page.url.pathname;
		onClose();
	});

	/**
	 * Formats database column names for display in the UI
	 * Converts snake_case to Title Case with custom labels
	 * @param column - The column name to format
	 * @returns Formatted column name
	 */
	function formatColumnName(column: string): string {
		// Custom field labels
		const customLabels: Record<string, string> = {
			grade: 'Elevation (MASL)',
			appearance: 'Appearance',
			type: 'Importer',
			roast_id: 'Roast ID'
		};

		// Return custom label if available, otherwise format normally
		if (customLabels[column]) {
			return customLabels[column];
		}

		return column.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
	}
</script>

<!-- Settings panel - full height -->
<div class="flex h-full flex-col">
	<!-- Header with close button that handles keyboard events -->
	<header
		class="flex items-center justify-between border-b border-text-primary-light border-opacity-20 p-4"
	>
		<h3 class="text-lg font-semibold text-text-primary-light" id="filters-dialog-title">Filters</h3>
		<button
			onclick={(e) => {
				e.stopPropagation();
				onClose();
			}}
			onkeydown={(e) => e.key === 'Escape' && onClose()}
			class="p-2 hover:opacity-80"
			aria-label="Close settings panel"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-5 w-5"
				viewBox="0 0 20 20"
				fill="currentColor"
			>
				<path
					fill-rule="evenodd"
					d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
					clip-rule="evenodd"
				/>
			</svg>
		</button>
	</header>

	<!-- Filter content -->
	<main class="flex-1 overflow-y-auto p-4">
		<div class="space-y-4">
			<!-- Sort Controls -->
			<section class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
				<label for="sort-field" class="block text-sm font-medium text-text-primary-light"
					>Sort by</label
				>
				<select
					id="sort-field"
					value={$filterStore.sortField || ''}
					onchange={(e) => filterStore.setSortField(e.currentTarget.value)}
					class="mt-1 w-full rounded-md border border-border-light bg-background-primary-light p-2 text-sm text-text-primary-light shadow-sm focus:outline-none focus:ring-2 focus:ring-background-tertiary-light"
				>
					<option value="">None</option>
					{#each filterStore.getFilterableColumns(routeId) as column}
						<option value={column}>
							{formatColumnName(column)}
						</option>
					{/each}
				</select>

				{#if $filterStore.sortField}
					<select
						id="sort-direction"
						value={$filterStore.sortDirection || ''}
						onchange={(e) => filterStore.setSortDirection(e.currentTarget.value as 'asc' | 'desc')}
						class="mt-2 w-full rounded-md border border-border-light bg-background-primary-light p-2 text-sm text-text-primary-light shadow-sm focus:outline-none focus:ring-2 focus:ring-background-tertiary-light"
					>
						<option value="asc">Ascending</option>
						<option value="desc">Descending</option>
					</select>
				{/if}
			</section>

			<!-- Filter Controls -->
			<section class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
				<h4 class="mb-3 text-sm font-medium text-text-primary-light">Filters</h4>
				<div class="space-y-3">
					{#each filterStore.getFilterableColumns(routeId) as column}
						<div class="space-y-1">
							<label for={column} class="block text-xs font-medium text-text-primary-light">
								{formatColumnName(column)}
							</label>
							{#if column === 'source' && $filterStore.uniqueValues?.sources?.length}
								<div class="space-y-2">
									<div class="mb-2 flex justify-between">
										<button
											class="text-xs text-background-tertiary-light hover:opacity-80"
											onclick={() => {
												filterStore.setFilter('source', [...$filterStore.uniqueValues.sources]);
											}}
										>
											Select All
										</button>
										<button
											class="text-xs text-background-tertiary-light hover:opacity-80"
											onclick={() => {
												filterStore.setFilter('source', []);
											}}
										>
											Clear All
										</button>
									</div>
									<div
										class="max-h-40 overflow-y-auto rounded-md border border-border-light bg-background-primary-light p-2"
									>
										{#each $filterStore.uniqueValues.sources as source}
											<label class="flex items-center gap-2 py-1">
												<input
													type="checkbox"
													checked={$filterStore.filters.source?.includes(source)}
													onchange={(e) => {
														const currentSources = $filterStore.filters.source || [];
														if (e.currentTarget.checked) {
															filterStore.setFilter('source', [...currentSources, source]);
														} else {
															filterStore.setFilter(
																'source',
																currentSources.filter((s: string) => s !== source)
															);
														}
													}}
													class="rounded border border-border-light bg-background-primary-light text-background-tertiary-light focus:ring-2 focus:ring-background-tertiary-light"
												/>
												<span class="text-sm text-text-primary-light">{source}</span>
											</label>
										{/each}
									</div>
								</div>
							{:else if column === 'continent' && $filterStore.uniqueValues?.continents?.length}
								<select
									value={$filterStore.filters.continent || ''}
									onchange={(e) => filterStore.setFilter('continent', e.currentTarget.value)}
									class="mt-1 w-full rounded-md border border-border-light bg-background-primary-light p-2 text-sm text-text-primary-light shadow-sm focus:outline-none focus:ring-2 focus:ring-background-tertiary-light"
								>
									<option value="">All Continents</option>
									{#each $filterStore.uniqueValues.continents as continent}
										<option value={continent}>{continent}</option>
									{/each}
								</select>
							{:else if column === 'country' && $filterStore.uniqueValues?.countries?.length}
								<div class="space-y-2">
									<div class="mb-2 flex justify-between">
										<button
											class="text-xs text-background-tertiary-light hover:opacity-80"
											onclick={() => {
												filterStore.setFilter('country', [...$filterStore.uniqueValues.countries]);
											}}
										>
											Select All
										</button>
										<button
											class="text-xs text-background-tertiary-light hover:opacity-80"
											onclick={() => {
												filterStore.setFilter('country', []);
											}}
										>
											Clear All
										</button>
									</div>
									<div
										class="max-h-40 overflow-y-auto rounded-md border border-border-light bg-background-primary-light p-2"
									>
										{#each $filterStore.uniqueValues.countries as country}
											<label class="flex items-center gap-2 py-1">
												<input
													type="checkbox"
													checked={$filterStore.filters.country?.includes(country)}
													onchange={(e) => {
														const currentCountries = $filterStore.filters.country || [];
														if (e.currentTarget.checked) {
															filterStore.setFilter('country', [...currentCountries, country]);
														} else {
															filterStore.setFilter(
																'country',
																currentCountries.filter((c: string) => c !== country)
															);
														}
													}}
													class="rounded border border-border-light bg-background-primary-light text-background-tertiary-light focus:ring-2 focus:ring-background-tertiary-light"
												/>
												<span class="text-sm text-text-primary-light">{country}</span>
											</label>
										{/each}
									</div>
								</div>
							{:else if column === 'score_value'}
								<div class="flex gap-2">
									<input
										type="number"
										value={$filterStore.filters.score_value?.min || ''}
										oninput={(e) => {
											const min = e.currentTarget.value;
											const max = $filterStore.filters.score_value?.max || '';
											filterStore.setFilter('score_value', { min, max });
										}}
										class="w-full rounded-md border border-border-light bg-background-primary-light p-2 text-sm text-text-primary-light shadow-sm focus:outline-none focus:ring-2 focus:ring-background-tertiary-light"
										placeholder="Min"
										min="0"
										max="100"
										step="0.1"
									/>
									<input
										type="number"
										value={$filterStore.filters.score_value?.max || ''}
										oninput={(e) => {
											const max = e.currentTarget.value;
											const min = $filterStore.filters.score_value?.min || '';
											filterStore.setFilter('score_value', { min, max });
										}}
										class="w-full rounded-md border border-border-light bg-background-primary-light p-2 text-sm text-text-primary-light shadow-sm focus:outline-none focus:ring-2 focus:ring-background-tertiary-light"
										placeholder="Max"
										min="0"
										max="100"
										step="0.1"
									/>
								</div>
							{:else if column === 'cost_lb'}
								<div class="flex gap-2">
									<input
										type="number"
										value={$filterStore.filters.cost_lb?.min || ''}
										oninput={(e) => {
											const min = e.currentTarget.value;
											const max = $filterStore.filters.cost_lb?.max || '';
											filterStore.setFilter('cost_lb', { min, max });
										}}
										class="w-full rounded-md border border-border-light bg-background-primary-light p-2 text-sm text-text-primary-light shadow-sm focus:outline-none focus:ring-2 focus:ring-background-tertiary-light"
										placeholder="Min $"
										min="0"
										step="0.01"
									/>
									<input
										type="number"
										value={$filterStore.filters.cost_lb?.max || ''}
										oninput={(e) => {
											const max = e.currentTarget.value;
											const min = $filterStore.filters.cost_lb?.min || '';
											filterStore.setFilter('cost_lb', { min, max });
										}}
										class="w-full rounded-md border border-border-light bg-background-primary-light p-2 text-sm text-text-primary-light shadow-sm focus:outline-none focus:ring-2 focus:ring-background-tertiary-light"
										placeholder="Max $"
										min="0"
										step="0.01"
									/>
								</div>
							{:else if column === 'arrival_date' && $filterStore.uniqueValues?.arrivalDates?.length}
								<select
									value={$filterStore.filters.arrival_date || ''}
									onchange={(e) => filterStore.setFilter('arrival_date', e.currentTarget.value)}
									class="mt-1 w-full rounded-md border border-border-light bg-background-primary-light p-2 text-sm text-text-primary-light shadow-sm focus:outline-none focus:ring-2 focus:ring-background-tertiary-light"
								>
									<option value="">All Dates</option>
									{#each $filterStore.uniqueValues.arrivalDates as date}
										<option value={date}>{date}</option>
									{/each}
								</select>
							{:else if column === 'purchase_date' && $filterStore.uniqueValues?.purchaseDates?.length}
								<select
									value={$filterStore.filters.purchase_date || ''}
									onchange={(e) => filterStore.setFilter('purchase_date', e.currentTarget.value)}
									class="mt-1 w-full rounded-md border border-border-light bg-background-primary-light p-2 text-sm text-text-primary-light shadow-sm focus:outline-none focus:ring-2 focus:ring-background-tertiary-light"
								>
									<option value="">All Dates</option>
									{#each $filterStore.uniqueValues.purchaseDates as date}
										<option value={date}>{date}</option>
									{/each}
								</select>
							{:else if column === 'roast_date' && $filterStore.uniqueValues?.roastDates?.length}
								<select
									value={$filterStore.filters.roast_date || ''}
									onchange={(e) => filterStore.setFilter('roast_date', e.currentTarget.value)}
									class="mt-1 w-full rounded-md border border-border-light bg-background-primary-light p-2 text-sm text-text-primary-light shadow-sm focus:outline-none focus:ring-2 focus:ring-background-tertiary-light"
								>
									<option value="">All Dates</option>
									{#each $filterStore.uniqueValues.roastDates as date}
										<option value={date}>{date}</option>
									{/each}
								</select>
							{:else if column === 'stocked_date'}
								<select
									value={$filterStore.filters.stocked_date || ''}
									onchange={(e) => filterStore.setFilter('stocked_date', e.currentTarget.value)}
									class="mt-1 w-full rounded-md border border-border-light bg-background-primary-light p-2 text-sm text-text-primary-light shadow-sm focus:outline-none focus:ring-2 focus:ring-background-tertiary-light"
								>
									<option value="">All Dates</option>
									<option value="7">Last 7 days</option>
									<option value="14">Last 14 days</option>
									<option value="30">Last 30 days</option>
									<option value="60">Last 60 days</option>
									<option value="90">Last 90 days</option>
								</select>
							{:else if column === 'batch_name' && $filterStore.uniqueValues?.batchNames?.length}
								<select
									value={$filterStore.filters.batch_name || ''}
									onchange={(e) => filterStore.setFilter('batch_name', e.currentTarget.value)}
									class="mt-1 w-full rounded-md border border-border-light bg-background-primary-light p-2 text-sm text-text-primary-light shadow-sm focus:outline-none focus:ring-2 focus:ring-background-tertiary-light"
								>
									<option value="">All Batches</option>
									{#each $filterStore.uniqueValues.batchNames as batchName}
										<option value={batchName}>{batchName}</option>
									{/each}
								</select>
							{:else if column === 'roast_id'}
								<input
									type="text"
									value={$filterStore.filters.roast_id || ''}
									oninput={(e) => filterStore.setFilter('roast_id', e.currentTarget.value)}
									class="mt-1 w-full rounded-md border border-border-light bg-background-primary-light p-2 text-sm text-text-primary-light shadow-sm focus:outline-none focus:ring-2 focus:ring-background-tertiary-light"
									placeholder="Search by Roast ID"
								/>
							{:else if column === 'stocked'}
								<select
									value={$filterStore.filters.stocked || ''}
									onchange={(e) => filterStore.setFilter('stocked', e.currentTarget.value)}
									class="mt-1 w-full rounded-md border border-border-light bg-background-primary-light p-2 text-sm text-text-primary-light shadow-sm focus:outline-none focus:ring-2 focus:ring-background-tertiary-light"
								>
									<option value="">All</option>
									<option value="TRUE">Stocked</option>
									<option value="FALSE">Unstocked</option>
								</select>
							{:else}
								<input
									type="text"
									value={$filterStore.filters[column] || ''}
									oninput={(e) => filterStore.setFilter(column, e.currentTarget.value)}
									class="mt-1 w-full rounded-md border border-border-light bg-background-primary-light p-2 text-sm text-text-primary-light shadow-sm focus:outline-none focus:ring-2 focus:ring-background-tertiary-light"
									placeholder={`Filter by ${column.replace(/_/g, ' ')}`}
								/>
							{/if}
						</div>
					{/each}
				</div>

				<!-- Clear filters button -->
				<button
					class="mt-4 w-full rounded-md border border-background-tertiary-light px-4 py-2 text-sm font-medium text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white"
					onclick={filterStore.clearFilters}
				>
					Clear All Filters
				</button>
			</section>
		</div>
	</main>
</div>
