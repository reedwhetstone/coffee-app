<script lang="ts">
	import { onMount } from 'svelte';
	import { formatDateForDisplay, prepareDateForAPI } from '$lib/utils/dates';

	// Replace event dispatcher with callback props
	let { onClose, onSubmit, selectedBean } = $props<{
		onClose: () => void;
		onSubmit: (data: any) => void;
		selectedBean: any;
	}>();

	let availableCoffees = $state<any[]>([]);

	// Fetch available coffees on component mount
	async function loadCoffees() {
		try {
			const response = await fetch('/api/data');
			if (response.ok) {
				const data = await response.json();
				availableCoffees = data.data;
			}
		} catch (error) {
			console.error('Error loading coffees:', error);
		}
	}

	loadCoffees();

	let formData = {
		batch_name: selectedBean
			? `${selectedBean.name} Batch - ${new Date().toLocaleDateString()}`
			: '',
		coffee_id: selectedBean?.id || '',
		coffee_name: selectedBean?.name || '',
		roast_date: prepareDateForAPI(new Date().toISOString()),
		oz_in: '',
		oz_out: '',
		roast_notes: '',
		roast_targets: '',
		last_updated: new Date().toISOString()
	};

	// Array to store multiple beans in the batch
	let batchBeans = $state([
		{
			coffee_id: selectedBean?.id || '',
			coffee_name: selectedBean?.name || '',
			oz_in: '',
			oz_out: ''
		}
	]);

	function addBeanToBatch() {
		batchBeans = [...batchBeans, { coffee_id: '', coffee_name: '', oz_in: '', oz_out: '' }];
	}

	function removeBeanFromBatch(index: number) {
		batchBeans = batchBeans.filter((_, i) => i !== index);
	}

	function handleCoffeeChange(event: Event, index: number) {
		const selectedId = (event.target as HTMLSelectElement).value;
		const selected = availableCoffees.find((coffee) => coffee.id.toString() === selectedId);
		if (selected) {
			batchBeans[index].coffee_id = selected.id;
			batchBeans[index].coffee_name = selected.name;
			if (index === 0 && formData.batch_name === '') {
				formData.batch_name = `${selected.name} Batch - ${new Date().toLocaleDateString()}`;
			}
			batchBeans = [...batchBeans];
		}
	}

	async function handleSubmit() {
		if (!batchBeans || !batchBeans.length) {
			alert('Please add at least one bean to the batch');
			return;
		}

		try {
			const dataForAPI = {
				batch_name: formData.batch_name,
				batch_beans: batchBeans.map((bean) => ({
					coffee_id: bean.coffee_id,
					coffee_name: bean.coffee_name,
					oz_in: bean.oz_in ? Number(bean.oz_in) : null,
					oz_out: bean.oz_out ? Number(bean.oz_out) : null
				})),
				roast_date: prepareDateForAPI(formData.roast_date),
				roast_notes: formData.roast_notes,
				roast_targets: formData.roast_targets
			};

			onSubmit(dataForAPI);
		} catch (error) {
			console.error('Error submitting profile:', error);
			alert(error instanceof Error ? error.message : 'Failed to save roast profiles');
		}
	}

	onMount(() => {
		// Prevent body scrolling when modal is open
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = 'auto';
		};
	});
</script>

