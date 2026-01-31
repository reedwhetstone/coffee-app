<script lang="ts">
	import { untrack } from 'svelte';

	const props = $props<{
		sale?: any;
		onClose: () => void;
		onSubmit: (sale: any) => void;
		availableCoffees?: any[];
		availableBatches?: any[];
		catalogBeans?: any[];
	}>();

	const {
		onClose,
		onSubmit,
		availableCoffees = [],
		availableBatches = [],
		catalogBeans = []
	} = props;

	// Capture the initial sale value using untrack - this is intentional as we only need initial value for form
	const sale = untrack(() => props.sale ?? null);

	// Extract defaultBean from sale if it exists
	const defaultBean = sale?.defaultBean || null;

	let formData = $state(
		sale?.id
			? { ...sale }
			: {
					green_coffee_inv_id: defaultBean?.id || '',
					oz_sold: 0,
					price: 0,
					buyer: '',
					batch_name: '',
					sell_date: new Date().toISOString().split('T')[0],
					purchase_date: defaultBean?.purchase_date || new Date().toISOString().split('T')[0],
					coffee_name: defaultBean?.coffee_name || ''
				}
	);

	async function handleSubmit() {
		const isUpdate = sale?.id !== undefined && sale?.id !== null;

		try {
			const cleanedSale = Object.fromEntries(
				Object.entries(formData).map(([key, value]) => [
					key,
					value === '' || value === undefined ? null : value
				])
			);

			const response = await fetch(isUpdate ? `/api/profit?id=${sale.id}` : '/api/profit', {
				method: isUpdate ? 'PUT' : 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(cleanedSale)
			});

			if (response.ok) {
				const newSale = await response.json();
				onSubmit(newSale);
				onClose();
			} else {
				const data = await response.json();
				alert(`Failed to ${isUpdate ? 'update' : 'create'} sale: ${data.error}`);
			}
		} catch (error) {
			console.error(`Error ${isUpdate ? 'updating' : 'creating'} sale:`, error);
		}
	}

	// Handle coffee selection
	function handleCoffeeChange(event: Event) {
		const selectedCoffeeId = (event.target as HTMLSelectElement).value;
		const selectedCoffee = availableCoffees.find(
			(coffee: any) => coffee.id.toString() === selectedCoffeeId
		);

		if (selectedCoffee) {
			formData.coffee_name =
				selectedCoffee.name || selectedCoffee.coffee_catalog?.name || 'Unknown Coffee';
			formData.green_coffee_inv_id = selectedCoffee.id;
			formData.purchase_date = selectedCoffee.purchase_date;

			// Clear batch selection when coffee changes
			formData.batch_name = '';
		}
	}

	// Handle batch selection
	function handleBatchChange(event: Event) {
		const selectedBatchName = (event.target as HTMLSelectElement).value;
		const selectedBatch = availableBatches.find(
			(batch: any) => batch.batch_name === selectedBatchName
		);

		if (selectedBatch) {
			// If a batch is selected, auto-select the coffee for that batch
			const batchCoffee = availableCoffees.find(
				(coffee: any) => coffee.id === selectedBatch.coffee_id
			);

			if (batchCoffee) {
				formData.green_coffee_inv_id = batchCoffee.id;
				formData.coffee_name =
					batchCoffee.name || batchCoffee.coffee_catalog?.name || 'Unknown Coffee';
				formData.purchase_date = batchCoffee.purchase_date;
			}
		}

		formData.batch_name = selectedBatchName;
	}

	// Reactive filtered batches based on selected coffee
	let filteredBatches = $derived(() => {
		if (!formData.green_coffee_inv_id || !availableBatches.length) {
			return availableBatches;
		}

		return availableBatches.filter(
			(batch: any) => batch.coffee_id?.toString() === formData.green_coffee_inv_id?.toString()
		);
	});

	// Reactive filtered coffees based on selected batch
	let filteredCoffees = $derived(() => {
		if (!formData.batch_name || !availableBatches.length) {
			return availableCoffees;
		}

		const selectedBatch = availableBatches.find(
			(batch: any) => batch.batch_name === formData.batch_name
		);

		if (!selectedBatch) {
			return availableCoffees;
		}

		return availableCoffees.filter((coffee: any) => coffee.id === selectedBatch.coffee_id);
	});
</script>

