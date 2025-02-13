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

	// Function to load data
	async function loadData() {
		try {
			const response = await fetch('/api/data');
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
			const response = await fetch(`/api/data?id=${id}`, {
				method: 'DELETE'
			});
			if (response.ok) {
				// Update local state
				data.data = data.data.filter(
					(bean: Database['public']['Tables']['green_coffee_inv']['Row']) => bean.id !== id
				);
				// Clear selected bean since it's been deleted
				selectedBean = null;
			}
		} catch (error) {
			console.error('Error deleting bean:', error);
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

	// Add the missing toggleSort function
	function toggleSort(field: string) {
		if (sortField === field) {
			if (sortDirection === 'asc') sortDirection = 'desc';
			else if (sortDirection === 'desc') {
				sortField = null;
				sortDirection = null;
			}
		} else {
			sortField = field;
			sortDirection = 'asc';
		}
	}

	// Add type at the top with other types
	type PageState = {
		searchType?: 'green';
		searchId?: number;
	};
</script>

<div class="m-4">
	<!-- Bean Profile Section -->
	{#if data.role === 'admin'}
		<div class="mb-4 flex justify-end">
			<button
				class="rounded border-2 border-green-800 px-3 py-1 text-zinc-500 hover:bg-green-900"
				onclick={handleAddNewBean}
			>
				New Bean
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
		<div class="fixed inset-0 flex items-center justify-center bg-black bg-opacity-75">
			<div class="w-full max-w-2xl rounded-lg bg-zinc-800 p-6">
				<BeanForm bean={null} onClose={() => (isFormVisible = false)} onSubmit={handleFormSubmit} />
			</div>
		</div>
	{/if}

	<!-- Existing table code -->
	<div id="green-coffee-inv-table" class="overflow-x-auto">
		<div class="mb-4 flex items-center justify-end gap-4">
			<select
				class="m-1 rounded bg-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-600"
				bind:value={selectedPurchaseDate}
			>
				<option value={null}>Show All Dates</option>
				{#each [...new Set(data.data.map((bean: Database['public']['Tables']['green_coffee_inv']['Row']) => bean.purchase_date))]
					.sort()
					.reverse() as date}
					<option value={date}
						>{typeof date === 'string' ? new Date(date).toLocaleDateString() : ''}</option
					>
				{/each}
			</select>
		</div>
		<!-- Table with a reactive class binding -->
		{#if data.data.length > 0}
			<div class="overflow-hidden overflow-x-auto rounded-lg">
				<table class="table-auto bg-zinc-800">
					<thead class="bg-zinc-700 text-xs uppercase text-zinc-400">
						<tr>
							{#each Object.keys(data.data[0] || ({} as Record<string, unknown>)) as header}
								<th
									onclick={() => toggleSort(header)}
									class="group max-w-[200px] cursor-pointer px-6 py-3 hover:bg-zinc-600"
								>
									<div class="flex items-center gap-2">
										<span class="truncate">
											{header.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
										</span>

										<!-- Sort indicators -->
										{#if sortField === header}
											{#if sortDirection === 'asc'}
												<span class="flex-shrink-0">↑</span>
											{:else if sortDirection === 'desc'}
												<span class="flex-shrink-0">↓</span>
											{/if}
										{:else}
											<span class="flex-shrink-0 opacity-0 group-hover:opacity-50">↕</span>
										{/if}
									</div>
								</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each sortedData as bean}
							<tr
								class="cursor-pointer border-b border-zinc-700 bg-zinc-800 transition-colors hover:bg-zinc-700 {selectedBean?.id ===
								bean.id
									? 'bg-zinc-700'
									: ''}"
								onclick={() => selectBean(bean)}
							>
								{#each Object.entries(bean) as [key, value]}
									<td class="max-w-[200px] px-6 py-4 text-xs text-zinc-300">
										<div class="break-words">
											{String(value).length > 250 ? String(value).slice(0, 250) + '...' : value}
										</div>
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<p class="text-zinc-300">No data available</p>
		{/if}
	</div>
</div>
