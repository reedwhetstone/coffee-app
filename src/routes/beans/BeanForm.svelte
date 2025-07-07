<script lang="ts">
	import { onMount } from 'svelte';

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
	let selectedCatalogBean = $state<any>(null);
	let sourceFilter = $state('');
	let isUpdating = $state(false);

	let formData = $state(
		bean
			? { ...bean }
			: {
					// User-specific inventory fields only
					manual_name: '',
					rank: null,
					notes: '',
					purchase_date: '',
					purchased_qty_lbs: 0,
					bean_cost: 0.0,
					tax_ship_cost: 0.0,
					last_updated: new Date().toISOString(),
					catalog_id: null
				}
	);

	function resetFormData() {
		formData = {
			// User-specific inventory fields only
			manual_name: '',
			rank: null,
			notes: '',
			purchase_date: '',
			purchased_qty_lbs: 0,
			bean_cost: 0.0,
			tax_ship_cost: 0.0,
			last_updated: new Date().toISOString(),
			catalog_id: null
		};
	}

	async function loadCatalogBeans() {
		try {
			const response = await fetch('/api/catalog');
			if (response.ok) {
				const data = await response.json();
				catalogBeans = data.filter((bean: any) => bean.stocked);
			}
		} catch (error) {
			console.error('Error loading catalog beans:', error);
		}
	}

	function populateFromCatalog(catalogBean: any) {
		if (!catalogBean) return;

		// Only set catalog_id and default cost from catalog
		formData = {
			...formData, // Keep existing user fields
			catalog_id: catalogBean.id,
			// Set default bean cost from catalog cost if available
			bean_cost:
				typeof catalogBean.cost_lb === 'number'
					? parseFloat(catalogBean.cost_lb.toFixed(2))
					: formData.bean_cost
		};

		console.log('Set catalog reference:', { catalogId: catalogBean.id, catalogBean, formData });
	}

	async function handleSubmit() {
		try {
			// Validate required fields based on mode
			if (!isManualEntry && !selectedCatalogBean) {
				alert('Please select a coffee from the catalog');
				return;
			}

			if (isManualEntry && !formData.manual_name?.trim()) {
				alert('Please enter a coffee name');
				return;
			}

			const cleanedBean = Object.fromEntries(
				Object.entries(formData).map(([key, value]) => [
					key,
					value === '' || value === undefined ? null : value
				])
			);

			// For manual entry, use the manual_name as the name
			if (isManualEntry && formData.manual_name) {
				cleanedBean.name = formData.manual_name;
				cleanedBean.catalog_id = null; // No catalog reference for manual entries
			}

			cleanedBean.last_updated = new Date().toISOString();

			const response = await fetch('/api/data', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(cleanedBean)
			});

			if (response.ok) {
				const newBean = await response.json();
				onSubmit(newBean);
				onClose();
			} else {
				const data = await response.json();
				alert(`Failed to create bean: ${data.error}`);
			}
		} catch (error) {
			console.error('Error creating bean:', error);
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
				selectedCatalogBean = null;
				resetFormData();
			} finally {
				isUpdating = false;
			}
		}
	}

	function handleBeanSelect(event: Event) {
		const selectElement = event.target as HTMLSelectElement;
		const selectedIndex = selectElement.selectedIndex;

		if (selectedIndex <= 0) {
			// "Select a bean..." option is selected (index 0)
			selectedCatalogBean = null;
			return;
		}

		// Get the actual bean object from our filtered list
		const filteredBeans = catalogBeans.filter((b) => !sourceFilter || b.source === sourceFilter);
		const selectedBean = filteredBeans[selectedIndex - 1]; // -1 because of the initial "Select a bean..." option

		selectedCatalogBean = selectedBean;
		populateFromCatalog(selectedBean);
	}
</script>

