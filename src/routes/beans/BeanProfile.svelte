<script lang="ts">
	import { prepareDateForAPI } from '$lib/utils/dates';

	let { selectedBean, role, onUpdate, onDelete } = $props<{
		selectedBean: any;
		role?: 'viewer' | 'member' | 'admin';
		onUpdate: (bean: any) => void;
		onDelete: (id: number) => void;
	}>();

	let isEditing = $state(false);
	let editedBean = $state({ ...selectedBean });
	let currentPage = $state(0);
	const totalPages = 2;
	let processingUpdate = $state(false);
	let lastSelectedBeanId = $state<number | null>(null);

	let previousPage = $state(0);

	function slideTransition(_: Element, { duration = 300, direction = 1, delay = 0 }) {
		return {
			duration,
			delay,
			css: (t: number) => `
				transform: translateX(${direction * (1 - t) * 100}%);
				position: relative;
				z-index: 0;
			`
		};
	}

	function goToPage(pageIndex: number) {
		const current = currentPage;
		previousPage = current;
		currentPage = pageIndex;
	}

	let slideDirection = $derived(currentPage > previousPage ? 1 : -1);

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

	// Add safe update function with guard and memoization
	$effect(() => {
		// Skip if we're already processing or if the bean hasn't changed
		if (
			processingUpdate ||
			(lastSelectedBeanId === selectedBean?.id && lastSelectedBeanId !== null)
		) {
			return;
		}

		// Only update editedBean when selectedBean changes
		if (selectedBean) {
			processingUpdate = true;
			//	console.log('BeanProfile: Updating from selectedBean change:', selectedBean.id);

			// Track the bean ID we're processing
			lastSelectedBeanId = selectedBean.id;

			// Use setTimeout to break potential update cycles
			setTimeout(() => {
				try {
					// Deep clone to avoid reference issues
					editedBean = JSON.parse(JSON.stringify(selectedBean));
				} finally {
					processingUpdate = false;
				}
			}, 50);
		}
	});

	async function saveChanges() {
		if (processingUpdate) return;

		try {
			processingUpdate = true;
			const dataForAPI = {
				...editedBean,
				purchase_date: prepareDateForAPI(editedBean.purchase_date),
				last_updated: new Date().toISOString()
			};

			const response = await fetch(`/api/data?id=${selectedBean.id}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(dataForAPI)
			});

			if (response.ok) {
				const updatedBean = await response.json();
				isEditing = false;
				setTimeout(() => {
					onUpdate(updatedBean);
					processingUpdate = false;
				}, 50);
			} else {
				const data = await response.json();
				alert(`Failed to update bean: ${data.error}`);
				processingUpdate = false;
			}
		} catch (error) {
			console.error('Error updating bean:', error);
			processingUpdate = false;
		}
	}

	// Function to handle deletion
	async function deleteBean() {
		if (processingUpdate) return;

		if (
			confirm(
				'Are you sure you want to delete this bean? This will also delete all associated roast profiles and logs.'
			)
		) {
			try {
				processingUpdate = true;
				onDelete(selectedBean.id);
				setTimeout(() => {
					processingUpdate = false;
				}, 50);
			} catch (error) {
				console.error('Error during bean deletion:', error);
				processingUpdate = false;
			}
		}
	}
</script>

<div class="rounded-lg border border-border-light bg-background-secondary-light p-6 shadow-md">
	<div class="mb-4">
		<div class="flex items-center justify-between">
			<h2 class="text-xl font-bold text-text-primary-light">{selectedBean.name}</h2>
		</div>

		<!-- Moved page selection dots here -->
		<div class="mt-4 flex items-center justify-center gap-2">
			{#each Array(totalPages) as _, i}
				<button
					class="h-3 w-3 rounded-full transition-all duration-300 {i === currentPage
						? 'scale-110 bg-background-tertiary-light'
						: 'border border-border-light bg-background-primary-light hover:bg-border-light'}"
					onclick={() => goToPage(i)}
					aria-label="Go to page {i + 1}"
				></button>
			{/each}
		</div>
	</div>

	<div class="relative min-h-[400px]">
		{#key currentPage}
			<div
				class="grid grid-cols-2 gap-4"
				in:slideTransition={{ direction: slideDirection, delay: 50 }}
			>
				{#if currentPage === 0}
					{#each ['score_value', 'rank', 'description_short', 'notes', 'purchase_date', 'arrival_date', 'purchased_qty_lbs', 'bean_cost', 'tax_ship_cost', 'last_updated'] as key}
						{#if selectedBean[key] !== undefined}
							<div
								class="rounded border border-border-light bg-background-secondary-light p-2 {[
									'notes',
									'description_short'
								].includes(key)
									? 'col-span-2'
									: ''}"
							>
								<span class="text-primary-light font-medium"
									>{key.replace(/_/g, ' ').toUpperCase()}:</span
								>
								{#if isEditing && key !== 'id' && key !== 'last_updated'}
									{#if key === 'notes'}
										<textarea
											class="ml-2 w-full rounded bg-background-primary-light px-2 py-1 text-text-primary-light"
											rows="4"
											bind:value={editedBean[key]}
										></textarea>
									{:else if key === 'rank'}
										<input
											type="number"
											min="1"
											max="10"
											step="1"
											class="ml-2 rounded bg-background-primary-light px-2 py-1 text-text-primary-light"
											bind:value={editedBean[key]}
										/>
									{:else if key === 'link'}
										<input
											type="url"
											class="ml-2 rounded bg-background-primary-light px-2 py-1 text-text-primary-light"
											bind:value={editedBean[key]}
										/>
									{:else if key === 'bean_cost' || key === 'tax_ship_cost'}
										<input
											type="number"
											step="0.01"
											min="0"
											class="ml-2 rounded bg-background-primary-light px-2 py-1 text-text-primary-light"
											bind:value={editedBean[key]}
										/>
									{:else}
										<input
											type={typeof selectedBean[key] === 'number' ? 'number' : 'text'}
											class="ml-2 rounded bg-background-primary-light px-2 py-1 text-text-primary-light"
											bind:value={editedBean[key]}
										/>
									{/if}
								{:else}
									<span
										class="ml-2 text-text-primary-light {key === 'notes'
											? 'zinc-300 space-pre-wrap block'
											: ''}"
									>
										{#if key === 'bean_cost' || key === 'tax_ship_cost'}
											${typeof selectedBean[key] === 'number'
												? selectedBean[key].toFixed(2)
												: selectedBean[key]}
										{:else if key === 'link'}
											{#if selectedBean[key] && typeof selectedBean[key] === 'string'}
												<a
													href={selectedBean[key]}
													target="_blank"
													class="text-blue-400 hover:underline">{selectedBean[key]}</a
												>
											{/if}
										{:else if key === 'rank'}
											{typeof selectedBean[key] === 'number'
												? Math.round(selectedBean[key])
												: selectedBean[key]}
										{:else}
											{selectedBean[key]}
										{/if}
									</span>
								{/if}
							</div>
						{/if}
					{/each}
				{:else}
					{#each Object.entries(selectedBean) as [key, value]}
						{#if !['score_value', 'rank', 'notes', 'purchase_date', 'arrival_date', 'last_updated', 'purchased_qty_lbs', 'bean_cost', 'tax_ship_cost', 'description_short', 'id'].includes(key)}
							<div class="rounded border border-border-light bg-background-secondary-light p-2">
								<span class="text-primary-light font-medium"
									>{key.replace(/_/g, ' ').toUpperCase()}:</span
								>
								{#if isEditing && key !== 'id' && key !== 'last_updated'}
									{#if key === 'notes'}
										<textarea
											class="ml-2 w-full rounded bg-background-primary-light px-2 py-1 text-text-primary-light"
											rows="4"
											bind:value={editedBean[key]}
										></textarea>
									{:else if key === 'rank'}
										<input
											type="number"
											min="1"
											max="10"
											step="1"
											class="ml-2 rounded bg-background-primary-light px-2 py-1 text-text-primary-light"
											bind:value={editedBean[key]}
										/>
									{:else if key === 'link'}
										<input
											type="url"
											class="ml-2 rounded bg-background-primary-light px-2 py-1 text-text-primary-light"
											bind:value={editedBean[key]}
										/>
									{:else if key === 'bean_cost' || key === 'tax_ship_cost'}
										<input
											type="number"
											step="0.01"
											min="0"
											class="ml-2 rounded bg-background-primary-light px-2 py-1 text-text-primary-light"
											bind:value={editedBean[key]}
										/>
									{:else}
										<input
											type={typeof value === 'number' ? 'number' : 'text'}
											class="ml-2 rounded bg-background-primary-light px-2 py-1 text-text-primary-light"
											bind:value={editedBean[key]}
										/>
									{/if}
								{:else}
									<span
										class="ml-2 text-text-primary-light {key === 'notes'
											? 'zinc-300space-pre-wrap block'
											: ''}"
									>
										{#if key === 'bean_cost' || key === 'tax_ship_cost'}
											${typeof value === 'number' ? value.toFixed(2) : value}
										{:else if key === 'link'}
											{#if value && typeof value === 'string'}
												<a href={value} target="_blank" class="text-blue-400 hover:underline"
													>{value}</a
												>
											{/if}
										{:else if key === 'rank'}
											{typeof value === 'number' ? Math.round(value) : value}
										{:else}
											{value}
										{/if}
									</span>
								{/if}
							</div>
						{/if}
					{/each}
				{/if}
			</div>
		{/key}
	</div>
	{#if role === 'admin' || role === 'member'}
		<div class="my-4 flex justify-end space-x-2">
			<button
				class="rounded {isEditing
					? 'border-2 border-green-800 hover:bg-green-900'
					: 'border-2 border-blue-800 hover:bg-blue-900'} px-3 py-1 text-text-primary-light"
				onclick={toggleEdit}
			>
				{isEditing ? 'Save' : 'Edit'}
			</button>
			<button
				class="rounded border-2 border-red-800 px-3 py-1 text-text-primary-light hover:bg-red-900"
				onclick={deleteBean}
			>
				Delete
			</button>
		</div>
	{/if}
</div>
