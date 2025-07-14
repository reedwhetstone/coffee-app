<script lang="ts">
	import { onMount } from 'svelte';
	import LoadingButton from '$lib/components/LoadingButton.svelte';

	const {
		bean = null,
		onClose,
		onSubmit
	} = $props<{
		bean: any;
		onClose: () => void;
		onSubmit: (bean: any) => void;
	}>();

	let isManualEntry = $state(true);
	let catalogBeans = $state<any[]>([]);
	let sourceFilter = $state('');
	let isUpdating = $state(false);
	let isSubmitting = $state(false);
	let catalogLoading = $state(false);

	// Optional catalog fields for manual entry
	let optionalFields = $state<{ [key: string]: string | number | null }>({
		region: '',
		processing: '',
		drying_method: '',
		roast_recs: '',
		lot_size: '',
		bag_size: '',
		packaging: '',
		cultivar_detail: '',
		grade: '',
		appearance: '',
		description_short: '',
		farm_notes: '',
		type: '',
		description_long: '',
		cost_lb: null as number | null,
		source: '',
		cupping_notes: '',
		arrival_date: '',
		score_value: null as number | null
	});

	let selectedOptionalFields = $state<string[]>([]);

	// Shared form data for batch-level fields
	let sharedFormData = $state({
		purchase_date: '',
		tax_ship_cost: 0.0,
		notes: ''
	});

	// Array to store multiple beans in the batch
	let batchBeans = $state(
		bean
			? [
					{
						...bean,
						manual_name: bean.manual_name || '',
						rank: bean.rank || null,
						purchased_qty_lbs: bean.purchased_qty_lbs || 0,
						bean_cost: bean.bean_cost || 0.0,
						catalog_id: bean.catalog_id || null
					}
			  ]
			: [
					{
						// User-specific inventory fields only
						manual_name: '',
						rank: null,
						purchased_qty_lbs: 0,
						bean_cost: 0.0,
						catalog_id: null
					}
			  ]
	);

	// Initialize shared data from existing bean if editing
	$effect(() => {
		if (bean) {
			sharedFormData.purchase_date = bean.purchase_date || '';
			sharedFormData.tax_ship_cost = bean.tax_ship_cost || 0.0;
			sharedFormData.notes = bean.notes || '';
		}
	});

	function addBeanToBatch() {
		batchBeans = [
			...batchBeans,
			{
				manual_name: '',
				rank: null,
				purchased_qty_lbs: 0,
				bean_cost: 0.0,
				catalog_id: null
			}
		];
	}

	function removeBeanFromBatch(index: number) {
		batchBeans = batchBeans.filter((_, i) => i !== index);
	}

	function resetFormData() {
		sharedFormData = {
			purchase_date: '',
			tax_ship_cost: 0.0,
			notes: ''
		};
		batchBeans = [
			{
				manual_name: '',
				rank: null,
				purchased_qty_lbs: 0,
				bean_cost: 0.0,
				catalog_id: null
			}
		];
	}

	async function loadCatalogBeans() {
		try {
			catalogLoading = true;
			const response = await fetch('/api/catalog');
			if (response.ok) {
				const data = await response.json();
				catalogBeans = data.filter((bean: any) => bean.stocked);
			}
		} catch (error) {
			console.error('Error loading catalog beans:', error);
		} finally {
			catalogLoading = false;
		}
	}

	function populateFromCatalog(catalogBean: any, beanIndex: number = 0) {
		if (!catalogBean) return;

		// Only set catalog_id and default cost from catalog for the specific bean
		batchBeans[beanIndex] = {
			...batchBeans[beanIndex], // Keep existing user fields
			catalog_id: catalogBean.id,
			// Set default bean cost from catalog cost if available
			bean_cost:
				typeof catalogBean.cost_lb === 'number'
					? parseFloat(catalogBean.cost_lb.toFixed(2))
					: batchBeans[beanIndex].bean_cost
		};
		batchBeans = [...batchBeans]; // Trigger reactivity

		console.log('Set catalog reference:', { catalogId: catalogBean.id, catalogBean, beanData: batchBeans[beanIndex] });
	}

	async function handleSubmit() {
		if (!batchBeans || !batchBeans.length) {
			alert('Please add at least one bean to the batch');
			return;
		}

		try {
			isSubmitting = true;

			// Calculate tax/ship cost per bean
			const taxShipPerBean = sharedFormData.tax_ship_cost / batchBeans.length;

			const createdBeans = [];

			// Process each bean in the batch
			for (let i = 0; i < batchBeans.length; i++) {
				const beanData = batchBeans[i];

				// Validate required fields based on mode
				if (!isManualEntry && !beanData.catalog_id) {
					alert(`Please select a coffee bean for item ${i + 1}`);
					return;
				}

				if (isManualEntry && !beanData.manual_name?.trim()) {
					alert(`Please enter a coffee name for bean ${i + 1}`);
					return;
				}

				// Prepare bean data for submission
				const cleanedBean: any = {
					...Object.fromEntries(
						Object.entries(beanData).map(([key, value]) => [
							key,
							value === '' || value === undefined ? null : value
						])
					),
					// Add shared form data
					purchase_date: sharedFormData.purchase_date,
					tax_ship_cost: taxShipPerBean, // Divided cost
					notes: sharedFormData.notes,
					last_updated: new Date().toISOString()
				};

				// For manual entry, include optional catalog fields (only for first bean)
				if (isManualEntry && beanData.manual_name && i === 0) {
					// Add selected optional fields to the submission
					selectedOptionalFields.forEach((fieldName) => {
						if (optionalFields[fieldName] !== '' && optionalFields[fieldName] !== null) {
							cleanedBean[fieldName] = optionalFields[fieldName];
						}
					});
					// Don't set catalog_id for manual entries - let the API create it
					if (cleanedBean.catalog_id === null) {
						delete cleanedBean.catalog_id;
					}
				}

				const response = await fetch('/api/data', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(cleanedBean)
				});

				if (response.ok) {
					const newBean = await response.json();
					createdBeans.push(newBean);
				} else {
					const data = await response.json();
					alert(`Failed to create bean ${i + 1}: ${data.error}`);
					return;
				}
			}

			// Call onSubmit with all created beans
			onSubmit(createdBeans);
			onClose();
		} catch (error) {
			console.error('Error creating beans:', error);
			alert('Failed to create beans. Please try again.');
		} finally {
			isSubmitting = false;
		}
	}

	// Load catalog beans when component mounts
	onMount(() => {
		loadCatalogBeans();
	});

	// Handle source filter change manually
	function handleSourceChange() {
		if (!isUpdating) {
			try {
				isUpdating = true;
				// Only reset bean selections, keep purchase details
				batchBeans = [
					{
						manual_name: '',
						rank: null,
						purchased_qty_lbs: 0,
						bean_cost: 0.0,
						catalog_id: null
					}
				];
			} finally {
				isUpdating = false;
			}
		}
	}

	function handleBeanSelect(event: Event, beanIndex: number = 0) {
		const selectElement = event.target as HTMLSelectElement;
		const selectedValue = selectElement.value;

		if (!selectedValue) {
			// No bean selected
			return;
		}

		// Find the selected bean by ID
		const selectedBean = catalogBeans.find((b) => b.id.toString() === selectedValue);

		if (selectedBean) {
			populateFromCatalog(selectedBean, beanIndex);
		}
	}
