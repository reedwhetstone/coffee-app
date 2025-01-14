<script lang="ts">
	export let data: {
		data: {
			id: number;
			name: string;
			rank: number;
			notes: string;
			purchase_date: string;
			arrival_date: string;
			region: string;
			processing: string;
			drying_method: string;
			lot_size: string;
			bag_size: string;
			packaging: string;
			farm_gate: string;
			cultivar_detail: string;
			grade: string;
			appearance: string;
			roast_recs: string;
			type: string;
			link: string;
			purchased_qty_lbs: number;
			bean_cost: number;
			tax_ship_cost: number;
		}[];
	};

	// Add these new imports
	import BeanForm from './BeanForm.svelte';
	import BeanProfile from './BeanProfile.svelte';

	let isFormVisible = false;
	let selectedBean: any = null;

	// Function to handle bean deletion
	async function deleteBean(id: number) {
		try {
			const response = await fetch(`/api/data?id=${id}`, {
				method: 'DELETE'
			});
			if (response.ok) {
				// Update local state
				data.data = data.data.filter((bean) => bean.id !== id);
				// Clear selected bean since it's been deleted
				selectedBean = null;
			}
		} catch (error) {
			console.error('Error deleting bean:', error);
		}
	}

	// Function to handle editing
	function editBean(bean: (typeof data.data)[0]) {
		selectedBean = bean;
		isFormVisible = true;
	}

	// Function to handle row selection
	function selectBean(bean: (typeof data.data)[0]) {
		selectedBean = bean;
		// Smooth scroll to top
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	// Add these new variables for sorting and filtering
	let sortField: string | null = 'purchase_date';
	let sortDirection: 'asc' | 'desc' | null = 'desc';
	let filterByLatestPurchase = true;
	let selectedPurchaseDate: string | null = null;

	// Computed sorted and filtered data
	$: sortedData = [...data.data]
		.sort((a, b) => {
			if (!sortField || !sortDirection) return 0;

			const aVal = a[sortField as keyof typeof a];
			const bVal = b[sortField as keyof typeof b];

			if (sortField === 'purchase_date') {
				if (!sortDirection) return 0;
				if (sortDirection === 'asc') return aVal.localeCompare(bVal);
				return bVal.localeCompare(aVal);
			}

			if (typeof aVal === 'string' && typeof bVal === 'string') {
				return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
			}

			return sortDirection === 'asc' ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
		})
		.filter((bean) => {
			if (!selectedPurchaseDate) {
				if (!filterByLatestPurchase) return true;
				const mostRecent = Math.max(...data.data.map((b) => new Date(b.purchase_date).getTime()));
				return new Date(bean.purchase_date).getTime() === mostRecent;
			}
			return bean.purchase_date === selectedPurchaseDate;
		});

	async function handleFormSubmit(newBean: any) {
		// Refresh the data
		const response = await fetch('/api/data');
		data = await response.json();

		// Set the newly created bean as selected and ensure it triggers the profile update
		selectedBean = null; // Force a re-render by clearing first
		setTimeout(() => {
			// Use setTimeout to ensure the DOM updates
			selectedBean = newBean;
		}, 0);
	}

	// Update this function to properly handle the bean update
	async function handleBeanUpdate(updatedBean: any) {
		// Update the local data array
		data.data = data.data.map((bean) => (bean.id === updatedBean.id ? updatedBean : bean));
		// Update selectedBean to trigger UI refresh
		selectedBean = updatedBean;
	}

	// Initialize selectedBean with the newest bean by purchase date
	import { onMount } from 'svelte';
	import { navbarActions } from '$lib/stores/navbarStore';

	onMount(() => {
		if (!selectedBean) {
			selectedBean = [...data.data].sort(
				(a, b) => new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime()
			)[0];
		}
	});

	function handleAddNewBean() {
		selectedBean = null;
		isFormVisible = true;
	}

	onMount(() => {
		navbarActions.set({
			onAddNewBean: handleAddNewBean
		});

		return () => {
			// Reset when component is destroyed
			navbarActions.set({
				onAddNewBean: () => {}
			});
		};
	});
</script>

<div class="m-4">
	<!-- Bean Profile Section -->
	{#if selectedBean}
		<div class="mb-4">
			<BeanProfile
				{selectedBean}
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
				class="rounded bg-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-600"
				bind:value={selectedPurchaseDate}
			>
				<option value={null}>All Purchase Dates</option>
				{#each [...new Set(data.data.map((bean) => bean.purchase_date))].sort().reverse() as date}
					<option value={date}>{new Date(date).toLocaleDateString()}</option>
				{/each}
			</select>

			<!-- ... existing code ... -->
		</div>
		<!-- Table with a reactive class binding -->
		{#if data.data.length > 0}
			<div class="overflow-hidden overflow-x-auto rounded-lg">
				<table class="table-auto bg-zinc-800">
					<thead class="bg-zinc-700 text-xs uppercase text-zinc-400">
						<tr>
							{#each Object.keys(data.data[0] || {}) as header}
								<th
									class="group cursor-pointer px-6 py-3 hover:bg-zinc-600"
									on:click={() => toggleSort(header)}
								>
									<div class="flex items-center gap-2">
										{header.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}

										<!-- Sort indicators -->
										{#if sortField === header}
											{#if sortDirection === 'asc'}
												<span>↑</span>
											{:else if sortDirection === 'desc'}
												<span>↓</span>
											{/if}
										{:else}
											<span class="opacity-0 group-hover:opacity-50">↕</span>
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
								on:click={() => selectBean(bean)}
							>
								{#each Object.entries(bean) as [key, value]}
									<td class="whitespace-nowrap px-6 py-4 text-xs text-zinc-300">
										{value}
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
