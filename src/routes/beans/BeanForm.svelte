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
	function handleSourceChange(e: Event) {
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

<form
	onsubmit={(e) => {
		e.preventDefault();
		handleSubmit();
	}}
	class="space-y-4"
>
	<h2 class="mb-4 text-xl font-bold text-text-primary-light">
		{bean ? 'Edit Bean' : 'Add New Bean'}
	</h2>

	<!-- Entry Type Toggle -->
	<div class="mb-4">
		<label class="inline-flex items-center">
			<input
				type="radio"
				bind:group={isManualEntry}
				value={true}
				onchange={resetFormData}
				class="form-radio"
			/>
			<span class="ml-2">Manual Entry</span>
		</label>
		<label class="ml-6 inline-flex items-center">
			<input type="radio" bind:group={isManualEntry} value={false} class="form-radio" />
			<span class="ml-2">Select from Catalog</span>
		</label>
	</div>

	{#if !isManualEntry}
		<!-- Catalog Selection -->
		<div class="space-y-4">
			<div>
				<label for="source" class="block text-sm font-medium text-text-primary-light"
					>Filter by Source</label
				>
				<select
					id="source"
					bind:value={sourceFilter}
					onchange={handleSourceChange}
					class="mt-1 block w-full rounded bg-background-tertiary-light text-text-primary-light"
				>
					<option value="">All Sources</option>
					{#each [...new Set(catalogBeans.map((b) => b.source))] as source}
						<option value={source}>{source}</option>
					{/each}
				</select>
			</div>

			<div>
				<label for="catalog-bean" class="block text-sm font-medium text-text-primary-light"
					>Select Bean</label
				>
				<select
					id="catalog-bean"
					class="mt-1 block w-full rounded bg-background-tertiary-light text-text-primary-light"
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
	{/if}

	<!-- Selected bean display (catalog selection shows name) -->
	{#if !isManualEntry && selectedCatalogBean}
		<div
			class="mb-4 rounded border border-background-tertiary-light/20 bg-background-tertiary-light/10 p-4"
		>
			<h3 class="font-semibold text-text-primary-light">Selected Coffee:</h3>
			<p class="text-sm text-text-secondary-light">{selectedCatalogBean.name}</p>
			<p class="text-xs text-text-secondary-light">From: {selectedCatalogBean.source}</p>
		</div>
	{/if}

	<!-- User-specific form fields -->
	<div class="grid grid-cols-2 gap-4">
		<!-- Manual entry name field -->
		{#if isManualEntry}
			<div class="col-span-2">
				<label for="manual-name" class="block text-sm font-medium text-text-primary-light"
					>Coffee Name</label
				>
				<input
					id="manual-name"
					type="text"
					bind:value={formData.manual_name}
					class="mt-1 block w-full rounded bg-background-tertiary-light text-text-primary-light"
					required
					placeholder="Enter coffee name for manual entry"
				/>
			</div>
		{/if}

		<div>
			<label for="purchase_date" class="block text-sm font-medium text-text-primary-light"
				>Purchase Date</label
			>
			<input
				id="purchase_date"
				type="date"
				bind:value={formData.purchase_date}
				class="mt-1 block w-full rounded bg-background-tertiary-light text-text-primary-light"
				required
			/>
		</div>

		<div>
			<label for="purchased_qty" class="block text-sm font-medium text-text-primary-light"
				>Purchased Quantity (lbs)</label
			>
			<input
				id="purchased_qty"
				type="number"
				step="1"
				bind:value={formData.purchased_qty_lbs}
				class="mt-1 block w-full rounded bg-background-tertiary-light text-text-primary-light"
				required
			/>
		</div>

		<div>
			<label for="bean_cost" class="block text-sm font-medium text-text-primary-light"
				>Bean Cost</label
			>
			<input
				id="bean_cost"
				type="number"
				step="0.01"
				min="0"
				placeholder="0.00"
				bind:value={formData.bean_cost}
				class="mt-1 block w-full rounded bg-background-tertiary-light text-text-primary-light"
				required
			/>
		</div>

		<div>
			<label for="tax_ship_cost" class="block text-sm font-medium text-text-primary-light"
				>Tax & Shipping Cost</label
			>
			<input
				id="tax_ship_cost"
				type="number"
				step="0.01"
				min="0"
				placeholder="0.00"
				bind:value={formData.tax_ship_cost}
				class="mt-1 block w-full rounded bg-background-tertiary-light text-text-primary-light"
				required
			/>
		</div>

		<div class="col-span-2">
			<label for="link" class="block text-sm font-medium text-text-primary-light">Link</label>
			<input
				id="link"
				type="url"
				bind:value={formData.link}
				class="mt-1 block w-full rounded bg-background-tertiary-light text-text-primary-light"
			/>
		</div>

		<div class="col-span-2">
			<label for="notes" class="block text-sm font-medium text-text-primary-light">Notes</label>
			<textarea
				id="notes"
				bind:value={formData.notes}
				rows="3"
				class="mt-1 block w-full rounded bg-background-tertiary-light text-text-primary-light"
			></textarea>
		</div>
	</div>

	<div class="mt-4 flex justify-end space-x-2">
		<button
			type="button"
			class="rounded bg-background-primary-light px-4 py-2 text-text-primary-light"
			onclick={onClose}
		>
			Cancel
		</button>
		<button type="submit" class="rounded bg-green-600 px-4 py-2 text-text-primary-light">
			{bean ? 'Update' : 'Create'}
		</button>
	</div>
</form>
