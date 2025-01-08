<script lang="ts">
	export let selectedBean: any;
	export let onUpdate: (bean: any) => void;
	export let onDelete: (id: number) => void;

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
				onUpdate(updatedBean);
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
					onDelete(selectedBean.id);
				} else {
					alert(`Failed to delete bean: ${selectedBean.id}`);
				}
			} catch (error) {
				console.error('Error deleting bean:', error);
			}
		}
	}
</script>

<div class="rounded-lg bg-zinc-800 p-6">
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-xl font-bold text-zinc-300">{selectedBean.name}</h2>
		<div class="space-x-2">
			<button class="rounded border-2 border-zinc-500 px-3 py-1 text-zinc-500 hover:bg-zinc-600"
				>New Roast</button
			>
			<button class="rounded border-2 border-zinc-500 px-3 py-1 text-zinc-500 hover:bg-zinc-600"
				>Roast Sessions</button
			>
		</div>
	</div>

	<div class="grid grid-cols-2 gap-4">
		{#each Object.entries(selectedBean) as [key, value]}
			<div class="rounded bg-zinc-700 p-2 {key === 'notes' ? 'col-span-2' : ''}">
				<span class="font-medium text-zinc-400">{key.replace(/_/g, ' ').toUpperCase()}:</span>
				{#if isEditing && key !== 'id' && key !== 'last_updated'}
					{#if key === 'notes'}
						<textarea
							class="ml-2 w-full rounded bg-zinc-600 px-2 py-1 text-zinc-300"
							rows="4"
							bind:value={editedBean[key]}
						></textarea>
					{:else if key === 'rank'}
						<input
							type="number"
							min="1"
							max="10"
							step="1"
							class="ml-2 rounded bg-zinc-600 px-2 py-1 text-zinc-300"
							bind:value={editedBean[key]}
						/>
					{:else if key === 'link'}
						<input
							type="url"
							class="ml-2 rounded bg-zinc-600 px-2 py-1 text-zinc-300"
							bind:value={editedBean[key]}
						/>
					{:else if key === 'bean_cost' || key === 'tax_ship_cost'}
						<input
							type="number"
							step="0.01"
							min="0"
							class="ml-2 rounded bg-zinc-600 px-2 py-1 text-zinc-300"
							bind:value={editedBean[key]}
						/>
					{:else}
						<input
							type={typeof value === 'number' ? 'number' : 'text'}
							class="ml-2 rounded bg-zinc-600 px-2 py-1 text-zinc-300"
							bind:value={editedBean[key]}
						/>
					{/if}
				{:else}
					<span class="ml-2 text-zinc-300 {key === 'notes' ? 'zinc-300space-pre-wrap block' : ''}">
						{#if key === 'bean_cost' || key === 'tax_ship_cost'}
							${typeof value === 'number' ? value.toFixed(2) : value}
						{:else if key === 'link'}
							{#if value && typeof value === 'string'}
								<a href={value} target="_blank" class="text-blue-400 hover:underline">{value}</a>
							{/if}
						{:else if key === 'rank'}
							{typeof value === 'number' ? Math.round(value) : value}
						{:else}
							{value}
						{/if}
					</span>
				{/if}
			</div>
		{/each}
	</div>
	<div class="mb-4 flex justify-end space-x-2">
		<button
			class="rounded {isEditing
				? 'border-2 border-green-800 hover:bg-green-900'
				: 'border-2 border-blue-800 hover:bg-blue-900'} px-3 py-1 text-zinc-500"
			on:click={toggleEdit}
		>
			{isEditing ? 'Save' : 'Edit'}
		</button>
		<button
			class="rounded border-2 border-red-800 px-3 py-1 text-zinc-500 hover:bg-red-900"
			on:click={deleteBean}
		>
			Delete
		</button>
	</div>
</div>
