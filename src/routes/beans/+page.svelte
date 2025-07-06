<script lang="ts">
	import type { Database } from '$lib/types/database.types';
	import BeanForm from './BeanForm.svelte';
	import BeanProfile from './BeanProfile.svelte';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { filteredData, filterStore } from '$lib/stores/filterStore';
	import TastingNotesRadar from '$lib/components/TastingNotesRadar.svelte';
	import type { TastingNotes } from '$lib/types/coffee.types';

	// Define the type for the page data
	type PageData = {
		searchState?: {
			searchType?: 'green';
			searchId?: number;
		};
		data: Database['public']['Tables']['green_coffee_inv']['Row'][];
		role?: 'viewer' | 'member' | 'admin';
	};

	let { data } = $props<{ data: PageData }>();

	// Debug: Log the data
	// $effect(() => {
	// 	console.log('Beans page data:', data);
	// 	console.log('FilteredData store value:', $filteredData);
	// });

	// Track initialization state
	let initializing = $state(false);

	// Initialize or clear filtered data based on current route and data
	$effect(() => {
		const currentRoute = $page.url.pathname;

		// If we're on the beans route but have no data and filter store has data from another route, clear it
		if (
			currentRoute.includes('/beans') &&
			(!data?.data || data.data.length === 0) &&
			$filteredData.length > 0 &&
			!initializing
		) {
			initializing = true;
			setTimeout(() => {
				filterStore.initializeForRoute(currentRoute, []);
				initializing = false;
			}, 0);
		}
		// If we have page data but filtered data is empty or from a different route, initialize it
		else if (
			data?.data?.length > 0 &&
			($filteredData.length === 0 ||
				!$filterStore.initialized ||
				$filterStore.routeId !== currentRoute) &&
			!initializing
		) {
			initializing = true;
			setTimeout(() => {
				filterStore.initializeForRoute(currentRoute, data.data);
				initializing = false;
			}, 0);
		}
	});

	// State for form and bean selection
	let isFormVisible = $state(false);
	let selectedBean = $state<any>(null);
	let processingUpdate = $state(false);
	let lastSelectedBeanId = $state<number | null>(null);

	// Reset selected bean if it's filtered out with guard to prevent loops
	let lastFilteredDataLength = $state(0);

	$effect(() => {
		// Only process if the filtered data length has actually changed
		if (lastFilteredDataLength !== $filteredData.length) {
			// console.log(
			// 	'Filtered data changed in beans page, from',
			// 	lastFilteredDataLength,
			// 	'to',
			// 	$filteredData.length
			// );
			lastFilteredDataLength = $filteredData.length;

			if ($filteredData.length && selectedBean && !processingUpdate) {
				processingUpdate = true;
				try {
					// Check if the selected bean still exists in the filtered data
					const stillExists = $filteredData.some((bean) => bean.id === selectedBean.id);
					if (!stillExists && selectedBean.id !== lastSelectedBeanId) {
						// console.log('Selected bean was filtered out, resetting selection');
						selectedBean = null;
					}
				} finally {
					// Use setTimeout to break potential update cycles
					setTimeout(() => {
						processingUpdate = false;
					}, 50);
				}
			}
		}
	});

	// Function to select a bean with guard
	function selectBean(bean: any) {
		if (processingUpdate) return;

		processingUpdate = true;
		try {
			// Only update if different to avoid unnecessary re-renders
			if (!selectedBean || selectedBean.id !== bean.id) {
				// console.log('Selecting bean:', bean.id);
				lastSelectedBeanId = bean.id;
				selectedBean = bean;
				window.scrollTo({ top: 0, behavior: 'smooth' });
			}
		} finally {
			// Use setTimeout to break potential update cycles
			setTimeout(() => {
				processingUpdate = false;
			}, 50);
		}
	}

	// Function to load data
	async function loadData() {
		try {
			const shareToken = $page.url.searchParams.get('share');
			const url = shareToken ? `/api/data?share=${shareToken}` : '/api/data';

			const response = await fetch(url);
			if (response.ok) {
				const result = await response.json();
				data = {
					data: result.data,
					searchState: data.searchState,
					role: data.role
				};

				// Re-initialize filter store with new data
				if (data.data.length > 0 && !initializing) {
					initializing = true;
					setTimeout(() => {
						filterStore.initializeForRoute($page.url.pathname, data.data);
						initializing = false;
					}, 0);
				}

				return true;
			}
			return false;
		} catch (error) {
			console.error('Error loading data:', error);
			return false;
		}
	}

	// Function to handle bean deletion
	async function deleteBean(id: number) {
		try {
			selectedBean = null;
			const response = await fetch(`/api/data?id=${id}`, {
				method: 'DELETE'
			});

			if (response.ok) {
				await loadData();
			} else {
				const errorData = await response.json();
				console.error('Failed to delete bean:', errorData.error || 'Unknown error');
				await loadData();
			}
		} catch (error) {
			console.error('Error deleting bean:', error);
			await loadData();
		}
	}

	// Function to handle editing
	function editBean(bean: Database['public']['Tables']['green_coffee_inv']['Row']) {
		selectedBean = bean;
		isFormVisible = true;
	}

	async function handleFormSubmit(
		newBean: Database['public']['Tables']['green_coffee_inv']['Row']
	) {
		await loadData();
		selectedBean = null;
		setTimeout(() => {
			selectedBean = newBean;
		}, 0);
	}

	async function handleBeanUpdate(
		updatedBean: Database['public']['Tables']['green_coffee_inv']['Row']
	) {
		await loadData();
		selectedBean = updatedBean;
	}

	onMount(() => {
		loadData().then(() => {
			const searchState = $page.state as any;
			console.log('Beans page searchState:', searchState);

			// Check if we should show a bean based on the search state
			if (searchState?.searchType === 'green' && searchState?.searchId) {
				const foundBean = data.data.find(
					(bean: Database['public']['Tables']['green_coffee_inv']['Row']) =>
						bean.id === searchState.searchId
				);
				if (foundBean) {
					selectedBean = foundBean;
					window.scrollTo({ top: 0, behavior: 'smooth' });
				}
			}

			// Check if we should show the bean form
			if (searchState?.showBeanForm) {
				console.log('Should show bean form based on state flag');
				setTimeout(() => {
					handleAddNewBean();
				}, 100);
			}
		});

		// Add event listener for the custom show-bean-form event
		window.addEventListener('show-bean-form', handleAddNewBean);

		// Clean up the event listener when the component is destroyed
		return () => {
			window.removeEventListener('show-bean-form', handleAddNewBean);
		};
	});

	function handleAddNewBean() {
		console.log('handleAddNewBean called');
		selectedBean = null;
		isFormVisible = true;
	}

	// Update the data object when selectedBean changes
	$effect(() => {
		if (data) {
			data = {
				...data,
				selectedBean: selectedBean,
				onAddNewBean: handleAddNewBean
			};
		}
	});

	// Helper functions for score meter (copied from BeanProfile)
	function getScoreColorClass(score: number) {
		if (!score) return 'text-gray-400';
		if (score >= 91) return 'text-emerald-500';
		if (score >= 90) return 'text-green-500';
		if (score >= 87) return 'text-yellow-500';
		if (score >= 85) return 'text-orange-500';
		return 'text-red-500';
	}

	function getScorePercentage(score: number, min: number, max: number) {
		if (!score) return 0;
		const normalizedScore = Math.max(min, Math.min(max, score));
		return ((normalizedScore - min) / (max - min)) * 100;
	}

	function getStrokeColor(value: number) {
		if (value >= 91) return '#10b981'; // emerald-500
		if (value >= 90) return '#22c55e'; // green-500
		if (value >= 87) return '#eab308'; // yellow-500
		if (value >= 85) return '#f97316'; // orange-500
		return '#ef4444'; // red-500
	}

	/**
	 * Parses AI tasting notes JSON data safely
	 * @param tastingNotesJson - JSON string from database
	 * @returns Parsed tasting notes or null if invalid
	 */
	function parseTastingNotes(tastingNotesJson: string | null | object): TastingNotes | null {
		if (!tastingNotesJson) return null;

		try {
			// Handle both string and object formats (Supabase jsonb can return either)
			let parsed: any;
			if (typeof tastingNotesJson === 'string') {
				parsed = JSON.parse(tastingNotesJson);
			} else if (typeof tastingNotesJson === 'object') {
				parsed = tastingNotesJson;
			} else {
				return null;
			}

			// Validate that required properties exist
			if (
				parsed.body &&
				parsed.flavor &&
				parsed.acidity &&
				parsed.sweetness &&
				parsed.fragrance_aroma
			) {
				return parsed as TastingNotes;
			}
		} catch (error) {
			console.warn('Failed to parse tasting notes:', error, 'Input:', tastingNotesJson);
		}
		return null;
	}
