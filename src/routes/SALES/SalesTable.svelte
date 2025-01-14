<script lang="ts">
	interface SaleData {
		id: number;
		green_coffee_inv_id: number;
		oz_sold: number;
		price: number;
		buyer: string;
		batch_name: string;
		sell_date: string;
		purchase_date: string;
		coffee_name?: string;
	}

	export let salesData: SaleData[] = [];
	let sortField: string | null = 'sell_date';
	let sortDirection: 'asc' | 'desc' | null = 'desc';

	function toggleSort(field: string) {
		if (sortField === field) {
			if (sortDirection === 'asc') sortDirection = 'desc';
			else if (sortDirection === 'desc') {
				sortField = null;
				sortDirection = null;
			}
		} else {
			sortField = field;
			sortDirection = 'asc';
		}
	}

	$: sortedSales = [...salesData].sort((a, b) => {
		if (!sortField) return 0;

		const aVal = a[sortField as keyof SaleData];
		const bVal = b[sortField as keyof SaleData];

		if (sortField === 'sell_date' || sortField === 'purchase_date') {
			return sortDirection === 'asc'
				? new Date(aVal as string).getTime() - new Date(bVal as string).getTime()
				: new Date(bVal as string).getTime() - new Date(aVal as string).getTime();
		}

		if (typeof aVal === 'string' && typeof bVal === 'string') {
			return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
		}

		return sortDirection === 'asc' ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
	});
</script>

<div class="mt-8 overflow-hidden overflow-x-auto rounded-lg">
	<table class="w-full table-auto bg-zinc-800">
		<thead class="bg-zinc-700 text-xs uppercase text-zinc-400">
			<tr>
				<th
					class="group cursor-pointer px-6 py-3 hover:bg-zinc-600"
					on:click={() => toggleSort('sell_date')}
				>
					<div class="flex items-center gap-2">
						Sell Date
						{#if sortField === 'sell_date'}
							{#if sortDirection === 'asc'}
								<span>↑</span>
							{:else if sortDirection === 'desc'}
								<span>↓</span>
							{/if}
						{:else}
							<span class="opacity-0 group-hover:opacity-50">↕</span>
						{/if}
					</div>
				</th>
				<th
					class="group cursor-pointer px-6 py-3 hover:bg-zinc-600"
					on:click={() => toggleSort('coffee_name')}
				>
					<div class="flex items-center gap-2">
						Coffee
						{#if sortField === 'coffee_name'}
							{#if sortDirection === 'asc'}
								<span>↑</span>
							{:else if sortDirection === 'desc'}
								<span>↓</span>
							{/if}
						{:else}
							<span class="opacity-0 group-hover:opacity-50">↕</span>
						{/if}
					</div>
				</th>
				<th
					class="group cursor-pointer px-6 py-3 hover:bg-zinc-600"
					on:click={() => toggleSort('batch_name')}
				>
					<div class="flex items-center gap-2">
						Batch
						{#if sortField === 'batch_name'}
							{#if sortDirection === 'asc'}
								<span>↑</span>
							{:else if sortDirection === 'desc'}
								<span>↓</span>
							{/if}
						{:else}
							<span class="opacity-0 group-hover:opacity-50">↕</span>
						{/if}
					</div>
				</th>
				<th
					class="group cursor-pointer px-6 py-3 hover:bg-zinc-600"
					on:click={() => toggleSort('buyer')}
				>
					<div class="flex items-center gap-2">
						Buyer
						{#if sortField === 'buyer'}
							{#if sortDirection === 'asc'}
								<span>↑</span>
							{:else if sortDirection === 'desc'}
								<span>↓</span>
							{/if}
						{:else}
							<span class="opacity-0 group-hover:opacity-50">↕</span>
						{/if}
					</div>
				</th>
				<th
					class="group cursor-pointer px-6 py-3 hover:bg-zinc-600"
					on:click={() => toggleSort('oz_sold')}
				>
					<div class="flex items-center gap-2">
						Amount (oz)
						{#if sortField === 'oz_sold'}
							{#if sortDirection === 'asc'}
								<span>↑</span>
							{:else if sortDirection === 'desc'}
								<span>↓</span>
							{/if}
						{:else}
							<span class="opacity-0 group-hover:opacity-50">↕</span>
						{/if}
					</div>
				</th>
				<th
					class="group cursor-pointer px-6 py-3 hover:bg-zinc-600"
					on:click={() => toggleSort('price')}
				>
					<div class="flex items-center gap-2">
						Price
						{#if sortField === 'price'}
							{#if sortDirection === 'asc'}
								<span>↑</span>
							{:else if sortDirection === 'desc'}
								<span>↓</span>
							{/if}
						{:else}
							<span class="opacity-0 group-hover:opacity-50">↕</span>
						{/if}
					</div>
				</th>
				<th
					class="group cursor-pointer px-6 py-3 hover:bg-zinc-600"
					on:click={() => toggleSort('purchase_date')}
				>
					<div class="flex items-center gap-2">
						Purchase Date
						{#if sortField === 'purchase_date'}
							{#if sortDirection === 'asc'}
								<span>↑</span>
							{:else if sortDirection === 'desc'}
								<span>↓</span>
							{/if}
						{:else}
							<span class="opacity-0 group-hover:opacity-50">↕</span>
						{/if}
					</div>
				</th>
			</tr>
		</thead>
		<tbody>
			{#each sortedSales as sale}
				<tr class="border-b border-zinc-700 bg-zinc-800 transition-colors hover:bg-zinc-700">
					<td class="whitespace-nowrap px-6 py-4 text-xs text-zinc-300">
						{new Date(sale.sell_date).toLocaleDateString()}
					</td>
					<td class="whitespace-nowrap px-6 py-4 text-xs text-zinc-300">
						{sale.coffee_name || '-'}
					</td>
					<td class="whitespace-nowrap px-6 py-4 text-xs text-zinc-300">
						{sale.batch_name}
					</td>
					<td class="whitespace-nowrap px-6 py-4 text-xs text-zinc-300">
						{sale.buyer}
					</td>
					<td class="whitespace-nowrap px-6 py-4 text-xs text-zinc-300">
						{sale.oz_sold}
					</td>
					<td class="whitespace-nowrap px-6 py-4 text-xs text-zinc-300">
						${sale.price}
					</td>
					<td class="whitespace-nowrap px-6 py-4 text-xs text-zinc-300">
						{new Date(sale.purchase_date).toLocaleDateString()}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
