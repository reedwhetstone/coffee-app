<script lang="ts">
	import { page } from '$app/stores';
	import { clickOutside } from '$lib/utils/clickOutside';
	import { filterStore, filteredData } from '$lib/stores/filterStore';

	// Props for filter configuration and data
	let { data } = $props<{
		data: any;
	}>();

	// State for UI
	let isOpen = $state(false);
	let processingFilterChange = $state(false);
	let lastFilterChange = $state(Date.now());
	let filterQueueId: NodeJS.Timeout | null = $state(null);

	// Debug info
	$effect(() => {
		console.log('Settingsbar mounted, isOpen:', isOpen);
		// Subscribe to the current route
		const currentRoute = $page.url.pathname;
		console.log('Settingsbar current route:', currentRoute);
	});

	// Helper function to format column names
	function formatColumnName(column: string): string {
		return column.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
	}

	function closePanel() {
		console.log('Closing settings panel');
		isOpen = false;
	}

	function togglePanel() {
		console.log('Toggling settings panel, current state:', isOpen);
		isOpen = !isOpen;
	}

	// Queue filter changes with a minimum time between calls
	function queueFilterChange(callback: () => void) {
		// Clear any pending queue
		if (filterQueueId) {
			clearTimeout(filterQueueId);
			filterQueueId = null;
		}

		// If processing, queue it for later
		if (processingFilterChange) {
			console.log('Already processing a filter change, queueing next change');
			filterQueueId = setTimeout(() => queueFilterChange(callback), 100);
			return;
		}

		// If we've had a recent update, add a delay
		const now = Date.now();
		const timeSinceLastChange = now - lastFilterChange;
		if (timeSinceLastChange < 300) {
			// Queue with enough delay to space out calls
			const delay = 300 - timeSinceLastChange;
			console.log(`Recent filter change detected, adding ${delay}ms delay before next change`);
			filterQueueId = setTimeout(() => queueFilterChange(callback), delay);
			return;
		}

		// Execute the change
		processingFilterChange = true;
		try {
			lastFilterChange = Date.now();
			callback();
		} finally {
			// Use a longer delay to ensure we don't get cascading updates
			setTimeout(() => {
				processingFilterChange = false;

				// Check the queue after we're done
				if (filterQueueId) {
					clearTimeout(filterQueueId);
					filterQueueId = null;
				}
			}, 200);
		}
	}

	// Safe filter update methods
	function safeSetFilter(key: string, value: any) {
		queueFilterChange(() => filterStore.setFilter(key, value));
	}

	function safeSetSortField(field: string | null) {
		queueFilterChange(() => filterStore.setSortField(field));
	}

	function safeSetSortDirection(direction: 'asc' | 'desc' | null) {
		queueFilterChange(() => filterStore.setSortDirection(direction));
	}

	function safeClearFilters() {
		queueFilterChange(() => filterStore.clearFilters());
	}
</script>

