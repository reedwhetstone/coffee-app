<script lang="ts">
	export let selectedBean: any;

	let isEditing = false;
	let editedBean = { ...selectedBean }; // Create a copy for editing

	// Function to handle editing
	function toggleEdit() {
		if (isEditing) {
			// Save changes
			saveChanges();
		} else {
			// Enter edit mode
			editedBean = { ...selectedBean };
			isEditing = true;
		}
	}

	async function saveChanges() {
		try {
			const cleanedBean = Object.fromEntries(
				Object.entries(editedBean).map(([key, value]) => [
					key,
					value === '' || value === undefined ? null : value
				])
			);

			cleanedBean.last_updated = new Date().toISOString();

			const response = await fetch(`/api/data?id=${selectedBean.id}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(cleanedBean)
			});

			if (response.ok) {
				const updatedBean = await response.json();
				selectedBean = updatedBean;
				isEditing = false;
				dispatch('update', updatedBean);
			} else {
				const data = await response.json();
				alert(`Failed to update bean: ${data.error}`);
			}
		} catch (error) {
			console.error('Error updating bean:', error);
		}
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
				class="rounded {isEditing
					? 'bg-green-600 hover:bg-green-700'
					: 'bg-blue-600 hover:bg-blue-700'} px-3 py-1 text-white"
				on:click={toggleEdit}
			>
				{isEditing ? 'Save' : 'Edit'}
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
				{#if isEditing && key !== 'id' && key !== 'last_updated'}
					<input
						type={typeof value === 'number' ? 'number' : 'text'}
						class="ml-2 rounded bg-gray-600 px-2 py-1 text-white"
						bind:value={editedBean[key]}
					/>
				{:else}
					<span class="ml-2 text-white">{value}</span>
				{/if}
			</div>
		{/each}
	</div>
</div>
