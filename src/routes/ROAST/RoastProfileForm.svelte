<script lang="ts">
	import { onMount } from 'svelte';
	import { formatDateForDisplay, prepareDateForAPI } from '$lib/utils/dates';

	export let onClose: () => void;
	export let onSubmit: (profile: any) => void;
	export let selectedBean: any;

	let availableCoffees: any[] = [];

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
	let batchBeans = [
		{
			coffee_id: selectedBean?.id || '',
			coffee_name: selectedBean?.name || '',
			oz_in: '',
			oz_out: ''
		}
	];

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
		// Ensure all numeric fields are properly typed
		const profileData = {
			...formData,
			oz_in: formData.oz_in ? Number(formData.oz_in) : null,
			oz_out: formData.oz_out ? Number(formData.oz_out) : null,
			batch_beans: batchBeans.map((bean) => ({
				coffee_id: Number(bean.coffee_id),
				coffee_name: bean.coffee_name,
				oz_in: bean.oz_in ? Number(bean.oz_in) : null,
				oz_out: bean.oz_out ? Number(bean.oz_out) : null
			}))
		};
		try {
			const dataForAPI = {
				...formData,
				roast_date: prepareDateForAPI(formData.roast_date),
				last_updated: new Date().toISOString()
			};
			onSubmit(profileData);
			const response = await fetch('/api/roast-profiles', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(dataForAPI)
			});

			if (response.ok) {
				const result = await response.json();
				onSubmit(result);
			} else {
				console.error('Error submitting profile:', response.statusText);
			}
		} catch (error) {
			console.error('Error submitting profile:', error);
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
		on:click={onClose}
		on:keydown={(e) => e.key === 'Escape' && onClose()}
		aria-label="Close modal"
	></button>
	<div class="flex min-h-screen items-center justify-center p-4">
		<div
			class="relative w-full max-w-2xl rounded-lg bg-zinc-800 p-4"
			role="dialog"
			aria-modal="true"
		>
			<!-- Fixed Header -->
			<div class="border-b border-zinc-700 p-4">
				<label for="batch_name" class="block text-lg font-medium text-zinc-300">Batch Name</label>
				<input
					id="batch_name"
					type="text"
					bind:value={formData.batch_name}
					class="mt-1 block w-full rounded bg-zinc-700 text-xl text-zinc-300"
					required
				/>
			</div>

			<!-- Scrollable Content -->
			<form on:submit|preventDefault={handleSubmit} class="max-h-[60vh] overflow-y-auto p-4">
				<div class="space-y-4">
					<!-- Roast Date -->
					<div class="w-full">
						<label for="roast_date" class="block text-sm font-medium text-zinc-300"
							>Roast Date</label
						>
						<input
							id="roast_date"
							type="date"
							bind:value={formData.roast_date}
							class="mt-1 block w-full rounded bg-zinc-700 text-zinc-300"
							required
						/>
					</div>

					<!-- Beans in Batch -->
					<div class="space-y-4">
						{#each batchBeans as bean, index}
							<div class="relative rounded border border-zinc-700 p-4">
								<!-- Remove bean button (except for first bean) -->
								{#if index > 0}
									<button
										type="button"
										class="absolute right-2 top-2 text-zinc-500 hover:text-zinc-300"
										on:click={() => removeBeanFromBatch(index)}
									>
										✕
									</button>
								{/if}

								<div class="grid grid-cols-2 gap-4">
									<div class="col-span-2">
										<label
											for="coffee_select_{index}"
											class="block text-sm font-medium text-zinc-300">Select Coffee</label
										>
										<select
											id="coffee_select_{index}"
											class="mt-1 block w-full rounded bg-zinc-700 text-zinc-300"
											value={bean.coffee_id}
											on:change={(e) => handleCoffeeChange(e, index)}
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
										<label for="oz_in_{index}" class="block text-sm font-medium text-zinc-300"
											>Ounces In</label
										>
										<input
											id="oz_in_{index}"
											type="number"
											step="1"
											bind:value={bean.oz_in}
											class="mt-1 block w-full rounded bg-zinc-700 text-zinc-300"
											required
										/>
									</div>

									<div>
										<label for="oz_out_{index}" class="block text-sm font-medium text-zinc-300"
											>Ounces Out</label
										>
										<input
											id="oz_out_{index}"
											type="number"
											step="1"
											bind:value={bean.oz_out}
											class="mt-1 block w-full rounded bg-zinc-700 text-zinc-300"
										/>
									</div>
								</div>
							</div>
						{/each}

						<!-- Add Bean Button -->
						<button
							type="button"
							class="flex items-center gap-2 rounded border border-zinc-700 px-4 py-2 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
							on:click={addBeanToBatch}
						>
							<span class="text-xl">+</span>
							<span>Add Bean to Batch</span>
						</button>
					</div>

					<!-- Notes and Targets -->
					<div class="grid grid-cols-1 gap-4">
						<div>
							<label for="roast_targets" class="block text-sm font-medium text-zinc-300"
								>Roast Targets</label
							>
							<textarea
								id="roast_targets"
								bind:value={formData.roast_targets}
								rows="3"
								class="mt-1 block w-full rounded bg-zinc-700 text-zinc-300"
							></textarea>
						</div>

						<div>
							<label for="roast_notes" class="block text-sm font-medium text-zinc-300"
								>Roast Notes</label
							>
							<textarea
								id="roast_notes"
								bind:value={formData.roast_notes}
								rows="3"
								class="mt-1 block w-full rounded bg-zinc-700 text-zinc-300"
							></textarea>
						</div>
					</div>
				</div>
			</form>

			<!-- Footer -->
			<div class="border-t border-zinc-700 p-4">
				<div class="flex justify-end space-x-2">
					<button
						type="button"
						class="rounded bg-zinc-600 px-4 py-2 text-zinc-300"
						on:click={onClose}
					>
						Cancel
					</button>
					<button
						type="submit"
						class="rounded bg-green-600 px-4 py-2 text-zinc-300"
						on:click={handleSubmit}
					>
						Create
					</button>
				</div>
			</div>
		</div>
	</div>
</div>