<!-- Settings button -->
<div class="fixed left-4 top-4 z-50">
	<button
		onclick={togglePanel}
		class="rounded-full bg-background-secondary-light p-2 text-background-primary-light shadow-lg hover:bg-background-secondary-light/90"
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
			class="fixed left-0 top-0 h-full w-64 transform bg-background-secondary-light shadow-xl transition-transform"
			class:translate-x-0={isOpen}
			class:-translate-x-full={!isOpen}
			use:clickOutside={{ handler: closePanel }}
		>
			<div class="flex h-full flex-col">
				<!-- Header -->
				<div class="flex items-center justify-between p-4">
					<h3 class="text-secondary-light text-lg font-semibold">Filters</h3>
					<button
						onclick={closePanel}
						class="text-primary-light hover:text-secondary-light p-2"
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
								d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
								clip-rule="evenodd"
							/>
						</svg>
					</button>
				</div>

				<!-- Filter content -->
				<div class="flex-1 overflow-y-auto p-4">
					<div class="space-y-4">
						<!-- Sort Controls -->
						<div class="space-y-2">
							<label for="sort-field" class="text-primary-light block text-sm">Sort by</label>
							<select
								id="sort-field"
								value={$filterStore.sortField}
								onchange={(e) => safeSetSortField(e.currentTarget.value)}
								class="text-secondary-light w-full rounded bg-background-tertiary-light p-2 text-sm"
							>
								<option value="">None</option>
								{#each filterStore.getFilterableColumns($page.url.pathname) as column}
									<option value={column}>
										{formatColumnName(column)}
									</option>
								{/each}
							</select>

							{#if $filterStore.sortField}
								<select
									id="sort-direction"
									value={$filterStore.sortDirection}
									onchange={(e) => safeSetSortDirection(e.currentTarget.value as 'asc' | 'desc')}
									class="text-secondary-light w-full rounded bg-background-tertiary-light p-2 text-sm"
								>
									<option value="asc">Ascending</option>
									<option value="desc">Descending</option>
								</select>
							{/if}
						</div>

						<!-- Filter Controls -->
						<div class="space-y-2">
							<h4 class="text-primary-light block text-sm">Filters</h4>
							{#each filterStore.getFilterableColumns($page.url.pathname) as column}
								<div class="space-y-1">
									<label for={column} class="text-primary-light block text-xs">
										{formatColumnName(column)}
									</label>
									{#if column === 'source' && $filterStore.uniqueValues?.sources?.length}
										<div class="space-y-2">
											{#each $filterStore.uniqueValues.sources as source}
												<label class="flex items-center gap-2">
													<input
														type="checkbox"
														checked={$filterStore.filters.source?.includes(source)}
														onchange={(e) => {
															const currentSources = $filterStore.filters.source || [];
															if (e.currentTarget.checked) {
																safeSetFilter('source', [...currentSources, source]);
															} else {
																safeSetFilter(
																	'source',
																	currentSources.filter((s: string) => s !== source)
																);
															}
														}}
														class="rounded border-background-primary-light bg-background-tertiary-light text-blue-600"
													/>
													<span class="text-secondary-light text-sm">{source}</span>
												</label>
											{/each}
										</div>
									{:else if column === 'score_value'}
										<div class="flex gap-2">
											<input
												type="number"
												value={$filterStore.filters.score_value?.min || ''}
												oninput={(e) => {
													const currentValue = $filterStore.filters.score_value || {};
													safeSetFilter('score_value', {
														...currentValue,
														min: e.currentTarget.value
													});
												}}
												class="text-secondary-light w-full rounded bg-background-tertiary-light p-2 text-sm"
												placeholder="Min"
												min="0"
												max="100"
												step="0.1"
											/>
											<input
												type="number"
												value={$filterStore.filters.score_value?.max || ''}
												oninput={(e) => {
													const currentValue = $filterStore.filters.score_value || {};
													safeSetFilter('score_value', {
														...currentValue,
														max: e.currentTarget.value
													});
												}}
												class="text-secondary-light w-full rounded bg-background-tertiary-light p-2 text-sm"
												placeholder="Max"
												min="0"
												max="100"
												step="0.1"
											/>
										</div>
									{:else if column === 'purchase_date' && $filterStore.uniqueValues?.purchaseDates?.length}
										<select
											value={$filterStore.filters.purchase_date || ''}
											onchange={(e) => safeSetFilter('purchase_date', e.currentTarget.value)}
											class="text-secondary-light w-full rounded bg-background-tertiary-light p-2 text-sm"
										>
											<option value="">All Dates</option>
											{#each $filterStore.uniqueValues.purchaseDates as date}
												<option value={date}>{date}</option>
											{/each}
										</select>
									{:else if column === 'roast_date' && $filterStore.uniqueValues?.roastDates?.length}
										<select
											value={$filterStore.filters.roast_date || ''}
											onchange={(e) => safeSetFilter('roast_date', e.currentTarget.value)}
											class="text-secondary-light w-full rounded bg-background-tertiary-light p-2 text-sm"
										>
											<option value="">All Dates</option>
											{#each $filterStore.uniqueValues.roastDates as date}
												<option value={date}>{date}</option>
											{/each}
										</select>
									{:else if column === 'batch_name' && $filterStore.uniqueValues?.batchNames?.length}
										<select
											value={$filterStore.filters.batch_name || ''}
											onchange={(e) => safeSetFilter('batch_name', e.currentTarget.value)}
											class="text-secondary-light w-full rounded bg-background-tertiary-light p-2 text-sm"
										>
											<option value="">All Batches</option>
											{#each $filterStore.uniqueValues.batchNames as batchName}
												<option value={batchName}>{batchName}</option>
											{/each}
										</select>
									{:else}
										<input
											type="text"
											value={$filterStore.filters[column] || ''}
											oninput={(e) => safeSetFilter(column, e.currentTarget.value)}
											class="text-secondary-light w-full rounded bg-background-tertiary-light p-2 text-sm"
											placeholder={`Filter by ${column.replace(/_/g, ' ')}`}
										/>
									{/if}
								</div>
							{/each}

							<!-- Clear filters button -->
							<button
								class="mt-4 w-full rounded bg-blue-600 px-3 py-2 text-white hover:bg-blue-700"
								onclick={() => safeClearFilters()}
							>
								Clear Filters
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
