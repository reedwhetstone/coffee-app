<script lang="ts">
	import type { Database } from '$lib/types/database.types';
	import BeanForm from './BeanForm.svelte';
	import BeanProfile from './BeanProfile.svelte';
	import { onMount } from 'svelte';
	import { navbarActions } from '$lib/stores/navbarStore';
	import { get } from 'svelte/store';
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
	$effect(() => {
		console.log('Beans page data:', data);
		console.log('FilteredData store value:', $filteredData);
	});

	// Only initialize filtered data if needed - most of the time the filter store should handle this
	$effect(() => {
		// If we have page data but filtered data is empty, initialize it manually
		if (data?.data?.length > 0 && $filteredData.length === 0) {
			console.log('Manually initializing filtered data with page data');
			filterStore.initializeForRoute($page.url.pathname, data.data);
		}
	});

	// State for form and bean selection
	let isFormVisible = $state(false);
	let selectedBean = $state<any>(null);
	let processingUpdate = $state(false);

	// Reset selected bean if it's filtered out
	$effect(() => {
		if ($filteredData.length && selectedBean && !processingUpdate) {
			processingUpdate = true;
			try {
				// Check if the selected bean still exists in the filtered data
				const stillExists = $filteredData.some((bean) => bean.id === selectedBean.id);
				if (!stillExists) {
					selectedBean = null;
				}
			} finally {
				processingUpdate = false;
			}
		}
	});

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
				if (data.data.length > 0) {
					filterStore.initializeForRoute($page.url.pathname, data.data);
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

	// Function to handle row selection
	function selectBean(bean: Database['public']['Tables']['green_coffee_inv']['Row']) {
		selectedBean = bean;
		window.scrollTo({ top: 0, behavior: 'smooth' });
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
		});

		navbarActions.set({
			...get(navbarActions),
			onAddNewBean: handleAddNewBean,
			onSearchSelect: async (type, id) => {
				if (type === 'green') {
					await loadData();
					const foundBean = data.data.find(
						(bean: Database['public']['Tables']['green_coffee_inv']['Row']) => bean.id === id
					);
					if (foundBean) {
						selectedBean = null;
						await Promise.resolve();
						selectedBean = foundBean;
						window.scrollTo({ top: 0, behavior: 'smooth' });
					}
				}
			}
		});

		return () => {
			navbarActions.set({
				...get(navbarActions),
				onAddNewBean: () => {},
				onSearchSelect: () => {}
			});
		};
	});

	function handleAddNewBean() {
		selectedBean = null;
		isFormVisible = true;
	}
</script>

<div class="m-2 md:m-4">
	<!-- Bean Profile Section -->
	{#if data.role === 'admin' || data.role === 'member'}
		<div class="mb-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
			<button
				class="rounded border-2 border-green-800 px-3 py-1 text-zinc-500 hover:bg-green-900"
				onclick={handleAddNewBean}
			>
				New Bean
			</button>
			<button
				class="rounded border-2 border-blue-800 px-3 py-1 text-zinc-500 hover:bg-blue-900"
				onclick={async () => {
					try {
						const response = await fetch('/api/share', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								resourceId: selectedBean ? selectedBean.id : 'all'
							})
						});

						if (!response.ok) {
							throw new Error('Failed to create share link');
						}

						const { shareUrl } = await response.json();
						await navigator.clipboard.writeText(shareUrl);
						alert('Share link copied to clipboard!');
					} catch (error) {
						console.error('Error sharing:', error);
						alert('Failed to create share link. Please try again.');
					}
				}}
			>
				Share {selectedBean ? 'Selected Bean' : 'All Beans'}
			</button>
		</div>
	{/if}

	{#if selectedBean}
		<div class="mb-4">
			<BeanProfile
				{selectedBean}
				role={data.role}
				onUpdate={(bean) => handleBeanUpdate(bean)}
				onDelete={(id) => deleteBean(id)}
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
			<p class="p-4 text-zinc-300">
				No coffee data available ({data?.data?.length || 0} items in raw data)
			</p>
		{:else}
			<div class="space-y-2 md:space-y-4">
				{#each $filteredData as bean}
					<button
						type="button"
						class="w-full cursor-pointer rounded-lg bg-background-secondary-light p-3 text-left transition-colors hover:bg-background-tertiary-light md:p-4"
						onclick={() => selectBean(bean)}
					>
						<div class="flex flex-col gap-2 sm:flex-row sm:justify-between">
							<div>
								<h3 class="text-secondary-light text-base font-semibold md:text-lg">
									{bean.name}
								</h3>
								<p class="text-primary-light text-sm">{bean.vendor}</p>
							</div>
							<div class="text-left sm:text-right">
								<p class="text-secondary-light text-base font-bold md:text-lg">
									${bean.price_per_lb}/lb
								</p>
								<p class="text-primary-light text-sm">Score: {bean.score_value}</p>
							</div>
						</div>
						<div class="mt-2 grid grid-cols-1 gap-2 text-sm text-zinc-300 sm:grid-cols-2 sm:gap-4">
							<div>
								<span class="text-primary-light">Cultivar:</span>
								{bean.cultivar_detail || '-'}
							</div>
							<div>
								<span class="text-primary-light">Processing:</span>
								{bean.processing || '-'}
							</div>
							<div>
								<span class="text-primary-light">Purchase:</span>
								{bean.purchase_date || '-'}
							</div>
							<div>
								<span class="text-primary-light">Arrival:</span>
								{bean.arrival_date || '-'}
							</div>
						</div>
					</button>
				{/each}
			</div>
		{/if}
	</div>
</div>