<!-- Clean card-based form design matching home page patterns -->
<div class="rounded-lg bg-background-secondary-light p-6 shadow-sm">
	<div class="mb-6">
		<h2 class="text-2xl font-bold text-text-primary-light">
			{bean ? 'Edit Coffee Bean' : 'Add New Coffee Bean'}
		</h2>
		<p class="mt-2 text-text-secondary-light">Add a coffee bean to your inventory</p>
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
				<label class="inline-flex items-center cursor-pointer">
					<input
						type="radio"
						bind:group={isManualEntry}
						value={true}
						onchange={resetFormData}
						class="sr-only"
					/>
					<div class="flex items-center gap-2 px-4 py-2 rounded-md border transition-all duration-200" 
						 class:bg-background-tertiary-light={isManualEntry}
						 class:text-white={isManualEntry}
						 class:border-background-tertiary-light={isManualEntry}
						 class:border-border-light={!isManualEntry}
						 class:text-text-primary-light={!isManualEntry}>
						<span>Manual Entry</span>
					</div>
				</label>
				<label class="inline-flex items-center cursor-pointer">
					<input type="radio" bind:group={isManualEntry} value={false} class="sr-only" />
					<div class="flex items-center gap-2 px-4 py-2 rounded-md border transition-all duration-200"
						 class:bg-background-tertiary-light={!isManualEntry}
						 class:text-white={!isManualEntry}
						 class:border-background-tertiary-light={!isManualEntry}
						 class:border-border-light={isManualEntry}
						 class:text-text-primary-light={isManualEntry}>
						<span>Select from Catalog</span>
					</div>
				</label>
			</div>
		</div>

		{#if !isManualEntry}
			<!-- Catalog Selection -->
			<div class="rounded-lg bg-background-primary-light p-4 ring-1 ring-border-light">
				<h3 class="mb-4 text-lg font-semibold text-text-primary-light">Select Coffee</h3>
				<div class="space-y-4">
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

					<div class="space-y-2">
						<label for="catalog-bean" class="block text-sm font-medium text-text-primary-light">
							Select Bean
						</label>
						<select
							id="catalog-bean"
							class="block w-full rounded-md border-0 bg-background-secondary-light px-3 py-2 text-text-primary-light shadow-sm ring-1 ring-border-light focus:ring-2 focus:ring-background-tertiary-light"
							required={!isManualEntry}
							onchange={handleBeanSelect}
						>
							<option value="">Select a bean...</option>
							{#each catalogBeans.filter((b) => !sourceFilter || b.source === sourceFilter) as catalogBean}
								<option value={catalogBean.id}>{catalogBean.name}</option>
							{/each}
						</select>
					</div>
				</div>

				<!-- Selected bean display -->
				{#if selectedCatalogBean}
					<div class="mt-4 rounded-md bg-background-secondary-light p-3 ring-1 ring-border-light">
						<h4 class="font-semibold text-text-primary-light">Selected Coffee:</h4>
						<p class="text-sm text-text-secondary-light">{selectedCatalogBean.name}</p>
						<p class="text-xs text-text-secondary-light">From: {selectedCatalogBean.source}</p>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Purchase Details -->
		<div class="rounded-lg bg-background-primary-light p-4 ring-1 ring-border-light">
			<h3 class="mb-4 text-lg font-semibold text-text-primary-light">Purchase Details</h3>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<!-- Manual entry name field -->
				{#if isManualEntry}
					<div class="sm:col-span-2 space-y-2">
						<label for="manual-name" class="block text-sm font-medium text-text-primary-light">
							Coffee Name
						</label>
						<input
							id="manual-name"
							type="text"
							bind:value={formData.manual_name}
							placeholder="Enter coffee name"
							class="block w-full rounded-md border-0 bg-background-secondary-light px-3 py-2 text-text-primary-light placeholder-text-secondary-light shadow-sm ring-1 ring-border-light focus:ring-2 focus:ring-background-tertiary-light"
							required
						/>
					</div>
				{/if}

				<div class="space-y-2">
					<label for="purchase_date" class="block text-sm font-medium text-text-primary-light">
						Purchase Date
					</label>
					<input
						id="purchase_date"
						type="date"
						bind:value={formData.purchase_date}
						class="block w-full rounded-md border-0 bg-background-secondary-light px-3 py-2 text-text-primary-light shadow-sm ring-1 ring-border-light focus:ring-2 focus:ring-background-tertiary-light"
						required
					/>
				</div>

				<div class="space-y-2">
					<label for="purchased_qty" class="block text-sm font-medium text-text-primary-light">
						Purchased Quantity (lbs)
					</label>
					<input
						id="purchased_qty"
						type="number"
						step="1"
						min="0"
						bind:value={formData.purchased_qty_lbs}
						placeholder="0"
						class="block w-full rounded-md border-0 bg-background-secondary-light px-3 py-2 text-text-primary-light placeholder-text-secondary-light shadow-sm ring-1 ring-border-light focus:ring-2 focus:ring-background-tertiary-light"
						required
					/>
				</div>

				<div class="space-y-2">
					<label for="bean_cost" class="block text-sm font-medium text-text-primary-light">
						Bean Cost ($)
					</label>
					<input
						id="bean_cost"
						type="number"
						step="0.01"
						min="0"
						placeholder="0.00"
						bind:value={formData.bean_cost}
						class="block w-full rounded-md border-0 bg-background-secondary-light px-3 py-2 text-text-primary-light placeholder-text-secondary-light shadow-sm ring-1 ring-border-light focus:ring-2 focus:ring-background-tertiary-light"
						required
					/>
				</div>

				<div class="space-y-2">
					<label for="tax_ship_cost" class="block text-sm font-medium text-text-primary-light">
						Tax & Shipping ($)
					</label>
					<input
						id="tax_ship_cost"
						type="number"
						step="0.01"
						min="0"
						placeholder="0.00"
						bind:value={formData.tax_ship_cost}
						class="block w-full rounded-md border-0 bg-background-secondary-light px-3 py-2 text-text-primary-light placeholder-text-secondary-light shadow-sm ring-1 ring-border-light focus:ring-2 focus:ring-background-tertiary-light"
						required
					/>
				</div>
			</div>
		</div>

		<!-- Additional Information -->
		<div class="rounded-lg bg-background-primary-light p-4 ring-1 ring-border-light">
			<h3 class="mb-4 text-lg font-semibold text-text-primary-light">Additional Information</h3>
			<div class="space-y-4">
				<div class="space-y-2">
					<label for="link" class="block text-sm font-medium text-text-primary-light">
						Product Link (Optional)
					</label>
					<input
						id="link"
						type="url"
						bind:value={formData.link}
						placeholder="https://..."
						class="block w-full rounded-md border-0 bg-background-secondary-light px-3 py-2 text-text-primary-light placeholder-text-secondary-light shadow-sm ring-1 ring-border-light focus:ring-2 focus:ring-background-tertiary-light"
					/>
				</div>

				<div class="space-y-2">
					<label for="notes" class="block text-sm font-medium text-text-primary-light">
						Notes (Optional)
					</label>
					<textarea
						id="notes"
						bind:value={formData.notes}
						rows="3"
						placeholder="Add any additional notes about this coffee..."
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
			<button 
				type="submit" 
				class="rounded-md bg-background-tertiary-light px-4 py-2 font-medium text-white transition-all duration-200 hover:bg-opacity-90"
			>
				{bean ? 'Update Bean' : 'Add Bean'}
			</button>
		</div>
	</form>
</div>