</script>

<!-- Clean card-based form design matching home page patterns -->
<div class="rounded-lg bg-background-secondary-light p-6 shadow-sm">
	<div class="mb-6">
		<h2 class="text-2xl font-bold text-text-primary-light">
			{bean ? 'Edit Coffee Bean' : 'Add New Coffee Bean'}
		</h2>
		<p class="mt-2 text-text-secondary-light">
			{bean ? 'Edit your coffee bean details' : 'Add coffee beans to your inventory'}
		</p>
	</div>

	<form
		onsubmit={(e) => {
			e.preventDefault();
			handleSubmit();
		}}
		class="max-h-[70vh] space-y-6 overflow-y-auto pr-2"
	>
		<!-- Entry Type Selection -->
		<div class="rounded-lg bg-background-primary-light p-4 ring-1 ring-border-light">
			<h3 class="mb-4 text-lg font-semibold text-text-primary-light">Entry Type</h3>
			<div class="flex flex-wrap gap-4">
				<label class="inline-flex cursor-pointer items-center">
					<input
						type="radio"
						bind:group={isManualEntry}
						value={true}
						onchange={resetFormData}
						class="sr-only"
					/>
					<div
						class="flex items-center gap-2 rounded-md border px-4 py-2 transition-all duration-200"
						class:bg-background-tertiary-light={isManualEntry}
						class:text-white={isManualEntry}
						class:border-background-tertiary-light={isManualEntry}
						class:border-border-light={!isManualEntry}
						class:text-text-primary-light={!isManualEntry}
					>
						<span>Manual Entry</span>
					</div>
				</label>
				<label class="inline-flex cursor-pointer items-center">
					<input type="radio" bind:group={isManualEntry} value={false} class="sr-only" />
					<div
						class="flex items-center gap-2 rounded-md border px-4 py-2 transition-all duration-200"
						class:bg-background-tertiary-light={!isManualEntry}
						class:text-white={!isManualEntry}
						class:border-background-tertiary-light={!isManualEntry}
						class:border-border-light={isManualEntry}
						class:text-text-primary-light={isManualEntry}
					>
						<span>Select from Catalog</span>
					</div>
				</label>
			</div>
		</div>

		

		<!-- Purchase Details -->
		<div class="rounded-lg bg-background-primary-light p-4 ring-1 ring-border-light">
			<h3 class="mb-4 text-lg font-semibold text-text-primary-light">Purchase Details</h3>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div class="space-y-2">
					<label for="purchase_date" class="block text-sm font-medium text-text-primary-light">
						Purchase Date
					</label>
					<input
						id="purchase_date"
						type="date"
						bind:value={sharedFormData.purchase_date}
						class="block w-full rounded-md border-0 bg-background-secondary-light px-3 py-2 text-text-primary-light shadow-sm ring-1 ring-border-light focus:ring-2 focus:ring-background-tertiary-light"
						required
					/>
				</div>

				<div class="space-y-2">
					<label for="tax_ship_cost" class="block text-sm font-medium text-text-primary-light">
						Total Tax & Shipping ($)
					</label>
					<input
						id="tax_ship_cost"
						type="number"
						step="0.01"
						min="0"
						placeholder="0.00"
						bind:value={sharedFormData.tax_ship_cost}
						class="block w-full rounded-md border-0 bg-background-secondary-light px-3 py-2 text-text-primary-light placeholder-text-secondary-light shadow-sm ring-1 ring-border-light focus:ring-2 focus:ring-background-tertiary-light"
						required
					/>
					<p class="text-xs text-text-secondary-light">
						This amount will be divided equally among all beans in this purchase
					</p>
				</div>
			</div>
		</div>

		{#if !isManualEntry}
			<!-- Catalog Selection Filter -->
			<div class="rounded-lg bg-background-primary-light p-4 ring-1 ring-border-light">
				<h3 class="mb-4 text-lg font-semibold text-text-primary-light">Filter Options</h3>
				<div class="space-y-2">
					<label for="source" class="block text-sm font-medium text-text-primary-light">
						Filter by Source
					</label>
					<select
						id="source"
						bind:value={sourceFilter}
						onchange={handleSourceChange}
						class="block w-full rounded-md border-0 bg-background-secondary-light px-3 py-2 text-text-primary-light shadow-sm ring-1 ring-border-light focus:ring-2 focus:ring-background-tertiary-light"
					>
						<option value="">All Sources</option>
						{#each [...new Set(catalogBeans.map((b) => b.source))] as source}
							<option value={source}>{source}</option>
						{/each}
					</select>
				</div>
			</div>
		{/if}

		<!-- Beans in Purchase -->
		<div class="rounded-lg bg-background-primary-light p-4 ring-1 ring-border-light">
			<div class="mb-4 flex items-center justify-between">
				<h3 class="text-lg font-semibold text-text-primary-light">Beans in Purchase</h3>
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
				{#each batchBeans as beanData, index}
					<div class="relative rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
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
							<!-- Bean selection or manual entry -->
							{#if isManualEntry}
								<div class="space-y-2 sm:col-span-2">
									<label for="manual-name-{index}" class="block text-sm font-medium text-text-primary-light">
										Coffee Name
									</label>
									<input
										id="manual-name-{index}"
										type="text"
										bind:value={beanData.manual_name}
										placeholder="Enter coffee name"
										class="block w-full rounded-md border-0 bg-background-primary-light px-3 py-2 text-text-primary-light placeholder-text-secondary-light shadow-sm ring-1 ring-border-light focus:ring-2 focus:ring-background-tertiary-light"
										required
									/>
								</div>
							{:else}
								<div class="space-y-2 sm:col-span-2">
									<label for="catalog-bean-{index}" class="block text-sm font-medium text-text-primary-light">
										Select Coffee Bean
									</label>
									<select
										id="catalog-bean-{index}"
										class="block w-full rounded-md border-0 bg-background-primary-light px-3 py-2 text-text-primary-light shadow-sm ring-1 ring-border-light focus:ring-2 focus:ring-background-tertiary-light"
										required
										value={beanData.catalog_id || ''}
										onchange={(e) => handleBeanSelect(e, index)}
									>
										<option value="">Select a coffee bean...</option>
										{#each catalogBeans.filter((b) => !sourceFilter || b.source === sourceFilter) as catalogBean}
											<option value={catalogBean.id}>{catalogBean.name}</option>
										{/each}
									</select>
								</div>
							{/if}

							<div class="space-y-2">
								<label for="purchased_qty-{index}" class="block text-sm font-medium text-text-primary-light">
									Purchased Quantity (lbs)
								</label>
								<input
									id="purchased_qty-{index}"
									type="number"
									step="1"
									min="0"
									bind:value={beanData.purchased_qty_lbs}
									placeholder="0"
									class="block w-full rounded-md border-0 bg-background-primary-light px-3 py-2 text-text-primary-light placeholder-text-secondary-light shadow-sm ring-1 ring-border-light focus:ring-2 focus:ring-background-tertiary-light"
									required
								/>
							</div>

							<div class="space-y-2">
								<label for="bean_cost-{index}" class="block text-sm font-medium text-text-primary-light">
									Bean Cost ($)
								</label>
								<input
									id="bean_cost-{index}"
									type="number"
									step="0.01"
									min="0"
									placeholder="0.00"
									bind:value={beanData.bean_cost}
									class="block w-full rounded-md border-0 bg-background-primary-light px-3 py-2 text-text-primary-light placeholder-text-secondary-light shadow-sm ring-1 ring-border-light focus:ring-2 focus:ring-background-tertiary-light"
									required
								/>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Additional Information -->
		<div class="rounded-lg bg-background-primary-light p-4 ring-1 ring-border-light">
			<h3 class="mb-4 text-lg font-semibold text-text-primary-light">Additional Information</h3>
			<div class="space-y-4">
				{#if isManualEntry}
					<!-- Optional Field Selection for Manual Entry -->
					<div class="space-y-2">
						<label for="field-selector" class="block text-sm font-medium text-text-primary-light">
							Add Optional Fields
						</label>
						<select
							id="field-selector"
							class="block w-full rounded-md border-0 bg-background-secondary-light px-3 py-2 text-text-primary-light shadow-sm ring-1 ring-border-light focus:ring-2 focus:ring-background-tertiary-light"
							onchange={(e) => {
								const target = e.target as HTMLSelectElement;
								const field = target.value;
								if (field && !selectedOptionalFields.includes(field)) {
									selectedOptionalFields = [...selectedOptionalFields, field];
									target.value = '';
								}
							}}
						>
							<option value="">Select field to add...</option>
							<option value="region">Region</option>
							<option value="processing">Processing Method</option>
							<option value="drying_method">Drying Method</option>
							<option value="roast_recs">Roast Recommendations</option>
							<option value="lot_size">Lot Size</option>
							<option value="bag_size">Bag Size</option>
							<option value="packaging">Packaging</option>
							<option value="cultivar_detail">Cultivar Detail</option>
							<option value="grade">Grade</option>
							<option value="appearance">Appearance</option>
							<option value="description_short">Short Description</option>
							<option value="farm_notes">Farm Notes</option>
							<option value="type">Type</option>
							<option value="description_long">Long Description</option>
							<option value="cost_lb">Cost per Lb</option>
							<option value="source">Source</option>
							<option value="cupping_notes">Cupping Notes</option>
							<option value="arrival_date">Arrival Date</option>
							<option value="score_value">Score Value</option>
						</select>
					</div>

					<!-- Dynamic Optional Fields -->
					{#each selectedOptionalFields as fieldName}
						<div class="flex gap-2">
							<div class="flex-1 space-y-2">
								<label
									for={`field-${fieldName}`}
									class="block text-sm font-medium text-text-primary-light"
								>
									{fieldName.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
								</label>
								{#if fieldName === 'description_long' || fieldName === 'farm_notes' || fieldName === 'cupping_notes'}
									<textarea
										id={`field-${fieldName}`}
										bind:value={optionalFields[fieldName]}
										rows="3"
										class="block w-full rounded-md border-0 bg-background-secondary-light px-3 py-2 text-text-primary-light shadow-sm ring-1 ring-border-light focus:ring-2 focus:ring-background-tertiary-light"
									></textarea>
								{:else if fieldName === 'cost_lb' || fieldName === 'score_value'}
									<input
										id={`field-${fieldName}`}
										type="number"
										step="0.01"
										bind:value={optionalFields[fieldName]}
										class="block w-full rounded-md border-0 bg-background-secondary-light px-3 py-2 text-text-primary-light shadow-sm ring-1 ring-border-light focus:ring-2 focus:ring-background-tertiary-light"
									/>
								{:else if fieldName === 'arrival_date'}
									<input
										id={`field-${fieldName}`}
										type="date"
										bind:value={optionalFields[fieldName]}
										class="block w-full rounded-md border-0 bg-background-secondary-light px-3 py-2 text-text-primary-light shadow-sm ring-1 ring-border-light focus:ring-2 focus:ring-background-tertiary-light"
									/>
								{:else}
									<input
										id={`field-${fieldName}`}
										type="text"
										bind:value={optionalFields[fieldName]}
										class="block w-full rounded-md border-0 bg-background-secondary-light px-3 py-2 text-text-primary-light shadow-sm ring-1 ring-border-light focus:ring-2 focus:ring-background-tertiary-light"
									/>
								{/if}
							</div>
							<button
								type="button"
								class="mt-6 rounded-md bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600"
								onclick={() => {
									selectedOptionalFields = selectedOptionalFields.filter(
										(f: string) => f !== fieldName
									);
									optionalFields[fieldName] = '';
								}}
							>
								Remove
							</button>
						</div>
					{/each}
				{/if}

				<div class="space-y-2">
					<label for="notes" class="block text-sm font-medium text-text-primary-light">
						Purchase Notes (Optional)
					</label>
					<textarea
						id="notes"
						bind:value={sharedFormData.notes}
						rows="3"
						placeholder="Add any notes about this purchase..."
						class="block w-full rounded-md border-0 bg-background-secondary-light px-3 py-2 text-text-primary-light placeholder-text-secondary-light shadow-sm ring-1 ring-border-light focus:ring-2 focus:ring-background-tertiary-light"
					></textarea>
				</div>
			</div>
		</div>

		<!-- Action Buttons -->
		<div class="flex flex-col gap-3 pt-4 sm:flex-row sm:justify-end">
			<button
				type="button"
				class="rounded-md border border-background-tertiary-light px-4 py-2 text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white"
				onclick={onClose}
			>
				Cancel
			</button>
			<LoadingButton
				variant="primary"
				loading={isSubmitting}
				loadingText={batchBeans.length === 1 ? 'Saving Bean...' : `Saving ${batchBeans.length} Beans...`}
				onclick={handleSubmit}
				disabled={catalogLoading}
			>
				{bean ? 'Update Bean' : batchBeans.length === 1 ? 'Add Bean' : `Add ${batchBeans.length} Beans`}
			</LoadingButton>
		</div>
	</form>
</div>
