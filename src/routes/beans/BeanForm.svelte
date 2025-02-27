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
					name: '',
					rank: null,
					notes: '',
					purchase_date: '',
					purchased_qty_lbs: 0,
					bean_cost: 0.0,
					tax_ship_cost: 0.0,
					link: '',
					last_updated: new Date().toISOString(),
					// Add all the new fields that match coffee_catalog
					score_value: null,
					arrival_date: '',
					region: '',
					processing: '',
					drying_method: '',
					lot_size: '',
					bag_size: '',
					packaging: '',
					cultivar_detail: '',
					grade: '',
					appearance: '',
					roast_recs: '',
					type: '',
					description_short: '',
					description_long: '',
					farm_notes: '',
					catalog_id: null
				}
	);

	function resetFormData() {
		formData = {
			name: '',
			rank: null,
			notes: '',
			purchase_date: '',
			purchased_qty_lbs: 0,
			bean_cost: 0.0,
			tax_ship_cost: 0.0,
			link: '',
			last_updated: new Date().toISOString(),
			score_value: null,
			arrival_date: '',
			region: '',
			processing: '',
			drying_method: '',
			lot_size: '',
			bag_size: '',
			packaging: '',
			cultivar_detail: '',
			grade: '',
			appearance: '',
			roast_recs: '',
			type: '',
			description_short: '',
			description_long: '',
			farm_notes: '',
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

		// Create a comprehensive mapping from coffee_catalog to green_coffee_inv
		formData = {
			...formData, // Keep existing fields like purchase_date that aren't from catalog

			// Map catalog fields to form fields
			name: catalogBean.name,
			score_value: catalogBean.score_value,
			arrival_date: catalogBean.arrival_date || '',
			region: catalogBean.region || '',
			processing: catalogBean.processing || '',
			drying_method: catalogBean.drying_method || '',
			lot_size: catalogBean.lot_size || '',
			bag_size: catalogBean.bag_size || '',
			packaging: catalogBean.packaging || '',
			cultivar_detail: catalogBean.cultivar_detail || '',
			grade: catalogBean.grade || '',
			appearance: catalogBean.appearance || '',
			roast_recs: catalogBean.roast_recs || '',
			type: catalogBean.type || '',
			description_short: catalogBean.description_short || '',
			description_long: catalogBean.description_long || '',
			farm_notes: catalogBean.farm_notes || '',
			link: catalogBean.link || '',
			// Format bean_cost to ensure it's a proper decimal number
			bean_cost:
				typeof catalogBean.cost_lb === 'number' ? parseFloat(catalogBean.cost_lb.toFixed(2)) : 0.0,
			catalog_id: catalogBean.id,
			cupping_notes: catalogBean.cupping_notes || '',
			source: catalogBean.source || ''
		};

		// Log to ensure we're mapping everything correctly
		console.log('Populated form from catalog bean:', { catalogBean, formData });
	}

	async function handleSubmit() {
		try {
			const cleanedBean = Object.fromEntries(
				Object.entries(formData).map(([key, value]) => [
					key,
					value === '' || value === undefined ? null : value
				])
			);

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
	<h2 class="mb-4 text-xl font-bold text-zinc-300">
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
				<label for="source" class="block text-sm font-medium text-zinc-300">Filter by Source</label>
				<select
					id="source"
					bind:value={sourceFilter}
					onchange={handleSourceChange}
					class="mt-1 block w-full rounded bg-zinc-700 text-zinc-300"
				>
					<option value="">All Sources</option>
					{#each [...new Set(catalogBeans.map((b) => b.source))] as source}
						<option value={source}>{source}</option>
					{/each}
				</select>
			</div>

			<div>
				<label for="catalog-bean" class="block text-sm font-medium text-zinc-300">Select Bean</label
				>
				<select
					id="catalog-bean"
					class="mt-1 block w-full rounded bg-zinc-700 text-zinc-300"
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

	<!-- Existing form fields -->
	<div class="grid grid-cols-2 gap-4">
		<div>
			<label for="name" class="block text-sm font-medium text-zinc-300">Name</label>
			<input
				id="name"
				type="text"
				bind:value={formData.name}
				class="mt-1 block w-full rounded bg-zinc-700 text-zinc-300"
				required
			/>
		</div>

		<div>
			<label for="purchase_date" class="block text-sm font-medium text-zinc-300"
				>Purchase Date</label
			>
			<input
				id="purchase_date"
				type="date"
				bind:value={formData.purchase_date}
				class="mt-1 block w-full rounded bg-zinc-700 text-zinc-300"
				required
			/>
		</div>

		<div>
			<label for="purchased_qty" class="block text-sm font-medium text-zinc-300"
				>Purchased Quantity (lbs)</label
			>
			<input
				id="purchased_qty"
				type="number"
				step="1"
				bind:value={formData.purchased_qty_lbs}
				class="mt-1 block w-full rounded bg-zinc-700 text-zinc-300"
				required
			/>
		</div>

		<div>
			<label for="bean_cost" class="block text-sm font-medium text-zinc-300">Bean Cost</label>
			<input
				id="bean_cost"
				type="number"
				step="0.01"
				min="0"
				placeholder="0.00"
				bind:value={formData.bean_cost}
				class="mt-1 block w-full rounded bg-zinc-700 text-zinc-300"
				required
			/>
		</div>

		<div>
			<label for="tax_ship_cost" class="block text-sm font-medium text-zinc-300"
				>Tax & Shipping Cost</label
			>
			<input
				id="tax_ship_cost"
				type="number"
				step="0.01"
				min="0"
				placeholder="0.00"
				bind:value={formData.tax_ship_cost}
				class="mt-1 block w-full rounded bg-zinc-700 text-zinc-300"
				required
			/>
		</div>

		<div class="col-span-2">
			<label for="link" class="block text-sm font-medium text-zinc-300">Link</label>
			<input
				id="link"
				type="url"
				bind:value={formData.link}
				class="mt-1 block w-full rounded bg-zinc-700 text-zinc-300"
			/>
		</div>

		<div class="col-span-2">
			<label for="notes" class="block text-sm font-medium text-zinc-300">Notes</label>
			<textarea
				id="notes"
				bind:value={formData.notes}
				rows="3"
				class="mt-1 block w-full rounded bg-zinc-700 text-zinc-300"
			></textarea>
		</div>
	</div>

	<div class="mt-4 flex justify-end space-x-2">
		<button type="button" class="rounded bg-zinc-600 px-4 py-2 text-zinc-300" onclick={onClose}>
			Cancel
		</button>
		<button type="submit" class="rounded bg-green-600 px-4 py-2 text-zinc-300">
			{bean ? 'Update' : 'Create'}
		</button>
	</div>
</form>
