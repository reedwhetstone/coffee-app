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

	// Reactive variable to control the visibility of the table
	let isHidden = true;

	// Function to toggle the visibility
	const toggleTable = () => {
		isHidden = !isHidden;
	};

	// Add these new imports
	import BeanForm from './BeanForm.svelte';
	import BeanProfile from './BeanProfile.svelte';

	let isFormVisible = false;
	let selectedBean: (typeof data.data)[0] | null = null;

	// Initialize selectedBean with the first bean (ID 1)
	$: selectedBean = data.data.find((bean) => bean.id === 1) || data.data[0];

	// Function to handle bean deletion
	async function deleteBean(id: number) {
		if (confirm('Are you sure you want to delete this bean?')) {
			try {
				const response = await fetch(`/api/beans/${id}`, {
					method: 'DELETE'
				});
				if (response.ok) {
					// Refresh the data or remove from local state
					data.data = data.data.filter((bean) => bean.id !== id);
				}
			} catch (error) {
				console.error('Error deleting bean:', error);
			}
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
	}
</script>

<div class="m-4">
	<!-- Add New Bean Button -->
	<button
		class="mb-4 rounded bg-green-600 p-2 text-white hover:bg-green-700"
		on:click={() => {
			selectedBean = null;
			isFormVisible = true;
		}}
	>
		Add New Bean
	</button>

	<!-- Bean Profile Section -->
	{#if selectedBean}
		<div class="mb-4">
			<BeanProfile {selectedBean} />
		</div>
	{/if}

	<!-- Form Modal -->
	{#if isFormVisible}
		<div class="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
			<div class="w-full max-w-2xl rounded-lg bg-gray-800 p-6">
				<BeanForm
					bean={selectedBean}
					onClose={() => (isFormVisible = false)}
					onSubmit={(updatedBean) => {
						isFormVisible = false;
						// Refresh data after submission
					}}
				/>
			</div>
		</div>
	{/if}

	<!-- Existing table code -->
	<div id="green-coffee-inv-table" class="overflow-x-auto">
		<!-- Button to toggle visibility -->
		<button class="m-2 rounded bg-gray-700 p-2 text-white" on:click={toggleTable}>
			{isHidden ? 'Show Table' : 'Hide Table'}
		</button>

		<!-- Table with a reactive class binding -->
		{#if data.data.length > 0}
			<table class:hidden={isHidden} class="table-auto rounded">
				<thead class="bg-gray-700 text-xs uppercase text-gray-400">
					<tr>
						{#each Object.keys(data.data[0] || {}) as header}
							<th class="px-6 py-3">
								{header.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each data.data as bean}
						<tr
							class="cursor-pointer border-b border-gray-700 bg-gray-800 transition-colors hover:bg-gray-700 {selectedBean?.id ===
							bean.id
								? 'bg-gray-700'
								: ''}"
							on:click={() => selectBean(bean)}
						>
							{#each Object.values(bean) as value}
								<td class="whitespace-nowrap text-balance px-6 py-4 text-xs text-white">
									{value}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		{:else}
			<p class="text-white">No data available</p>
		{/if}
	</div>
</div>
