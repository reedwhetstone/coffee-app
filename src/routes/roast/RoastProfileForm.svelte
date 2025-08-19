<script lang="ts">
	import { onMount } from 'svelte';
	import { formatDateForDisplay, prepareDateForAPI } from '$lib/utils/dates';
	import { loadingStore } from '$lib/stores/loadingStore';
	import LoadingButton from '$lib/components/LoadingButton.svelte';

	const {
		onClose,
		onSubmit,
		selectedBean,
		availableCoffees = []
	} = $props<{
		onClose: () => void;
		onSubmit: (data: any) => void;
		selectedBean: any;
		availableCoffees?: any[];
	}>();

	// Process available coffees to ensure proper name property
	let processedCoffees = $derived(
		availableCoffees
			.filter((coffee: any) => coffee.stocked === true)
			.map((coffee: any) => ({
				...coffee,
				name: coffee.coffee_catalog?.name || coffee.name || 'Unknown Coffee'
			}))
	);

	let coffeesLoading = $state(false); // No longer loading since data is passed via props

	let formData = $state({
		batch_name: selectedBean
			? `${selectedBean.name} Batch - ${new Date().toLocaleDateString()}`
			: '',
		coffee_id: selectedBean?.id ? Number(selectedBean.id) : '',
		coffee_name: selectedBean?.name || '',
		roast_date: prepareDateForAPI(new Date().toISOString()),
		oz_in: '',
		oz_out: '',
		roast_notes: '',
		roast_targets: '',
		last_updated: new Date().toISOString()
	});

	// Array to store multiple beans in the batch
	let batchBeans = $state([
		{
			coffee_id: selectedBean?.id ? Number(selectedBean.id) : '',
			coffee_name: selectedBean?.name || '',
			oz_in: '',
			oz_out: '',
			artisan_file: null as File | null
		}
	]);

	function addBeanToBatch() {
		batchBeans = [
			...batchBeans,
			{ coffee_id: '', coffee_name: '', oz_in: '', oz_out: '', artisan_file: null }
		];
	}

	function removeBeanFromBatch(index: number) {
		batchBeans = batchBeans.filter((_, i) => i !== index);
	}

	function handleCoffeeChange(event: Event, index: number) {
		const selectedId = (event.target as HTMLSelectElement).value;
		const selected = processedCoffees.find((coffee: any) => coffee.id.toString() === selectedId);
		if (selected) {
			batchBeans[index].coffee_id = selected.id;
			batchBeans[index].coffee_name = selected.name; // Now uses the transformed name property
			if (index === 0 && formData.batch_name === '') {
				formData.batch_name = `${selected.name} Batch - ${new Date().toLocaleDateString()}`;
			}
			batchBeans = [...batchBeans];
		}
	}

	function handleFileUpload(event: Event, index: number) {
		const file = (event.target as HTMLInputElement).files?.[0];
		if (file) {
			batchBeans[index].artisan_file = file;
			batchBeans = [...batchBeans];
		}
	}

	async function uploadArtisanFile(
		roastId: number,
		file: File,
		operationId: string,
		beanIndex: number
	) {
		console.log(`Uploading Artisan file ${file.name} for roast ID ${roastId}`);

		loadingStore.update(operationId, `Uploading Artisan file for bean ${beanIndex + 1}...`);

		const formData = new FormData();
		formData.append('file', file);
		formData.append('roastId', roastId.toString());

		const response = await fetch('/api/artisan-import', {
			method: 'POST',
			body: formData
		});

		if (!response.ok) {
			const errorData = await response.json();
			console.error('Artisan upload failed:', errorData);
			throw new Error(errorData.error || 'Failed to upload Artisan file');
		}

		const result = await response.json();
		console.log('Artisan upload successful:', result);
		return result;
	}

	let isSubmitting = $state(false);

	async function handleSubmit() {
		if (!batchBeans || !batchBeans.length) {
			alert('Please add at least one bean to the batch');
			return;
		}

		const operationId = 'create-roast-profiles';

		try {
			isSubmitting = true;
			loadingStore.start(operationId, 'Creating roast profiles...');

			const dataForAPI = {
				batch_name: formData.batch_name,
				batch_beans: batchBeans.map((bean) => ({
					coffee_id: Number(bean.coffee_id),
					coffee_name: bean.coffee_name,
					oz_in: bean.oz_in ? Number(bean.oz_in) : null,
					oz_out: bean.oz_out ? Number(bean.oz_out) : null
				})),
				roast_date: prepareDateForAPI(formData.roast_date),
				roast_notes: formData.roast_notes,
				roast_targets: formData.roast_targets
			};

			// Submit the roast profile data using parent callback
			loadingStore.update(operationId, 'Saving roast profiles to database...');
			const roastProfilesResponse = await onSubmit(dataForAPI);
			console.log('Roast profiles response:', roastProfilesResponse);

			// If there are Artisan files to upload, handle them after profile creation
			if (roastProfilesResponse?.roast_ids && Array.isArray(roastProfilesResponse.roast_ids)) {
				console.log(`Processing ${batchBeans.length} beans for Artisan file uploads`);

				const filesToUpload = batchBeans.filter(
					(bean, i) => bean.artisan_file && roastProfilesResponse.roast_ids[i]
				);

				if (filesToUpload.length > 0) {
					loadingStore.update(operationId, 'Uploading Artisan files...');

					for (let i = 0; i < batchBeans.length; i++) {
						const bean = batchBeans[i];
						const roastId = roastProfilesResponse.roast_ids[i];

						console.log(`Bean ${i}: has file = ${!!bean.artisan_file}, roastId = ${roastId}`);

						if (bean.artisan_file && roastId) {
							try {
								await uploadArtisanFile(roastId, bean.artisan_file, operationId, i);
								console.log(`Successfully uploaded Artisan file for roast ${roastId}`);
							} catch (fileError) {
								console.error(`Failed to upload Artisan file for roast ${roastId}:`, fileError);
								alert(
									`Warning: Roast profile created but Artisan file upload failed: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`
								);
							}
						}
					}
				}
			} else {
				console.log('No roast IDs returned or roast_ids is not an array:', roastProfilesResponse);
			}

			loadingStore.update(operationId, 'Finalizing roast profiles...');
			// Small delay to show completion message
			await new Promise((resolve) => setTimeout(resolve, 500));
			loadingStore.complete(operationId);
		} catch (error) {
			loadingStore.complete(operationId);
			console.error('Error submitting profile:', error);
			alert(error instanceof Error ? error.message : 'Failed to save roast profiles');
		} finally {
			isSubmitting = false;
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
			class="relative w-full max-w-4xl rounded-lg bg-background-secondary-light p-6 shadow-xl"
			role="dialog"
			aria-modal="true"
		>
			<!-- Header -->
			<div class="mb-6">
				<h2 class="text-2xl font-bold text-text-primary-light">Add New Roast Profile</h2>
				<p class="mt-2 text-text-secondary-light">
					Create a new roast batch with multiple beans and optional Artisan data
				</p>
			</div>

			<!-- Scrollable Content -->
			<form
				onsubmit={(e) => {
					e.preventDefault();
					handleSubmit();
				}}
				class="max-h-[70vh] space-y-6 overflow-y-auto pr-2"
			>
				<!-- Batch Details -->
				<div class="rounded-lg bg-background-primary-light p-4 ring-1 ring-border-light">
					<h3 class="mb-4 text-lg font-semibold text-text-primary-light">Batch Information</h3>
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div class="space-y-2">
							<label for="batch_name" class="block text-sm font-medium text-text-primary-light">
								Batch Name
							</label>
							<input
								id="batch_name"
								type="text"
								bind:value={formData.batch_name}
								placeholder="Enter batch name"
								class="block w-full rounded-md border-0 bg-background-secondary-light px-3 py-2 text-text-primary-light placeholder-text-secondary-light shadow-sm ring-1 ring-border-light focus:ring-2 focus:ring-background-tertiary-light"
								required
							/>
						</div>

						<div class="space-y-2">
							<label for="roast_date" class="block text-sm font-medium text-text-primary-light">
								Roast Date
							</label>
							<input
								id="roast_date"
								type="date"
								bind:value={formData.roast_date}
								class="block w-full rounded-md border-0 bg-background-secondary-light px-3 py-2 text-text-primary-light shadow-sm ring-1 ring-border-light focus:ring-2 focus:ring-background-tertiary-light"
								required
							/>
						</div>
					</div>
				</div>
				<!-- Beans in Batch -->
				<div class="rounded-lg bg-background-primary-light p-4 ring-1 ring-border-light">
					<div class="mb-4 flex items-center justify-between">
						<h3 class="text-lg font-semibold text-text-primary-light">Beans in Batch</h3>
						<button
							type="button"
							class="flex items-center gap-2 rounded-md bg-background-tertiary-light px-3 py-1.5 text-sm font-medium text-white transition-all duration-200 hover:bg-opacity-90"
							onclick={addBeanToBatch}
						>
							<span class="text-lg">+</span>
							<span>Add Bean</span>
						</button>
					</div>

					<div class="space-y-4">
						{#each batchBeans as bean, index}
							<div
								class="relative rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light"
							>
								<!-- Remove bean button (except for first bean) -->
								{#if index > 0}
									<button
										type="button"
										class="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs text-white hover:bg-red-600"
										onclick={() => removeBeanFromBatch(index)}
									>
										✕
									</button>
								{/if}

								<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
									<div class="space-y-2 sm:col-span-2">
										<label
											for="coffee_select_{index}"
											class="block text-sm font-medium text-text-primary-light"
										>
											Select Coffee
										</label>
										<select
											id="coffee_select_{index}"
											class="block w-full rounded-md border-0 bg-background-primary-light px-3 py-2 text-text-primary-light shadow-sm ring-1 ring-border-light focus:ring-2 focus:ring-background-tertiary-light"
											value={bean.coffee_id}
											onchange={(e) => handleCoffeeChange(e, index)}
											required
										>
											{#if coffeesLoading}
												<option value="">Loading coffees...</option>
											{:else}
												<option value="">Select a coffee...</option>
												{#each processedCoffees as coffee}
													<option value={coffee.id} selected={coffee.id === selectedBean?.id}>
														{coffee.name}
													</option>
												{/each}
											{/if}
										</select>
									</div>

									<div class="space-y-2">
										<label
											for="oz_in_{index}"
											class="block text-sm font-medium text-text-primary-light"
										>
											Green Weight (oz)
										</label>
										<input
											id="oz_in_{index}"
											type="number"
											step="1"
											min="0"
											bind:value={bean.oz_in}
											placeholder="0"
											class="block w-full rounded-md border-0 bg-background-primary-light px-3 py-2 text-text-primary-light placeholder-text-secondary-light shadow-sm ring-1 ring-border-light focus:ring-2 focus:ring-background-tertiary-light"
											required
										/>
									</div>

									<div class="space-y-2">
										<label
											for="oz_out_{index}"
											class="block text-sm font-medium text-text-primary-light"
										>
											Roasted Weight (oz)
										</label>
										<input
											id="oz_out_{index}"
											type="number"
											step="1"
											min="0"
											bind:value={bean.oz_out}
											placeholder="0"
											class="block w-full rounded-md border-0 bg-background-primary-light px-3 py-2 text-text-primary-light placeholder-text-secondary-light shadow-sm ring-1 ring-border-light focus:ring-2 focus:ring-background-tertiary-light"
										/>
									</div>

									<!-- Artisan File Upload -->
									<div class="space-y-2 sm:col-span-2">
										<label
											for="artisan_file_{index}"
											class="block text-sm font-medium text-text-primary-light"
										>
											Artisan Roast Log (Optional)
										</label>
										<div class="space-y-2">
											<input
												id="artisan_file_{index}"
												type="file"
												accept=".csv,.xlsx"
												onchange={(e) => handleFileUpload(e, index)}
												class="block w-full text-sm text-text-primary-light file:mr-4 file:rounded-md file:border-0 file:bg-background-tertiary-light file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-opacity-90"
											/>
											<p class="text-xs text-text-secondary-light">
												Upload CSV or XLSX exported from Artisan to import temperature curves
											</p>
											{#if bean.artisan_file}
												<p class="text-xs font-medium text-green-600">
													✓ {bean.artisan_file.name}
												</p>
											{/if}
										</div>
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>

				<!-- Notes and Targets -->
				<div class="rounded-lg bg-background-primary-light p-4 ring-1 ring-border-light">
					<h3 class="mb-4 text-lg font-semibold text-text-primary-light">Notes & Targets</h3>
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div class="space-y-2">
							<label for="roast_targets" class="block text-sm font-medium text-text-primary-light">
								Roast Targets
							</label>
							<textarea
								id="roast_targets"
								bind:value={formData.roast_targets}
								rows="3"
								placeholder="Enter your roast targets and goals..."
								class="block w-full rounded-md border-0 bg-background-secondary-light px-3 py-2 text-text-primary-light placeholder-text-secondary-light shadow-sm ring-1 ring-border-light focus:ring-2 focus:ring-background-tertiary-light"
							></textarea>
						</div>

						<div class="space-y-2">
							<label for="roast_notes" class="block text-sm font-medium text-text-primary-light">
								Roast Notes
							</label>
							<textarea
								id="roast_notes"
								bind:value={formData.roast_notes}
								rows="3"
								placeholder="Add notes about this roast session..."
								class="block w-full rounded-md border-0 bg-background-secondary-light px-3 py-2 text-text-primary-light placeholder-text-secondary-light shadow-sm ring-1 ring-border-light focus:ring-2 focus:ring-background-tertiary-light"
							></textarea>
						</div>
					</div>
				</div>
			</form>

			<!-- Footer -->
			<div class="mt-6 border-t border-background-tertiary-light/20 pt-6">
				<div class="flex flex-col gap-3 sm:flex-row sm:justify-end">
					<button
						type="button"
						class="rounded-md border border-background-tertiary-light px-4 py-2 text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
						onclick={onClose}
						disabled={isSubmitting}
					>
						Cancel
					</button>
					<LoadingButton
						variant="primary"
						loading={isSubmitting}
						loadingText="Creating Profiles..."
						onclick={handleSubmit}
						disabled={coffeesLoading}
					>
						Create Roast Profile
					</LoadingButton>
				</div>
			</div>
		</div>
	</div>
</div>
