<script lang="ts">
	export let selectedBean: any;
	export let closeProfile: () => void;

	// Function to handle editing
	function editBean() {
		// Dispatch an event to parent to handle editing
		dispatch('edit', selectedBean);
	}

	// Function to handle deletion
	async function deleteBean() {
		if (confirm('Are you sure you want to delete this bean?')) {
			try {
				const response = await fetch(`/api/data?id=${selectedBean.id}`, {
					method: 'DELETE'
				});

				if (response.ok) {
					dispatch('delete', selectedBean.id);
				} else {
					alert(`Failed to delete bean: ${data.error}`);
				}
			} catch (error) {
				console.error('Error deleting bean:', error);
			}
		}
	}

	import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();
</script>

<div class="rounded-lg bg-gray-800 p-6">
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-xl font-bold text-white">{selectedBean.name}</h2>
		<div class="space-x-2">
			<button
				class="rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700"
				on:click={editBean}
			>
				Edit
			</button>
			<button
				class="rounded bg-red-600 px-3 py-1 text-white hover:bg-red-700"
				on:click={deleteBean}
			>
				Delete
			</button>
		</div>
	</div>

	<div class="grid grid-cols-2 gap-4">
		{#each Object.entries(selectedBean) as [key, value]}
			<div class="rounded bg-gray-700 p-2">
				<span class="font-medium text-gray-400">{key.replace(/_/g, ' ').toUpperCase()}:</span>
				<span class="ml-2 text-white">{value}</span>
			</div>
		{/each}
	</div>
</div>