</script>

<div class="">
	<!-- Header Section -->
	<div class="mb-6">
		<h1 class="text-primary-light mb-2 text-2xl font-bold">Coffee Inventory</h1>
		<p class="text-text-secondary-light">Manage your green coffee bean inventory and track purchases</p>
	</div>

	<!-- Dashboard Cards Section -->
	{#if $filteredData && $filteredData.length > 0}
		<div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<!-- Total Inventory Value -->
			<div class="rounded-lg bg-background-secondary-light p-4">
				<h3 class="text-primary-light text-sm font-medium">Total Inventory Value</h3>
				<p class="text-2xl font-bold text-green-500">
					${$filteredData.reduce((sum, bean) => sum + ((bean.bean_cost || 0) + (bean.tax_ship_cost || 0)), 0).toFixed(2)}
				</p>
				<p class="text-xs text-text-secondary-light mt-1">
					{$filteredData.length} coffee{$filteredData.length !== 1 ? 's' : ''}
				</p>
			</div>

			<!-- Total Weight -->
			<div class="rounded-lg bg-background-secondary-light p-4">
				<h3 class="text-primary-light text-sm font-medium">Total Weight</h3>
				<p class="text-2xl font-bold text-blue-500">
					{$filteredData.reduce((sum, bean) => sum + (bean.purchased_qty_lbs || 0), 0).toFixed(1)} lbs
				</p>
				<p class="text-xs text-text-secondary-light mt-1">
					{($filteredData.reduce((sum, bean) => sum + (bean.purchased_qty_lbs || 0), 0) * 16).toFixed(0)} oz total
				</p>
			</div>

			<!-- Average Cost Per Pound -->
			<div class="rounded-lg bg-background-secondary-light p-4">
				<h3 class="text-primary-light text-sm font-medium">Avg Cost/lb</h3>
				<p class="text-2xl font-bold text-orange-500">
					${(() => {
						const totalCost = $filteredData.reduce((sum, bean) => sum + ((bean.bean_cost || 0) + (bean.tax_ship_cost || 0)), 0);
						const totalWeight = $filteredData.reduce((sum, bean) => sum + (bean.purchased_qty_lbs || 0), 0);
						return totalWeight > 0 ? (totalCost / totalWeight).toFixed(2) : '0.00';
					})()}
				</p>
				<p class="text-xs text-text-secondary-light mt-1">
					Including shipping & tax
				</p>
			</div>

			<!-- Stocked Count -->
			<div class="rounded-lg bg-background-secondary-light p-4">
				<h3 class="text-primary-light text-sm font-medium">Currently Stocked</h3>
				<p class="text-2xl font-bold text-purple-500">
					{$filteredData.filter(bean => bean.stocked).length}
				</p>
				<p class="text-xs text-text-secondary-light mt-1">
					of {$filteredData.length} total
				</p>
			</div>
		</div>

		<!-- Source Distribution Chart -->
		<div class="mb-6 rounded-lg bg-background-secondary-light p-4">
			<h3 class="text-primary-light mb-4 text-lg font-semibold">Inventory by Source</h3>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each Object.entries(
					$filteredData.reduce((acc, bean) => {
						const source = bean.coffee_catalog?.source || bean.source || 'Unknown';
						if (!acc[source]) {
							acc[source] = { count: 0, weight: 0, value: 0 };
						}
						acc[source].count += 1;
						acc[source].weight += bean.purchased_qty_lbs || 0;
						acc[source].value += (bean.bean_cost || 0) + (bean.tax_ship_cost || 0);
						return acc;
					}, {})
				) as [source, stats]}
					<div class="rounded-lg bg-background-primary-light p-3">
						<h4 class="text-primary-light font-medium">{source}</h4>
						<div class="mt-2 space-y-1 text-sm text-text-secondary-light">
							<div>{stats.count} coffee{stats.count !== 1 ? 's' : ''}</div>
							<div>{stats.weight.toFixed(1)} lbs</div>
							<div class="font-medium text-background-tertiary-light">${stats.value.toFixed(2)}</div>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Recent Purchases -->
		<div class="mb-6 rounded-lg bg-background-secondary-light p-4">
			<h3 class="text-primary-light mb-4 text-lg font-semibold">Recent Purchases</h3>
			<div class="space-y-2">
				{#each $filteredData
					.filter(bean => bean.purchase_date)
					.sort((a, b) => new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime())
					.slice(0, 5) as recentBean}
					<button
						type="button"
						class="w-full rounded-lg bg-background-primary-light p-3 text-left transition-colors hover:bg-background-tertiary-light/20"
						onclick={() => selectBean(recentBean)}
					>
						<div class="flex items-center justify-between">
							<div>
								<h4 class="text-primary-light font-medium">
									{recentBean.coffee_catalog?.name || recentBean.name}
								</h4>
								<p class="text-sm text-text-secondary-light">
									{recentBean.coffee_catalog?.source || recentBean.source} • {recentBean.purchase_date}
								</p>
							</div>
							<div class="text-right">
								<div class="text-background-tertiary-light font-medium">
									{recentBean.purchased_qty_lbs?.toFixed(1)} lbs
								</div>
								<div class="text-sm text-text-secondary-light">
									${((recentBean.bean_cost || 0) + (recentBean.tax_ship_cost || 0)).toFixed(2)}
								</div>
							</div>
						</div>
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Bean Profile Section -->

	{#if selectedBean}
		<div class="mb-4">
			<BeanProfile
				{selectedBean}
				role={data.role}
				onUpdate={async (updatedBean) => {
					if (processingUpdate) return;
					processingUpdate = true;
					try {
						await loadData();
						// Find the updated bean in the filtered data
						const refreshedBean = $filteredData.find((bean) => bean.id === updatedBean.id);
						if (refreshedBean) {
							selectedBean = refreshedBean;
						}
					} finally {
						setTimeout(() => {
							processingUpdate = false;
						}, 50);
					}
				}}
				onDelete={async (id) => {
					if (processingUpdate) return;
					processingUpdate = true;
					try {
						await deleteBean(id);
						selectedBean = null;
					} finally {
						setTimeout(() => {
							processingUpdate = false;
						}, 50);
					}
				}}
			/>
		</div>
	{/if}

	<!-- Form Modal -->
	{#if isFormVisible}
		<div class="fixed inset-0 flex items-center justify-center bg-black bg-opacity-75 p-4">
			<div class="w-full max-w-2xl rounded-lg bg-background-secondary-light p-4 md:p-6">
				<BeanForm bean={null} onClose={() => (isFormVisible = false)} onSubmit={handleFormSubmit} />
			</div>
		</div>
	{/if}

	<!-- Quick Actions -->
	{#if $filteredData && $filteredData.length > 0}
		<div class="mb-6 flex flex-wrap items-center justify-between gap-4">
			<div class="flex flex-wrap gap-3">
				<button
					onclick={() => handleAddNewBean()}
					class="rounded-lg bg-background-tertiary-light px-4 py-2 text-white transition-all duration-200 hover:bg-opacity-90"
				>
					Add New Coffee
				</button>
				<button
					onclick={() => {
						// Trigger filter to show only stocked items
						filterStore.setFilter('stocked', true);
					}}
					class="rounded-lg border border-background-tertiary-light px-4 py-2 text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white"
				>
					View Stocked Only
				</button>
			</div>
			<div class="text-sm text-text-secondary-light">
				Showing {$filteredData.length} of {data?.data?.length || 0} coffees
			</div>
		</div>
	{/if}

	<!-- Coffee Cards -->
	<div class="flex-1">
		{#if !$filteredData || $filteredData.length === 0}
			<div class="rounded-lg bg-background-secondary-light p-8 text-center">
				<div class="mb-4 text-6xl opacity-50">☕</div>
				<h3 class="mb-2 text-lg font-semibold text-text-primary-light">
					{data?.data?.length > 0 ? 'No Coffees Match Your Filters' : 'No Coffee Beans Yet'}
				</h3>
				<p class="mb-4 text-text-secondary-light">
					{data?.data?.length > 0 
						? 'Try adjusting your filters to see more coffees, or add a new coffee to your inventory.'
						: 'Start building your coffee inventory by adding your first green coffee bean.'
					}
				</p>
				<div class="flex flex-col gap-3 sm:flex-row sm:justify-center">
					<button
						onclick={() => handleAddNewBean()}
						class="rounded-md bg-background-tertiary-light px-4 py-2 text-white transition-all duration-200 hover:bg-opacity-90"
					>
						{data?.data?.length > 0 ? 'Add New Coffee' : 'Add Your First Bean'}
					</button>
					{#if data?.data?.length > 0}
						<button
							onclick={() => filterStore.clearFilters()}
							class="rounded-md border border-background-tertiary-light px-4 py-2 text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white"
						>
							Clear Filters
						</button>
					{/if}
				</div>
			</div>
		{:else}
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				{#each $filteredData as bean}
					{@const catalogData = bean.coffee_catalog}
					{@const displayName = catalogData?.name || bean.name}
					{@const displaySource = catalogData?.source || 'Unknown Source'}
					{@const displayAiDescription = catalogData?.ai_description}
					{@const displayRegion = catalogData?.region}
					{@const displayProcessing = catalogData?.processing}
					{@const displayCultivar = catalogData?.cultivar_detail}
					{@const displayArrival = catalogData?.arrival_date}
					{@const displayScore = catalogData?.score_value}
					{@const tastingNotes = parseTastingNotes(catalogData?.ai_tasting_notes)}
					<button
						type="button"
						class="group rounded-lg bg-background-primary-light p-4 text-left shadow-sm ring-1 ring-border-light transition-all hover:scale-[1.02] hover:ring-background-tertiary-light"
						onclick={() => selectBean(bean)}
					>
						<!-- Mobile-optimized layout -->
						<div
							class="flex flex-col space-y-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0"
						>
							<!-- Content section -->
							<div class="flex-1">
								<h3
									class="font-semibold text-text-primary-light group-hover:text-background-tertiary-light"
								>
									{displayName}
								</h3>
								<div class="mt-1 flex items-center justify-between">
									<p class="text-sm font-medium text-background-tertiary-light">
										{displaySource}
									</p>
									<!-- Mobile: Price next to supplier name -->
									<div class="text-right sm:hidden">
										<div class="font-bold text-background-tertiary-light">
											${(bean.purchased_qty_lbs
												? ((bean.tax_ship_cost || 0) + (bean.bean_cost || 0)) /
													bean.purchased_qty_lbs
												: 0
											).toFixed(2)}/lb
										</div>
									</div>
								</div>
								{#if displayAiDescription}
									<p class="my-4 text-xs text-text-secondary-light">
										{displayAiDescription}
									</p>
								{/if}

								<!-- Mobile: Chart full width -->
								{#if tastingNotes}
									<div class="mt-2 px-6 sm:hidden">
										<TastingNotesRadar {tastingNotes} size={300} responsive={true} />
									</div>
								{/if}

								<div class="mt-3 flex-col gap-2 text-xs text-text-secondary-light sm:grid-cols-2">
									<div><span class="font-medium">Region:</span> {displayRegion || '-'}</div>
									<div>
										{#if displayProcessing}
											<span>Processing: {displayProcessing}</span>
										{/if}
									</div>
									<div>
										{#if displayCultivar}
											<span>Cultivar: {displayCultivar}</span>
										{/if}
									</div>
									<div>
										{#if displayArrival}
											<span>Arrival: {displayArrival}</span>
										{/if}
									</div>
									<div>
										{#if bean.purchase_date}
											<span>Purchase: {bean.purchase_date}</span>
										{/if}
									</div>
								</div>
							</div>

							<!-- Desktop: Price, score, and chart in sidebar -->
							<div class="hidden flex-col items-end space-y-2 sm:flex">
								<div class="text-right">
									<div class="font-bold text-background-tertiary-light">
										${(bean.purchased_qty_lbs
											? ((bean.tax_ship_cost || 0) + (bean.bean_cost || 0)) / bean.purchased_qty_lbs
											: 0
										).toFixed(2)}/lb
									</div>
									{#if displayScore}
										<div class="mt-1 text-xs text-text-secondary-light">
											Score: {Math.round(displayScore)}
										</div>
									{/if}
								</div>
								{#if tastingNotes}
									<div class="pt-4">
										<TastingNotesRadar {tastingNotes} size={180} />
									</div>
								{/if}
							</div>
						</div>

						<div class="mt-3 flex items-center justify-end">
							<svg
								class="h-4 w-4 text-text-secondary-light transition-transform group-hover:translate-x-1 group-hover:text-background-tertiary-light"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
								/>
							</svg>
						</div>
					</button>
				{/each}
			</div>
		{/if}
	</div>
</div>
