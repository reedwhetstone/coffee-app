<script lang="ts">
	export let sale: any = null;
	export let onClose: () => void;
	export let onSubmit: (sale: any) => void;

	let availableCoffees: any[] = [];
	let availableBatches: any[] = [];

	// Fetch available coffees and batches on component mount
	async function loadData() {
		try {
			// Fetch coffees from green_coffee_inv
			const coffeeResponse = await fetch('/api/data');
			if (coffeeResponse.ok) {
				const coffeeData = await coffeeResponse.json();
				// Get unique coffee names
				const uniqueBeans = [...new Set(coffeeData.data.map((profile: any) => profile.name))];
				availableCoffees = uniqueBeans.map((name) => ({ name: name }));
			}

			// Fetch batches from roast_profiles
			const batchResponse = await fetch('/api/roast-profiles');
			if (batchResponse.ok) {
				const batchData = await batchResponse.json();
				// Get unique batch names
				const uniqueBatches = [
					...new Set(batchData.data.map((profile: any) => profile.batch_name))
				];
				availableBatches = uniqueBatches.map((name) => ({ batch_name: name }));
			}
		} catch (error) {
			console.error('Error loading data:', error);
		}
	}

	loadData();

	let formData = sale
		? { ...sale }
		: {
				green_coffee_inv_id: '',
				oz_sold: 0,
				price: 0,
				buyer: '',
				batch_name: '',
				sell_date: new Date().toISOString().split('T')[0],
				purchase_date: new Date().toISOString().split('T')[0],
				coffee_name: ''
			};

	async function handleSubmit() {
		try {
			const cleanedSale = Object.fromEntries(
				Object.entries(formData).map(([key, value]) => [
					key,
					value === '' || value === undefined ? null : value
				])
			);

			const response = await fetch(sale ? `/api/sales?id=${sale.id}` : '/api/sales', {
				method: sale ? 'PUT' : 'POST',
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
				alert(`Failed to ${sale ? 'update' : 'create'} sale: ${data.error}`);
			}
		} catch (error) {
			console.error(`Error ${sale ? 'updating' : 'creating'} sale:`, error);
		}
	}

	// Handle coffee selection
	async function handleCoffeeChange(event: Event) {
		try {
			const selectedCoffeeName = (event.target as HTMLSelectElement).value;

			// Fetch the coffee data to get the ID
			const response = await fetch('/api/data');
			if (!response.ok) {
				throw new Error('Failed to fetch coffee data');
			}

			const data = await response.json();
			const selectedCoffee = data.data.find((coffee: any) => coffee.name === selectedCoffeeName);

			if (selectedCoffee) {
				formData.coffee_name = selectedCoffee.name;
				formData.green_coffee_inv_id = selectedCoffee.id;
				formData.purchase_date = selectedCoffee.purchase_date;
			}
		} catch (error) {
			console.error('Error updating coffee selection:', error);
		}
	}
</script>

<form on:submit|preventDefault={handleSubmit} class="space-y-4">
	<h2 class="mb-4 text-xl font-bold text-zinc-300">
		{sale ? 'Edit Sale' : 'Add New Sale'}
	</h2>

	<div class="grid grid-cols-2 gap-4">
		<div>
			<label for="coffee_name" class="block text-sm font-medium text-zinc-300">Coffee Name</label>
			<select
				id="coffee_name"
				class="mt-1 block w-full rounded bg-zinc-700 text-zinc-300"
				value={formData.coffee_name}
				on:change={handleCoffeeChange}
				required
			>
				<option value="">Select a coffee...</option>
				{#each availableCoffees as coffee}
					<option value={coffee.name}>{coffee.name}</option>
				{/each}
			</select>
		</div>

		<div>
			<label for="batch_name" class="block text-sm font-medium text-zinc-300">Batch Name</label>
			<select
				id="batch_name"
				class="mt-1 block w-full rounded bg-zinc-700 text-zinc-300"
				bind:value={formData.batch_name}
				required
			>
				<option value="">Select a batch...</option>
				{#each availableBatches as batch}
					<option value={batch.batch_name}>{batch.batch_name}</option>
				{/each}
			</select>
		</div>

		<div>
			<label for="sell_date" class="block text-sm font-medium text-zinc-300">Sell Date</label>
			<input
				id="sell_date"
				type="date"
				bind:value={formData.sell_date}
				class="mt-1 block w-full rounded bg-zinc-700 text-zinc-300"
				required
			/>
		</div>

		<div>
			<label for="buyer" class="block text-sm font-medium text-zinc-300">Buyer</label>
			<input
				id="buyer"
				type="text"
				bind:value={formData.buyer}
				class="mt-1 block w-full rounded bg-zinc-700 text-zinc-300"
				required
			/>
		</div>

		<div>
			<label for="oz_sold" class="block text-sm font-medium text-zinc-300">Amount (oz)</label>
			<input
				id="oz_sold"
				type="number"
				step="0.1"
				bind:value={formData.oz_sold}
				class="mt-1 block w-full rounded bg-zinc-700 text-zinc-300"
				required
			/>
		</div>

		<div>
			<label for="price" class="block text-sm font-medium text-zinc-300">Price</label>
			<input
				id="price"
				type="number"
				step="0.01"
				bind:value={formData.price}
				class="mt-1 block w-full rounded bg-zinc-700 text-zinc-300"
				required
			/>
		</div>
	</div>

	<div class="mt-4 flex justify-end space-x-2">
		<button type="button" class="rounded bg-zinc-600 px-4 py-2 text-zinc-300" on:click={onClose}>
			Cancel
		</button>
		<button type="submit" class="rounded bg-green-600 px-4 py-2 text-zinc-300">
			{sale ? 'Update' : 'Create'}
		</button>
	</div>
</form>
