<script lang="ts">
	import type { Database } from '$lib/types/database.types';
	import BeanForm from './BeanForm.svelte';
	import BeanProfileTabs from './BeanProfileTabs.svelte';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { invalidateAll } from '$app/navigation';
	import { filteredData, filterStore } from '$lib/stores/filterStore';
	import TastingNotesRadar from '$lib/components/TastingNotesRadar.svelte';
	import type { TastingNotes } from '$lib/types/coffee.types';

	// Define the type for the page data
	type PageData = {
		searchState?: {
			searchType?: 'green';
			searchId?: number;
		};
		data: Array<{
			id: number;
			rank: number | null;
			notes: string | null;
			purchase_date: string | null;
			purchased_qty_lbs: number | null;
			bean_cost: number | null;
			tax_ship_cost: number | null;
			last_updated: string;
			user: string;
			catalog_id: number | null;
			stocked: boolean | null;
			coffee_catalog?: any;
			roast_profiles?: Array<{
				oz_in: number | null;
				oz_out: number | null;
			}>;
		}>;
		role?: 'viewer' | 'member' | 'admin';
	};

	let { data } = $props<{ data: PageData }>();

	// Debug: Log the data
	$effect(() => {
		console.log('Raw data from server:', data?.data?.length);
		if (data?.data?.length > 0) {
			console.log('First bean raw data:', data.data[0]);
			const beanWithProfiles = data.data.find(
				(bean: PageData['data'][0]) => bean.roast_profiles && bean.roast_profiles.length > 0
			);
			if (beanWithProfiles) {
				console.log(
					'Bean with profiles found in raw data:',
					beanWithProfiles.coffee_catalog?.name,
					beanWithProfiles.roast_profiles
				);
			} else {
				console.log('No beans with roast_profiles found in raw data');
			}
		}

		if ($filteredData.length > 0) {
			const sampleBean = $filteredData.find(
				(bean) => bean.roast_profiles && bean.roast_profiles.length > 0
			);
			if (sampleBean) {
				console.log(
					'Sample bean with roast profiles in filtered data:',
					sampleBean.coffee_catalog?.name,
					sampleBean.roast_profiles
				);
			} else {
				console.log('No beans with roast_profiles found in filtered data');
			}
		}
	});

	// Track initialization state
	let initializing = $state(false);

	// Initialize or clear filtered data based on current route and data
	$effect(() => {
		const currentRoute = page.url.pathname;

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
	let beanProfileElement = $state<HTMLElement | null>(null);

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
				// Scroll to bean profile after it renders
				setTimeout(() => {
					if (beanProfileElement) {
						beanProfileElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
					}
				}, 100);
			}
		} finally {
			// Use setTimeout to break potential update cycles
			setTimeout(() => {
				processingUpdate = false;
			}, 50);
		}
	}

	// Function to refresh data using SvelteKit invalidation
	async function refreshData() {
		await invalidateAll();
	}

	// Function to load data from API
	async function loadData() {
		try {
			const shareToken = page.url.searchParams.get('share');
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
						filterStore.initializeForRoute(page.url.pathname, data.data);
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
			const searchState = page.state as any;
			console.log('Beans page searchState:', searchState);

			// Check if we should show a bean based on the search state
			if (searchState?.searchType === 'green' && searchState?.searchId) {
				const foundBean = data.data.find(
					(bean: Database['public']['Tables']['green_coffee_inv']['Row']) =>
						bean.id === searchState.searchId
				);
				if (foundBean) {
					selectedBean = foundBean;
					// Scroll to bean profile after it renders
					setTimeout(() => {
						if (beanProfileElement) {
							beanProfileElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
						}
					}, 100);
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
		<p class="text-text-secondary-light">
			Manage your green coffee bean inventory and track purchases
		</p>
	</div>

	<!-- Dashboard Cards Section -->
	{#if $filteredData && $filteredData.length > 0}
		<div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
			<!-- Total Inventory Value -->
			<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
				<h3 class="text-sm font-medium text-text-primary-light">Total Inventory Value</h3>
				<p class="mt-1 text-2xl font-bold text-green-500">
					${$filteredData
						.reduce((sum, bean) => sum + ((bean.bean_cost || 0) + (bean.tax_ship_cost || 0)), 0)
						.toFixed(2)}
				</p>
				<p class="mt-1 text-xs text-text-secondary-light">
					{$filteredData.length} coffee{$filteredData.length !== 1 ? 's' : ''}
				</p>
			</div>

			<!-- Total Weight -->
			<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
				<h3 class="text-sm font-medium text-text-primary-light">Total Weight</h3>
				<p class="mt-1 text-2xl font-bold text-blue-500">
					{$filteredData.reduce((sum, bean) => sum + (bean.purchased_qty_lbs || 0), 0).toFixed(1)} lbs
				</p>
				<p class="mt-1 text-xs text-text-secondary-light">
					{(
						$filteredData.reduce((sum, bean) => sum + (bean.purchased_qty_lbs || 0), 0) * 16
					).toFixed(0)} oz total
				</p>
			</div>

			<!-- Stocked Inventory -->
			<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
				<h3 class="text-sm font-medium text-text-primary-light">Raw Inventory</h3>
				<p class="mt-1 text-2xl font-bold text-indigo-500">
					{(() => {
						const totalStockedLbs = $filteredData.reduce((sum: number, bean: any) => {
							const purchasedOz = (bean.purchased_qty_lbs || 0) * 16;
							const roastedOz =
								bean.roast_profiles?.reduce(
									(ozSum: number, profile: any) => ozSum + (profile.oz_in || 0),
									0
								) || 0;
							const remainingOz = purchasedOz - roastedOz;
							const shouldBeStocked = remainingOz >= 8; // 0.5 lb threshold logic from stockedStatusUtils

							// Only count remaining inventory for coffees that should be stocked
							if (shouldBeStocked) {
								return sum + remainingOz / 16;
							}
							return sum;
						}, 0);
						return totalStockedLbs.toFixed(1);
					})()} lbs
				</p>
				<p class="mt-1 text-xs text-text-secondary-light">Available for roasting</p>
			</div>

			<!-- Average Cost Per Pound -->
			<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
				<h3 class="text-sm font-medium text-text-primary-light">Avg Cost/lb</h3>
				<p class="mt-1 text-2xl font-bold text-orange-500">
					${(() => {
						const totalCost = $filteredData.reduce(
							(sum, bean) => sum + ((bean.bean_cost || 0) + (bean.tax_ship_cost || 0)),
							0
						);
						const totalWeight = $filteredData.reduce(
							(sum, bean) => sum + (bean.purchased_qty_lbs || 0),
							0
						);
						return totalWeight > 0 ? (totalCost / totalWeight).toFixed(2) : '0.00';
					})()}
				</p>
				<p class="mt-1 text-xs text-text-secondary-light">Including shipping & tax</p>
			</div>

			<!-- Stocked Count -->
			<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
				<h3 class="text-sm font-medium text-text-primary-light">Currently Stocked</h3>
				<p class="mt-1 text-2xl font-bold text-purple-500">
					{$filteredData.filter((bean) => bean.stocked).length}
				</p>
				<p class="mt-1 text-xs text-text-secondary-light">
					of {$filteredData.length} selected coffees
				</p>
			</div>
		</div>

		<!-- Source Distribution Chart -->
		<div class="mb-6 rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
			<h3 class="mb-4 text-lg font-semibold text-text-primary-light">Inventory by Source</h3>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each Object.entries($filteredData.reduce((acc, bean) => {
							const source = bean.coffee_catalog?.source || bean.source || 'Unknown';
							if (!acc[source]) {
								acc[source] = { count: 0, weight: 0, value: 0 };
							}
							acc[source].count += 1;
							acc[source].weight += bean.purchased_qty_lbs || 0;
							acc[source].value += (bean.bean_cost || 0) + (bean.tax_ship_cost || 0);
							return acc;
						}, {} as Record<string, { count: number; weight: number; value: number }>)) as entry}
					{@const [source, stats] = entry as [
						string,
						{ count: number; weight: number; value: number }
					]}
					<div class="rounded-lg bg-background-primary-light p-3">
						<h4 class="text-primary-light font-medium">{source}</h4>
						<div class="mt-2 space-y-1 text-sm text-text-secondary-light">
							<div>{stats.count} coffee{stats.count !== 1 ? 's' : ''}</div>
							<div>{stats.weight.toFixed(1)} lbs</div>
							<div class="font-medium text-background-tertiary-light">
								${stats.value.toFixed(2)}
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Bean Profile Section -->

	{#if selectedBean}
		<div class="mb-4" bind:this={beanProfileElement}>
			<BeanProfileTabs
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
			<div class="text-sm text-text-secondary-light">
				Showing {$filteredData.length} of {data?.data?.length || 0} coffees
			</div>
		</div>
	{/if}

	<!-- Coffee Cards -->
	<div class="flex-1">
		{#if !$filteredData || $filteredData.length === 0}
			<div
				class="rounded-lg bg-background-secondary-light p-8 text-center ring-1 ring-border-light"
			>
				<div class="mb-4 text-6xl opacity-50">☕</div>
				<h3 class="mb-2 text-lg font-semibold text-text-primary-light">
					{data?.data?.length > 0 ? 'No Coffees Match Your Filters' : 'No Coffee Beans Yet'}
				</h3>
				<p class="mb-4 text-text-secondary-light">
					{data?.data?.length > 0
						? 'Try adjusting your filters to see more coffees, or add a new coffee to your inventory.'
						: 'Start building your coffee inventory by adding your first green coffee bean.'}
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
					{@const userCuppingNotes = parseTastingNotes(bean.cupping_notes)}
					{@const hasUserRating = bean.rank !== undefined && bean.rank !== null}
					{@const hasUserCupping = userCuppingNotes !== null}
					{@const purchasedOz = (bean.purchased_qty_lbs || 0) * 16}
					{@const roastedOz =
						bean.roast_profiles?.reduce(
							(ozSum: number, profile: any) => ozSum + (profile.oz_in || 0),
							0
						) || 0}
					{@const remainingLbs = (purchasedOz - roastedOz) / 16}
					<button
						type="button"
						class="group relative rounded-lg bg-background-primary-light p-4 text-left shadow-sm ring-1 ring-border-light transition-all hover:scale-[1.02] hover:ring-background-tertiary-light"
						onclick={() => selectBean(bean)}
					>
						<!-- User Assessment Indicators -->
						{#if hasUserRating || hasUserCupping}
							<div class="absolute right-2 top-2 flex gap-1">
								{#if hasUserRating}
									<div
										class="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white"
										title="User rating: {bean.rank}/10"
									>
										{bean.rank}
									</div>
								{/if}
								{#if hasUserCupping}
									<div
										class="flex h-6 w-6 items-center justify-center rounded-full bg-purple-500 text-xs text-white"
										title="Has user cupping notes"
									>
										👃
									</div>
								{/if}
							</div>
						{/if}

						<!-- Mobile-optimized layout -->
						<div
							class="flex flex-col space-y-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0"
						>
							<!-- Content section -->
							<div class="flex-1">
								<h3
									class="font-semibold text-text-primary-light group-hover:text-background-tertiary-light {hasUserRating ||
									hasUserCupping
										? 'pr-16 sm:pr-0'
										: ''}"
								>
									{displayName}
								</h3>
								<div class="mt-1 flex items-center justify-between">
									<div class="flex items-center gap-2">
										<p class="text-sm font-medium text-background-tertiary-light">
											{displaySource}
										</p>
										{#if hasUserRating || hasUserCupping}
											<div class="hidden gap-1 sm:flex">
												{#if hasUserRating}
													<span class="rounded bg-amber-100 px-1 text-xs text-amber-800">
														⭐ {bean.rank}
													</span>
												{/if}
												{#if hasUserCupping}
													<span class="rounded bg-purple-100 px-1 text-xs text-purple-800">
														👃 Cupped
													</span>
												{/if}
											</div>
										{/if}
									</div>
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
									<div>
										<span class="font-medium">Stocked:</span>
										<span class={remainingLbs > 0 ? 'text-green-500' : 'text-red-500'}>
											{remainingLbs.toFixed(1)} lbs
										</span>
										{#if roastedOz > 0}
											<span class="text-text-secondary-light">
												({roastedOz.toFixed(0)} oz roasted)
											</span>
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
