<!-- src/lib/components/layout/Settingsbar.svelte -->
<script lang="ts">
	import { page } from '$app/state';
	import { filterStore, filteredData } from '$lib/stores/filterStore';
	import { afterNavigate } from '$app/navigation';

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

	// Update routeId to use the store value directly
	let routeId = $state(page.url.pathname);

	// Update `routeId` after each navigation
	afterNavigate(() => {
		routeId = page.url.pathname;
		onClose();
	});

	// Debug info
	$effect(() => {
		console.log('Settingsbar mounted, isOpen:', isOpen);
		// Subscribe to the current route
		const currentRoute = page.url.pathname;
		console.log('Settingsbar current route:', currentRoute);
	});

	// Helper function to format column names
	function formatColumnName(column: string): string {
		return column.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
	}
</script>

<!-- Settings panel - full height -->
<div class="flex h-full flex-col">
	<!-- Header with close button that handles keyboard events -->
	<header
		class="flex items-center justify-between border-b border-text-primary-dark border-opacity-20 p-4"
	>
		<h3 class="text-xl font-semibold" id="filters-dialog-title">Filters</h3>
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
			<section class="space-y-2 border-b border-text-primary-dark border-opacity-10 pb-4">
				<label for="sort-field" class="block text-sm font-medium">Sort by</label>
				<select
					id="sort-field"
					value={$filterStore.sortField}
					onchange={(e) => filterStore.setSortField(e.currentTarget.value)}
					class="w-full rounded border border-text-primary-dark border-opacity-20 bg-background-primary-dark/50 p-2 text-sm shadow-md"
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
						value={$filterStore.sortDirection}
						onchange={(e) => filterStore.setSortDirection(e.currentTarget.value as 'asc' | 'desc')}
						class="w-full rounded border border-text-primary-dark border-opacity-20 bg-background-primary-dark/50 p-2 text-sm shadow-md"
					>
						<option value="asc">Ascending</option>
						<option value="desc">Descending</option>
					</select>
				{/if}
			</section>

			<!-- Filter Controls -->
			<section class="space-y-3">
				<h4 class="block text-sm font-medium">Filters</h4>
				{#each filterStore.getFilterableColumns(routeId) as column}
					<div class="mb-3 space-y-1">
						<label for={column} class="block text-xs font-medium">
							{formatColumnName(column)}
						</label>
						{#if column === 'source' && $filterStore.uniqueValues?.sources?.length}
							<div class="space-y-2">
								<div class="mb-1 flex justify-between">
									<button
										class="text-xs text-blue-400 hover:text-blue-300"
										onclick={() => {
											filterStore.setFilter('source', [...$filterStore.uniqueValues.sources]);
										}}
									>
										Select All
									</button>
									<button
										class="text-xs text-blue-400 hover:text-blue-300"
										onclick={() => {
											filterStore.setFilter('source', []);
										}}
									>
										Clear All
									</button>
								</div>
								<div
									class="max-h-40 overflow-y-auto rounded border border-text-primary-dark border-opacity-20 p-2"
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
												class="border-text-primary-dark border-opacity-20 bg-background-primary-dark/50 text-blue-400 focus:ring-blue-400"
											/>
											<span class="text-sm">{source}</span>
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
										const currentValue = $filterStore.filters.score_value || {};
										filterStore.setFilter('score_value', {
											...currentValue,
											min: e.currentTarget.value
										});
									}}
									class="w-full rounded border border-text-primary-dark border-opacity-20 bg-background-primary-dark/50 p-2 text-sm shadow-md"
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
									class="w-full rounded border border-text-primary-dark border-opacity-20 bg-background-primary-dark/50 p-2 text-sm shadow-md"
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
								class="w-full rounded border border-text-primary-dark border-opacity-20 bg-background-primary-dark/50 p-2 text-sm shadow-md"
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
								class="w-full rounded border border-text-primary-dark border-opacity-20 bg-background-primary-dark/50 p-2 text-sm shadow-md"
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
								class="w-full rounded border border-text-primary-dark border-opacity-20 bg-background-primary-dark/50 p-2 text-sm shadow-md"
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
								class="w-full rounded border border-text-primary-dark border-opacity-20 bg-background-primary-dark/50 p-2 text-sm shadow-md"
								placeholder={`Filter by ${column.replace(/_/g, ' ')}`}
							/>
						{/if}
					</div>
				{/each}

				<!-- Clear filters button -->
				<button
					class="mt-4 w-full rounded border border-background-tertiary-light px-3 py-2 text-sm text-blue-400 hover:bg-background-tertiary-light/10"
					onclick={filterStore.clearFilters}
				>
					Clear All Filters
				</button>
			</section>
		</div>
	</main>
</div>