<!-- Clean card-based form design matching home page patterns -->
<div class="rounded-lg bg-background-secondary-light p-6 shadow-sm">
	<div class="mb-6">
		<h2 class="text-2xl font-bold text-text-primary-light">
			{sale?.id ? 'Edit Sale' : 'Add New Sale'}
		</h2>
		<p class="mt-2 text-text-secondary-light">Record a coffee sale and track your profit</p>
	</div>

	<form
		onsubmit={(e) => {
			e.preventDefault();
			handleSubmit();
		}}
		class="space-y-6"
	>
		<!-- Coffee Selection Section -->
		<div class="rounded-lg bg-background-primary-light p-4 ring-1 ring-border-light">
			<h3 class="mb-4 text-lg font-semibold text-text-primary-light">Coffee Details</h3>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div class="space-y-2">
					<label for="coffee_name" class="block text-sm font-medium text-text-primary-light">
						Coffee Name
					</label>
					<select
						id="coffee_name"
						class="block w-full rounded-md border-0 bg-background-secondary-light px-3 py-2 text-text-primary-light shadow-sm ring-1 ring-border-light focus:ring-2 focus:ring-background-tertiary-light"
						value={formData.green_coffee_inv_id}
						onchange={handleCoffeeChange}
						required
					>
						<option value="">Select a coffee...</option>
						{#each filteredCoffees() as coffee}
							<option value={coffee.id}
								>{coffee.name || coffee.coffee_catalog?.name || 'Unknown Coffee'}</option
							>
						{/each}
					</select>
				</div>

				<div class="space-y-2">
					<label for="batch_name" class="block text-sm font-medium text-text-primary-light">
						Batch Name <span class="text-text-secondary-light">(optional)</span>
					</label>
					<select
						id="batch_name"
						class="block w-full rounded-md border-0 bg-background-secondary-light px-3 py-2 text-text-primary-light shadow-sm ring-1 ring-border-light focus:ring-2 focus:ring-background-tertiary-light"
						value={formData.batch_name}
						onchange={handleBatchChange}
					>
						<option value="">Select a batch (optional)...</option>
						{#each filteredBatches() as batch}
							<option value={batch.batch_name}>{batch.batch_name}</option>
						{/each}
					</select>
				</div>
			</div>
		</div>

		<!-- Sale Details Section -->
		<div class="rounded-lg bg-background-primary-light p-4 ring-1 ring-border-light">
			<h3 class="mb-4 text-lg font-semibold text-text-primary-light">Sale Information</h3>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div class="space-y-2">
					<label for="sell_date" class="block text-sm font-medium text-text-primary-light">
						Sale Date
					</label>
					<input
						id="sell_date"
						type="date"
						bind:value={formData.sell_date}
						class="block w-full rounded-md border-0 bg-background-secondary-light px-3 py-2 text-text-primary-light shadow-sm ring-1 ring-border-light focus:ring-2 focus:ring-background-tertiary-light"
						required
					/>
				</div>

				<div class="space-y-2">
					<label for="buyer" class="block text-sm font-medium text-text-primary-light">
						Buyer
					</label>
					<input
						id="buyer"
						type="text"
						bind:value={formData.buyer}
						placeholder="Customer name or company"
						class="block w-full rounded-md border-0 bg-background-secondary-light px-3 py-2 text-text-primary-light placeholder-text-secondary-light shadow-sm ring-1 ring-border-light focus:ring-2 focus:ring-background-tertiary-light"
						required
					/>
				</div>

				<div class="space-y-2">
					<label for="oz_sold" class="block text-sm font-medium text-text-primary-light">
						Amount Sold (oz)
					</label>
					<input
						id="oz_sold"
						type="number"
						step="0.1"
						min="0"
						bind:value={formData.oz_sold}
						placeholder="0.0"
						class="block w-full rounded-md border-0 bg-background-secondary-light px-3 py-2 text-text-primary-light placeholder-text-secondary-light shadow-sm ring-1 ring-border-light focus:ring-2 focus:ring-background-tertiary-light"
						required
					/>
				</div>

				<div class="space-y-2">
					<label for="price" class="block text-sm font-medium text-text-primary-light">
						Sale Price ($)
					</label>
					<input
						id="price"
						type="number"
						step="0.01"
						min="0"
						bind:value={formData.price}
						placeholder="0.00"
						class="block w-full rounded-md border-0 bg-background-secondary-light px-3 py-2 text-text-primary-light placeholder-text-secondary-light shadow-sm ring-1 ring-border-light focus:ring-2 focus:ring-background-tertiary-light"
						required
					/>
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
				{sale?.id ? 'Update Sale' : 'Create Sale'}
			</button>
		</div>
	</form>
</div>
