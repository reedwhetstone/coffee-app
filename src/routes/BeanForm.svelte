<script lang="ts">
	export let bean: any = null;
	export let onClose: () => void;
	export let onSubmit: (bean: any) => void;

	let formData = {
		name: '',
		rank: 0,
		notes: '',
		link: '',
		purchased_qty_lbs: 0,
		bean_cost: 0,
		tax_ship_cost: 0,
		...bean
	};

	async function handleSubmit() {
		const endpoint = bean ? `/api/beans/${bean.id}` : '/api/beans';
		const method = bean ? 'PUT' : 'POST';

		try {
			const response = await fetch(endpoint, {
				method,
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(formData)
			});

			if (response.ok) {
				const result = await response.json();
				onSubmit(result);
			}
		} catch (error) {
			console.error('Error submitting form:', error);
		}
	}
</script>

<form on:submit|preventDefault={handleSubmit} class="space-y-4">
	<h2 class="mb-4 text-xl font-bold text-white">
		{bean ? 'Edit Bean' : 'Add New Bean'}
	</h2>

	<div class="grid grid-cols-2 gap-4">
		<div>
			<label class="block text-sm font-medium text-gray-300">Name</label>
			<input
				type="text"
				bind:value={formData.name}
				class="mt-1 block w-full rounded bg-gray-700 text-white"
				required
			/>
		</div>

		<div>
			<label class="block text-sm font-medium text-gray-300">Rank</label>
			<input
				type="number"
				bind:value={formData.rank}
				class="mt-1 block w-full rounded bg-gray-700 text-white"
				required
			/>
		</div>

		<!-- Add similar input fields for notes, link, purchased_qty_lbs, bean_cost, tax_ship_cost -->
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
