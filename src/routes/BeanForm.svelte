<script lang="ts">
	export let bean: any = null;
	export let onClose: () => void;
	export let onSubmit: (bean: any) => void;

	let formData = bean
		? { ...bean }
		: {
				name: '',
				rank: null,
				notes: '',
				purchase_date: '',
				purchased_qty_lbs: 0,
				bean_cost: 0,
				tax_ship_cost: 0,
				link: '',
				last_updated: new Date().toISOString()
			};

	async function handleSubmit() {
		try {
			// Convert empty strings to null and ensure last_updated is current
			const cleanedBean = Object.fromEntries(
				Object.entries(formData).map(([key, value]) => [
					key,
					value === '' || value === undefined ? null : value
				])
			);

			// Update last_updated timestamp
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
</script>

<form on:submit|preventDefault={handleSubmit} class="space-y-4">
	<h2 class="mb-4 text-xl font-bold text-white">
		{bean ? 'Edit Bean' : 'Add New Bean'}
	</h2>

	<div class="grid grid-cols-2 gap-4">
		<div>
			<label for="name" class="block text-sm font-medium text-gray-300">Name</label>
			<input
				id="name"
				type="text"
				bind:value={formData.name}
				class="mt-1 block w-full rounded bg-gray-700 text-white"
				required
			/>
		</div>

		<div>
			<label for="rank" class="block text-sm font-medium text-gray-300">Rank</label>
			<input
				id="rank"
				type="number"
				min="0"
				max="10"
				bind:value={formData.rank}
				class="mt-1 block w-full rounded bg-gray-700 text-white"
				required
			/>
		</div>

		<div>
			<label for="purchase_date" class="block text-sm font-medium text-gray-300"
				>Purchase Date</label
			>
			<input
				id="purchase_date"
				type="date"
				bind:value={formData.purchase_date}
				class="mt-1 block w-full rounded bg-gray-700 text-white"
				required
			/>
		</div>

		<div>
			<label for="purchased_qty" class="block text-sm font-medium text-gray-300"
				>Purchased Quantity (lbs)</label
			>
			<input
				id="purchased_qty"
				type="number"
				step="0.01"
				bind:value={formData.purchased_qty_lbs}
				class="mt-1 block w-full rounded bg-gray-700 text-white"
				required
			/>
		</div>

		<div>
			<label for="bean_cost" class="block text-sm font-medium text-gray-300">Bean Cost</label>
			<input
				id="bean_cost"
				type="number"
				step="0.01"
				bind:value={formData.bean_cost}
				class="mt-1 block w-full rounded bg-gray-700 text-white"
				required
			/>
		</div>

		<div>
			<label for="tax_ship_cost" class="block text-sm font-medium text-gray-300"
				>Tax & Shipping Cost</label
			>
			<input
				id="tax_ship_cost"
				type="number"
				step="0.01"
				bind:value={formData.tax_ship_cost}
				class="mt-1 block w-full rounded bg-gray-700 text-white"
				required
			/>
		</div>

		<div class="col-span-2">
			<label for="link" class="block text-sm font-medium text-gray-300">Link</label>
			<input
				id="link"
				type="url"
				bind:value={formData.link}
				class="mt-1 block w-full rounded bg-gray-700 text-white"
			/>
		</div>

		<div class="col-span-2">
			<label for="notes" class="block text-sm font-medium text-gray-300">Notes</label>
			<textarea
				id="notes"
				bind:value={formData.notes}
				rows="3"
				class="mt-1 block w-full rounded bg-gray-700 text-white"
			></textarea>
		</div>
	</div>

	<div class="mt-4 flex justify-end space-x-2">
		<button type="button" class="rounded bg-gray-600 px-4 py-2 text-white" on:click={onClose}>
			Cancel
		</button>
		<button type="submit" class="rounded bg-green-600 px-4 py-2 text-white">
			{bean ? 'Update' : 'Create'}
		</button>
	</div>
</form>
