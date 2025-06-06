<script lang="ts">
	import type { Database } from '$lib/types/database.types';
	import BeanForm from './BeanForm.svelte';
	import BeanProfile from './BeanProfile.svelte';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { filteredData, filterStore } from '$lib/stores/filterStore';

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

	// Only initialize filtered data if needed - most of the time the filter store should handle this
	$effect(() => {
		const currentRoute = $page.url.pathname;

		// If we have page data but filtered data is empty, initialize it manually
		if (
			data?.data?.length > 0 &&
			($filteredData.length === 0 ||
				!$filterStore.initialized ||
				$filterStore.routeId !== currentRoute) &&
			!initializing
		) {
			// console.log('Manually initializing filtered data with page data');
			initializing = true;
			// Use setTimeout to break the update cycle
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
</script>

<div class="">
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

	<!-- Coffee Cards -->
	<div class="flex-1">
		{#if !$filteredData || $filteredData.length === 0}
			<p class="p-4 text-text-primary-light">
				No coffee data available ({data?.data?.length || 0} items in raw data)
			</p>
		{:else}
			<div class="space-y-2 md:space-y-4">
				{#each $filteredData as bean}
					<button
						type="button"
						class="w-full cursor-pointer rounded-lg border border-border-light bg-background-secondary-light p-3 text-left shadow-md transition-colors hover:border hover:border-background-tertiary-light md:p-4"
						onclick={() => selectBean(bean)}
					>
						<div class="flex flex-col gap-2 sm:flex-row sm:justify-between">
							<div>
								<h3 class="text-primary-light text-base font-semibold md:text-lg">
									{bean.name}
								</h3>
								<p class="text-primary-light text-sm">{bean.source}</p>
							</div>
							<div class="text-left sm:text-right">
								<p class="text-primary-light text-base font-bold md:text-lg">
									${(bean.purchased_qty_lbs
										? ((bean.tax_ship_cost || 0) + (bean.bean_cost || 0)) / bean.purchased_qty_lbs
										: 0
									).toFixed(2)}/lb
								</p>
							</div>
						</div>
						<div>
							<div
								class="mt-2 grid grid-cols-1 gap-2 text-sm text-text-primary-light sm:grid-cols-3 sm:gap-4"
							>
								<div class="flex flex-col gap-2">
									<div>
										<span class="text-primary-light">Cultivar:</span>
										{bean.cultivar_detail || '-'}
									</div>
									<div>
										<span class="text-primary-light">Arrival:</span>
										{bean.arrival_date || '-'}
									</div>
								</div>
								<div class="flex flex-col gap-2">
									<div>
										<span class="text-primary-light">Processing:</span>
										{bean.processing || '-'}
									</div>
									<div>
										<span class="text-primary-light">Purchase:</span>
										{bean.purchase_date || '-'}
									</div>
								</div>
								{#if bean.score_value}
									<div class="mt-1 flex justify-end">
										<div class="flex flex-col items-center">
											<div class="relative h-8 w-8 sm:h-10 sm:w-10">
												<!-- Background arc -->
												<svg class="absolute inset-0" viewBox="0 0 100 100">
													<path
														d="M10,50 A40,40 0 1,1 90,50"
														fill="none"
														stroke="#e5e7eb"
														stroke-width="8"
														stroke-linecap="round"
													/>
													<!-- Foreground arc (dynamic based on score) -->
													<path
														d="M10,50 A40,40 0 1,1 90,50"
														fill="none"
														stroke={getStrokeColor(bean.score_value)}
														stroke-width="8"
														stroke-linecap="round"
														stroke-dasharray="126"
														stroke-dashoffset={126 -
															(126 * getScorePercentage(bean.score_value, 0, 100)) / 100}
													/>
												</svg>
												<!-- Score value in the center -->
												<div class="absolute inset-0 flex items-center justify-center">
													<span
														class="text-xs font-bold sm:text-sm {getScoreColorClass(
															bean.score_value
														)}"
													>
														{bean.score_value}
													</span>
												</div>

												<span
													class="text-primary-light absolute bottom-0 left-0 right-0 top-7 text-center text-xs"
													>SCORE</span
												>
											</div>
										</div>
									</div>
								{:else}
									<p class="text-primary-light text-sm">Score: -</p>
								{/if}
							</div>
						</div>
					</button>
				{/each}
			</div>
		{/if}
	</div>
</div>
