<script lang="ts">
	import type { Database } from '$lib/types/database.types';
	import BeanForm from './BeanForm.svelte';
	import BeanProfileTabs from './BeanProfileTabs.svelte';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { invalidateAll } from '$app/navigation';
	import { filteredData, filterStore } from '$lib/stores/filterStore';
	import ChartSkeleton from '$lib/components/ChartSkeleton.svelte';
	import BeansPageSkeleton from '$lib/components/BeansPageSkeleton.svelte';
	import SimpleLoadingScreen from '$lib/components/SimpleLoadingScreen.svelte';
	import type { TastingNotes } from '$lib/types/coffee.types';
	import type {
		InventoryWithCatalog,
		RoastProfile,
		CoffeeCatalog,
		CoffeeFormData
	} from '$lib/types/component.types';
	import type { ComponentType } from 'svelte';

	// Lazy load the tasting notes radar component
	let TastingNotesRadar = $state<any>(null);
	let radarComponentLoading = $state(true);

	// Load radar component after initial render
	$effect(() => {
		setTimeout(async () => {
			try {
				const module = await import('$lib/components/TastingNotesRadar.svelte');
				TastingNotesRadar = module.default;
				radarComponentLoading = false;
			} catch (error) {
				console.error('Failed to load radar component:', error);
				radarComponentLoading = false;
			}
		}, 150); // Slightly delayed to prioritize main content
	});

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
			coffee_catalog?: CoffeeCatalog;
			roast_profiles?: Array<{
				oz_in: number | null;
				oz_out: number | null;
				weight_loss_percent: number | null;
				roast_id: number | null;
				batch_name: string | null;
				roast_date: string | null;
			}>;
		}>;
		catalogData?: CoffeeCatalog[];
		role?: 'viewer' | 'member' | 'admin';
	};

	let { data } = $props<{ data: PageData }>();

	// Debug: Log the data
	$effect(() => {
		console.log('Raw data from server:', data?.data?.length);
		console.log('Full server data object:', {
			hasData: !!data,
			dataKeys: data ? Object.keys(data) : [],
			role: data?.role,
			searchState: data?.searchState,
			isShared: data?.isShared,
			catalogDataLength: data?.catalogData?.length
		});

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

	// Track loading state
	let isLoading = $state(true);

	// Initialize filter store when data is available
	$effect(() => {
		const currentRoute = page.url.pathname;

		// Simple initialization: only run if we have data and store isn't initialized for this route
		if (data?.data && (!$filterStore.initialized || $filterStore.routeId !== currentRoute)) {
			console.log('Filter store: Initializing for beans route');
			filterStore.initializeForRoute(currentRoute, data.data);
			isLoading = false;
		}
	});

	// State for form and bean selection
	let isFormVisible = $state(false);
	let selectedBean = $state<any>(null);
	let beanProfileElement = $state<HTMLElement | null>(null);

	// Reset selected bean if it's filtered out
	$effect(() => {
		if (selectedBean && $filteredData.length > 0) {
			const stillExists = $filteredData.some((bean) => bean.id === selectedBean.id);
			if (!stillExists) {
				selectedBean = null;
			}
		}
	});

	// Function to select a bean
	function selectBean(bean: InventoryWithCatalog) {
		if (!selectedBean || selectedBean.id !== bean.id) {
			selectedBean = bean;
			// Scroll to bean profile after it renders
			setTimeout(() => {
				if (beanProfileElement) {
					beanProfileElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
				}
			}, 100);
		}
	}

	// Function to refresh data using SvelteKit invalidation (preferred approach)
	async function refreshData() {
		await invalidateAll();
	}

	// Function to handle bean deletion
	async function deleteBean(id: number) {
		try {
			selectedBean = null;
			const response = await fetch(`/api/beans?id=${id}`, {
				method: 'DELETE'
			});

			if (response.ok) {
				await refreshData();
			} else {
				const errorData = await response.json();
				console.error('Failed to delete bean:', errorData.error || 'Unknown error');
				await refreshData();
			}
		} catch (error) {
			console.error('Error deleting bean:', error);
			await refreshData();
		}
	}

	// Function to handle editing
	function editBean(bean: Database['public']['Tables']['green_coffee_inv']['Row']) {
		selectedBean = bean;
		isFormVisible = true;
	}

	async function handleFormSubmit(formData: CoffeeFormData) {
		await refreshData();
		// For form submission, we don't have the full bean data immediately
		// The bean will be selected from the refreshed data if needed
	}

	async function handleBeanUpdate(
		updatedBean: Database['public']['Tables']['green_coffee_inv']['Row']
	) {
		await refreshData();
		selectedBean = updatedBean;
	}

	onMount(() => {
		console.log('Beans page mounted');

		// Set loading to false
		isLoading = false;

		// Handle search state from navigation
		const searchState = page.state as any;

		// Check if we should show a bean based on the search state
		if (searchState?.searchType === 'green' && searchState?.searchId && data?.data) {
			const foundBean = data.data.find(
				(bean: InventoryWithCatalog) => bean.id === searchState.searchId
			);
			if (foundBean) {
				selectedBean = foundBean;
				setTimeout(() => {
					if (beanProfileElement) {
						beanProfileElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
					}
				}, 100);
			}
		}

		// Check if we should show the bean form
		if (searchState?.showBeanForm) {
			setTimeout(() => {
				handleAddNewBean();
			}, 100);
		}

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

	// Remove selectedBean from data object - use URL params for navigation instead

	/**
	 * Parses AI tasting notes JSON data safely
	 * @param tastingNotesJson - JSON string from database
	 * @returns Parsed tasting notes or null if invalid
	 */
	function parseTastingNotes(tastingNotesJson: string | null | object): TastingNotes | null {
		if (!tastingNotesJson) return null;

		try {
			// Handle both string and object formats (Supabase jsonb can return either)
			let parsed: TastingNotes;
			if (typeof tastingNotesJson === 'string') {
				parsed = JSON.parse(tastingNotesJson);
			} else if (typeof tastingNotesJson === 'object') {
				parsed = tastingNotesJson as TastingNotes;
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

<!-- Show instant skeleton when no data loaded yet -->
{#if !data || !data.data}
	<BeansPageSkeleton />
{:else}
	<div class="">
		<!-- Header Section -->
		<div class="mb-6">
			<h1 class="text-primary-light mb-2 text-2xl font-bold">Coffee Inventory</h1>
			<p class="text-text-secondary-light">
				Manage your green coffee bean inventory and track purchases
			</p>
		</div>

		<!-- Dashboard Cards Section -->
		{#if !isLoading && $filteredData && $filteredData.length > 0}
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
						{$filteredData.reduce((sum, bean) => sum + (bean.purchased_qty_lbs || 0), 0).toFixed(1)}
						lbs
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
							const totalStockedLbs = $filteredData.reduce(
								(sum: number, bean: InventoryWithCatalog) => {
									const purchasedOz = (bean.purchased_qty_lbs || 0) * 16;
									const roastedOz =
										bean.roast_profiles?.reduce(
											(ozSum: number, profile: RoastProfile) => ozSum + (profile.oz_in || 0),
											0
										) || 0;
									const remainingOz = purchasedOz - roastedOz;
									const shouldBeStocked = remainingOz >= 8; // 0.5 lb threshold logic from stockedStatusUtils

									// Only count remaining inventory for coffees that should be stocked
									if (shouldBeStocked) {
										return sum + remainingOz / 16;
									}
									return sum;
								},
								0
							);
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
						// Update selectedBean and refresh data
						selectedBean = updatedBean;
						await refreshData();
						// Update selectedBean from refreshed data
						const refreshedBean = $filteredData.find((bean) => bean.id === updatedBean.id);
						if (refreshedBean) {
							selectedBean = refreshedBean;
						}
					}}
					onDelete={async (id) => {
						await deleteBean(id);
						selectedBean = null;
					}}
				/>
			</div>
		{/if}

		<!-- Form Modal -->
		{#if isFormVisible}
			<div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
				<div class="w-full max-w-2xl rounded-lg bg-background-secondary-light p-4 md:p-6">
					<BeanForm
						bean={null}
						onClose={() => (isFormVisible = false)}
						onSubmit={handleFormSubmit}
						catalogBeans={data?.catalogData || []}
					/>
				</div>
			</div>
		{/if}

		<!-- Quick Actions -->
		{#if !isLoading && $filteredData && $filteredData.length > 0}
			<div class="mb-6 flex flex-wrap items-center justify-between gap-4">
				<div class="text-sm text-text-secondary-light">
					Showing {$filteredData.length} of {data?.data?.length || 0} coffees
				</div>
			</div>
		{/if}

		<!-- Coffee Cards -->
		<div class="flex-1">
			{#if isLoading}
				<SimpleLoadingScreen
					show={true}
					message="Loading your coffee inventory..."
					overlay={false}
				/>
			{:else if !$filteredData || $filteredData.length === 0}
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
							class="rounded-md bg-background-tertiary-light px-4 py-2 font-medium text-white transition-all duration-200 hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-background-tertiary-light focus:ring-offset-2"
						>
							{data?.data?.length > 0 ? 'Add New Coffee' : 'Add Your First Bean'}
						</button>
						{#if data?.data?.length > 0}
							<button
								onclick={() => filterStore.clearFilters()}
								class="rounded-md border border-background-tertiary-light px-4 py-2 font-medium text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white focus:outline-none focus:ring-2 focus:ring-background-tertiary-light focus:ring-offset-2"
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
						{@const displayLocation =
							[catalogData?.continent, catalogData?.country, catalogData?.region]
								.filter(Boolean)
								.join(' > ') || '-'}
						{@const displayProcessing = catalogData?.processing}
						{@const displayCultivar = catalogData?.cultivar_detail}
						{@const displayGrade = catalogData?.grade}
						{@const displayAppearance = catalogData?.appearance}
						{@const displayType = catalogData?.type}
						{@const displayArrival = catalogData?.arrival_date}
						{@const displayRating = bean.rank}
						{@const tastingNotes = parseTastingNotes(catalogData?.ai_tasting_notes)}
						{@const userCuppingNotes = parseTastingNotes(bean.cupping_notes)}
						{@const hasUserRating = bean.rank !== undefined && bean.rank !== null}
						{@const hasUserCupping = userCuppingNotes !== null}
						{@const purchasedOz = (bean.purchased_qty_lbs || 0) * 16}
						{@const roastedOz =
							bean.roast_profiles?.reduce(
								(ozSum: number, profile: RoastProfile) => ozSum + (profile.oz_in || 0),
								0
							) || 0}
						{@const remainingLbs = (purchasedOz - roastedOz) / 16}
						<button
							type="button"
							class="group relative rounded-lg bg-background-primary-light p-4 text-left shadow-sm ring-1 ring-border-light transition-all hover:scale-[1.02] hover:ring-background-tertiary-light"
							onclick={() => selectBean(bean)}
						>
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
															☕ Cupped
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
											{#if radarComponentLoading}
												<ChartSkeleton height="300px" title="Loading tasting profile..." />
											{:else if TastingNotesRadar}
												<TastingNotesRadar {tastingNotes} size={300} responsive={true} />
											{/if}
										</div>
									{/if}

									<div class="mt-3 flex-col gap-2 text-xs text-text-secondary-light sm:grid-cols-2">
										<div><span class="font-medium">Location:</span> {displayLocation}</div>
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
											{#if displayGrade}
												<span>Elevation: {displayGrade}</span>
											{/if}
										</div>
										<div>
											{#if displayAppearance}
												<span>Appearance: {displayAppearance}</span>
											{/if}
										</div>
										<div>
											{#if displayType}
												<span>Importer: {displayType}</span>
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
												? ((bean.tax_ship_cost || 0) + (bean.bean_cost || 0)) /
													bean.purchased_qty_lbs
												: 0
											).toFixed(2)}/lb
										</div>
									</div>
									{#if tastingNotes}
										<div class="pt-4">
											{#if radarComponentLoading}
												<ChartSkeleton height="180px" title="Loading tasting profile..." />
											{:else if TastingNotesRadar}
												<TastingNotesRadar {tastingNotes} size={180} />
											{/if}
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
{/if}