<!-- Modal with improved overlay -->
<div class="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
	<button
		type="button"
		class="fixed inset-0 bg-black/50"
		onclick={onClose}
		onkeydown={(e) => e.key === 'Escape' && onClose()}
		aria-label="Close modal"
	></button>
	<div class="flex min-h-screen items-center justify-center p-2 sm:p-4">
		<div
			class="relative w-full max-w-2xl rounded-lg bg-background-secondary-light p-2 shadow-xl sm:p-4"
			role="dialog"
			aria-modal="true"
		>
			<!-- Fixed Header -->
			<div class="border-b border-background-tertiary-light p-2 sm:p-4">
				<label
					for="batch_name"
					class="block text-base font-medium text-text-primary-light sm:text-lg">Batch Name</label
				>
				<input
					id="batch_name"
					type="text"
					bind:value={formData.batch_name}
					class="mt-1 block w-full rounded bg-background-tertiary-light text-lg text-text-primary-light sm:text-xl"
					required
				/>
			</div>

			<!-- Scrollable Content -->
			<form
				onsubmit={(e) => {
					e.preventDefault();
					handleSubmit();
				}}
				class="max-h-[60vh] overflow-y-auto p-2 sm:p-4"
			>
				<div class="space-y-4">
					<!-- Roast Date -->
					<div class="w-full">
						<label for="roast_date" class="block text-sm font-medium text-text-primary-light"
							>Roast Date</label
						>
						<input
							id="roast_date"
							type="date"
							bind:value={formData.roast_date}
							class="mt-1 block w-full rounded bg-background-tertiary-light text-text-primary-light"
							required
						/>
					</div>

					<!-- Beans in Batch -->
					<div class="space-y-2 sm:space-y-4">
						{#each batchBeans as bean, index}
							<div class="relative rounded border border-background-tertiary-light p-2 sm:p-4">
								<!-- Remove bean button (except for first bean) -->
								{#if index > 0}
									<button
										type="button"
										class="absolute right-2 top-2 text-text-primary-light hover:text-text-primary-light"
										onclick={() => removeBeanFromBatch(index)}
									>
										✕
									</button>
								{/if}

								<div class="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-4">
									<div class="col-span-1 sm:col-span-2">
										<label
											for="coffee_select_{index}"
											class="block text-sm font-medium text-text-primary-light">Select Coffee</label
										>
										<select
											id="coffee_select_{index}"
											class="mt-1 block w-full rounded bg-background-tertiary-light text-text-primary-light"
											value={bean.coffee_id}
											onchange={(e) => handleCoffeeChange(e, index)}
											required
										>
											<option value="">Select a coffee...</option>
											{#each availableCoffees as coffee}
												<option value={coffee.id} selected={coffee.id === selectedBean?.id}>
													{coffee.name}
												</option>
											{/each}
										</select>
									</div>

									<div>
										<label
											for="oz_in_{index}"
											class="block text-sm font-medium text-text-primary-light">Ounces In</label
										>
										<input
											id="oz_in_{index}"
											type="number"
											step="1"
											bind:value={bean.oz_in}
											class="mt-1 block w-full rounded bg-background-tertiary-light text-text-primary-light"
											required
										/>
									</div>

									<div>
										<label
											for="oz_out_{index}"
											class="block text-sm font-medium text-text-primary-light">Ounces Out</label
										>
										<input
											id="oz_out_{index}"
											type="number"
											step="1"
											bind:value={bean.oz_out}
											class="mt-1 block w-full rounded bg-background-tertiary-light text-text-primary-light"
										/>
									</div>
								</div>
							</div>
						{/each}

						<!-- Add Bean Button -->
						<button
							type="button"
							class="flex items-center gap-2 rounded border border-background-tertiary-light px-4 py-2 text-text-primary-light hover:bg-background-tertiary-light hover:text-text-primary-light"
							onclick={addBeanToBatch}
						>
							<span class="text-xl">+</span>
							<span>Add Bean to Batch</span>
						</button>
					</div>

					<!-- Notes and Targets -->
					<div class="grid grid-cols-1 gap-2 sm:gap-4">
						<div>
							<label for="roast_targets" class="block text-sm font-medium text-text-primary-light"
								>Roast Targets</label
							>
							<textarea
								id="roast_targets"
								bind:value={formData.roast_targets}
								rows="3"
								class="mt-1 block w-full rounded bg-background-tertiary-light text-text-primary-light"
							></textarea>
						</div>

						<div>
							<label for="roast_notes" class="block text-sm font-medium text-text-primary-light"
								>Roast Notes</label
							>
							<textarea
								id="roast_notes"
								bind:value={formData.roast_notes}
								rows="3"
								class="mt-1 block w-full rounded bg-background-tertiary-light text-text-primary-light"
							></textarea>
						</div>
					</div>
				</div>
			</form>

			<!-- Footer -->
			<div class="border-t border-background-tertiary-light p-2 sm:p-4">
				<div class="flex justify-end space-x-2">
					<button
						type="button"
						class="rounded bg-background-primary-light px-3 py-1.5 text-text-primary-light sm:px-4 sm:py-2"
						onclick={onClose}
					>
						Cancel
					</button>
					<button
						type="submit"
						class="rounded bg-green-600 px-3 py-1.5 text-text-primary-light sm:px-4 sm:py-2"
						onclick={handleSubmit}
					>
						Create
					</button>
				</div>
			</div>
		</div>
	</div>
</div>
