<script lang="ts">
	import type { Database } from '$lib/types/database.types';

	type PageData = {
		searchState?: {
			searchType?: 'green';
			searchId?: number;
		};
		data: Database['public']['Tables']['green_coffee_inv']['Row'][];
		role?: 'viewer' | 'member' | 'admin';
	};

	let { data } = $props<{ data: PageData }>();

	// Add these new imports
	import BeanForm from './BeanForm.svelte';
	import BeanProfile from './BeanProfile.svelte';
	import { onMount } from 'svelte';
	import { navbarActions } from '$lib/stores/navbarStore';
	import { get } from 'svelte/store';
	import { page } from '$app/stores';

	let isFormVisible = $state(false);
	let selectedBean = $state<any>(null);

	// Add this state variable at the top of the script section with other state variables
	let expandedFilters = $state(false);

	// Function to load data
	async function loadData() {
		try {
			// Get share token from URL if it exists
			const shareToken = $page.url.searchParams.get('share');
			const url = shareToken ? `/api/data?share=${shareToken}` : '/api/data';

			const response = await fetch(url);
			if (response.ok) {
				const result = await response.json();
				// Preserve the role and searchState when updating data
				data = {
					data: result.data,
					searchState: data.searchState,
					role: data.role
				};
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
			// First clear the selected bean to prevent any additional API calls with the deleted ID
			selectedBean = null;

			// Store the current purchase date filter before deletion
			const currentPurchaseDate = filters.purchase_date;

			const response = await fetch(`/api/data?id=${id}`, {
				method: 'DELETE'
			});

			if (response.ok) {
				// Only reload data after we've confirmed the deletion was successful
				await loadData();

				// After reloading data, check if there are any beans with the current purchase date
				if (currentPurchaseDate) {
					const beansWithSamePurchaseDate = data.data.filter(
						(bean: Database['public']['Tables']['green_coffee_inv']['Row']) =>
							bean.purchase_date === currentPurchaseDate
					);

					// If no beans match the current filter, reset the filter
					if (beansWithSamePurchaseDate.length === 0) {
						filters.purchase_date = '';
						selectedPurchaseDate = null;
					}
				}
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
		// Smooth scroll to top
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	// Add these new variables for sorting and filtering
	let sortField = $state<string | null>('purchase_date');
	let sortDirection = $state<'asc' | 'desc' | null>('desc');
	let selectedPurchaseDate = $state<string | null>(null);

	// Computed sorted and filtered data
	let sortedData = $derived(
		[...data.data]
			.sort((a, b) => {
				if (!sortField || !sortDirection) return 0;

				const aVal = a[sortField as keyof typeof a];
				const bVal = b[sortField as keyof typeof b];

				if (sortField === 'purchase_date') {
					if (!sortDirection) return 0;
					const aStr = String(aVal);
					const bStr = String(bVal);
					if (sortDirection === 'asc') return aStr.localeCompare(bStr);
					return bStr.localeCompare(aStr);
				}

				if (typeof aVal === 'string' && typeof bVal === 'string') {
					return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
				}

				return sortDirection === 'asc' ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
			})
			.filter((bean) => {
				if (selectedPurchaseDate === null) {
					return true; // Show all beans when no date is selected
				}
				return bean.purchase_date === selectedPurchaseDate;
			})
	);

	async function handleFormSubmit(
		newBean: Database['public']['Tables']['green_coffee_inv']['Row']
	) {
		await loadData();
		selectedBean = null;
		setTimeout(() => {
			selectedBean = newBean;
		}, 0);
	}

	// Update handleBeanUpdate to use loadData
	async function handleBeanUpdate(
		updatedBean: Database['public']['Tables']['green_coffee_inv']['Row']
	) {
		await loadData();
		selectedBean = updatedBean;
	}

	// Initialize selectedBean with proper data loading
	onMount(() => {
		// First load the data
		loadData().then(() => {
			// Set default purchase date to the first date in uniquePurchaseDates
			if (uniquePurchaseDates.length > 0) {
				filters.purchase_date = uniquePurchaseDates[0];
			}

			// Check for search state on initial load
			const searchState = $page.state as any;
			if (searchState?.searchType === 'green' && searchState?.searchId) {
				const foundBean = data.data.find(
					(bean: Database['public']['Tables']['green_coffee_inv']['Row']) =>
						bean.id === searchState.searchId
				);
				if (foundBean) {
					selectedBean = foundBean;
					selectedPurchaseDate = null;
					window.scrollTo({ top: 0, behavior: 'smooth' });
				}
			}
		});

		// Set up navbar actions
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
						selectedPurchaseDate = null;
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

	// Add type at the top with other types
	type PageState = {
		searchType?: 'green';
		searchId?: number;
	};

	// Add these new variables and functions
	let filters = $state<Record<string, any>>({
		name: '',
		score_value: { min: '', max: '' },
		rank: '',
		cultivar_detail: '',
		processing: '',
		vendor: '',
		price_per_lb: '',
		purchase_date: '',
		arrival_date: ''
	});

	function getFilterableColumns(): string[] {
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
	}

	// Update the sorted and filtered data computation
	let filteredAndSortedData = $derived(
		sortedData.filter((item) => {
			return Object.entries(filters).every(([key, value]) => {
				if (!value) return true;
				const itemValue = item[key as keyof typeof item];

				// Special handling for score
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
		})
	);

	// Add this computed property for unique purchase dates
	let uniquePurchaseDates = $derived(
		Array.from(
			new Set(
				data.data.map(
					(bean: Database['public']['Tables']['green_coffee_inv']['Row']) => bean.purchase_date
				)
			)
		)
			.filter((date): date is string => typeof date === 'string') // Remove null/undefined values
			.sort((a, b) => b.localeCompare(a)) // Sort descending
	);

	$effect(() => {
		console.log('Current data:', data);
	});
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
			<div class="bg-background-secondary-light w-full max-w-2xl rounded-lg p-4 md:p-6">
				<BeanForm bean={null} onClose={() => (isFormVisible = false)} onSubmit={handleFormSubmit} />
			</div>
		</div>
	{/if}

	<!-- Main content section -->
	<div class="mx-2 mt-4 flex flex-col gap-4 md:mx-8 md:mt-8 md:flex-row">
		<!-- Filter Panel -->
		<div class="bg-background-secondary-light w-full rounded-lg p-4 md:w-64 md:flex-shrink-0">
			<div class="flex items-center justify-between">
				<h3 class="text-secondary-light text-lg font-semibold">Filters</h3>
				<button
					class="text-primary-light hover:text-secondary-light text-sm md:hidden"
					onclick={() => (expandedFilters = !expandedFilters)}
				>
					{expandedFilters ? 'Hide Filters' : 'Show Filters'}
				</button>
			</div>

			<!-- Wrap filter controls in a conditional display div -->
			<div class={`space-y-4 ${expandedFilters ? 'block' : 'hidden'} md:block`}>
				<!-- Sort Controls -->
				<div class="space-y-2">
					<label for="sort-field" class="text-primary-light block text-sm">Sort by</label>
					<select
						id="sort-field"
						bind:value={sortField}
						class="bg-background-tertiary-light text-secondary-light w-full rounded p-2 text-sm"
					>
						<option value={null}>None</option>
						{#each getFilterableColumns() as column}
							<option value={column}>
								{column.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
							</option>
						{/each}
					</select>

					{#if sortField}
						<select
							id="sort-direction"
							bind:value={sortDirection}
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
								{column.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
							</label>
							{#if column === 'purchase_date'}
								<select
									bind:value={filters[column]}
									class="bg-background-tertiary-light text-secondary-light w-full rounded p-2 text-sm"
								>
									<option value="">All Dates</option>
									{#each uniquePurchaseDates as date}
										<option value={date}>{date}</option>
									{/each}
								</select>
							{:else if column === 'score_value'}
								<div class="flex gap-2">
									<input
										type="number"
										bind:value={filters.score_value.min}
										class="bg-background-tertiary-light text-secondary-light w-full rounded p-2 text-sm"
										placeholder="Min"
										min="0"
										max="100"
										step="0.1"
									/>
									<input
										type="number"
										bind:value={filters.score_value.max}
										class="bg-background-tertiary-light text-secondary-light w-full rounded p-2 text-sm"
										placeholder="Max"
										min="0"
										max="100"
										step="0.1"
									/>
								</div>
							{:else}
								<input
									type="text"
									bind:value={filters[column]}
									class="bg-background-tertiary-light text-secondary-light w-full rounded p-2 text-sm"
									placeholder={`Filter by ${column}`}
								/>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		</div>

		<!-- Coffee Cards -->
		<div class="flex-1">
			{#if !data?.data || data.data.length === 0}
				<p class="p-4 text-zinc-300">No coffee data available</p>
			{:else}
				<div class="space-y-2 md:space-y-4">
					{#each filteredAndSortedData as bean}
						<button
							type="button"
							class="bg-background-secondary-light hover:bg-background-tertiary-light w-full cursor-pointer rounded-lg p-3 text-left transition-colors md:p-4"
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
							<div
								class="mt-2 grid grid-cols-1 gap-2 text-sm text-zinc-300 sm:grid-cols-2 sm:gap-4"
							>
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
</div>
