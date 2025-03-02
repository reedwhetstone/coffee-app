<script lang="ts">
	import { page } from '$app/stores';
	import { clickOutside } from '$lib/utils/clickOutside';
	import { filterStore, filteredData } from '$lib/stores/filterStore';

	// Props for filter configuration and data
	let {
		data,
		isOpen = false,
		onClose = () => {}
	} = $props<{
		data: any;
		isOpen?: boolean;
		onClose?: () => void;
	}>();

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
</script>

<!-- Settings panel - positioned relative to the parent in LeftSidebar -->
<div
	class="absolute left-12 mt-0 max-h-[90vh] w-64 overflow-hidden rounded-lg bg-white shadow-xl"
	use:clickOutside={{ handler: onClose }}
>
	<div class="flex h-full flex-col">
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-gray-200 p-4">
			<h3 class="text-lg font-semibold text-gray-800">Filters</h3>
			<button
				onclick={onClose}
				class="p-2 text-gray-600 hover:text-gray-800"
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
					<label for="sort-field" class="block text-sm font-medium text-gray-700">Sort by</label>
					<select
						id="sort-field"
						value={$filterStore.sortField}
						onchange={(e) => filterStore.setSortField(e.currentTarget.value)}
						class="w-full rounded border border-gray-300 bg-white p-2 text-sm text-gray-700 shadow-sm"
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
							onchange={(e) =>
								filterStore.setSortDirection(e.currentTarget.value as 'asc' | 'desc')}
							class="w-full rounded border border-gray-300 bg-white p-2 text-sm text-gray-700 shadow-sm"
						>
							<option value="asc">Ascending</option>
							<option value="desc">Descending</option>
						</select>
					{/if}
				</div>

				<!-- Filter Controls -->
				<div class="space-y-2">
					<h4 class="block text-sm font-medium text-gray-700">Filters</h4>
					{#each filterStore.getFilterableColumns($page.url.pathname) as column}
						<div class="space-y-1">
							<label for={column} class="block text-xs font-medium text-gray-700">
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
														filterStore.setFilter('source', [...currentSources, source]);
													} else {
														filterStore.setFilter(
															'source',
															currentSources.filter((s: string) => s !== source)
														);
													}
												}}
												class="rounded border-gray-300 text-blue-600 shadow-sm focus:ring-blue-500"
											/>
											<span class="text-sm text-gray-700">{source}</span>
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
											filterStore.setFilter('score_value', {
												...currentValue,
												min: e.currentTarget.value
											});
										}}
										class="w-full rounded border border-gray-300 bg-white p-2 text-sm text-gray-700 shadow-sm"
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
											filterStore.setFilter('score_value', {
												...currentValue,
												max: e.currentTarget.value
											});
										}}
										class="w-full rounded border border-gray-300 bg-white p-2 text-sm text-gray-700 shadow-sm"
										placeholder="Max"
										min="0"
										max="100"
										step="0.1"
									/>
								</div>
							{:else if column === 'purchase_date' && $filterStore.uniqueValues?.purchaseDates?.length}
								<select
									value={$filterStore.filters.purchase_date || ''}
									onchange={(e) => filterStore.setFilter('purchase_date', e.currentTarget.value)}
									class="w-full rounded border border-gray-300 bg-white p-2 text-sm text-gray-700 shadow-sm"
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
									class="w-full rounded border border-gray-300 bg-white p-2 text-sm text-gray-700 shadow-sm"
								>
									<option value="">All Dates</option>
									{#each $filterStore.uniqueValues.roastDates as date}
										<option value={date}>{date}</option>
									{/each}
								</select>
							{:else if column === 'batch_name' && $filterStore.uniqueValues?.batchNames?.length}
								<select
									value={$filterStore.filters.batch_name || ''}
									onchange={(e) => filterStore.setFilter('batch_name', e.currentTarget.value)}
									class="w-full rounded border border-gray-300 bg-white p-2 text-sm text-gray-700 shadow-sm"
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
									oninput={(e) => filterStore.setFilter(column, e.currentTarget.value)}
									class="w-full rounded border border-gray-300 bg-white p-2 text-sm text-gray-700 shadow-sm"
									placeholder={`Filter by ${column.replace(/_/g, ' ')}`}
								/>
							{/if}
						</div>
					{/each}

					<!-- Clear filters button -->
					<button
						class="mt-4 w-full rounded bg-blue-600 px-3 py-2 text-white hover:bg-blue-700"
						onclick={() => filterStore.clearFilters()}
					>
						Clear Filters
					</button>
				</div>
			</div>
		</div>
	</div>
</div>
