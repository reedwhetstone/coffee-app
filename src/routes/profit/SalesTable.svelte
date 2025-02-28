<script lang="ts">
	import { formatDateForDisplay } from '$lib/utils/dates';

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
			const aDate = new Date(aVal as string);
			const bDate = new Date(bVal as string);
			return sortDirection === 'asc'
				? aDate.getTime() - bDate.getTime()
				: bDate.getTime() - aDate.getTime();
		}

		if (typeof aVal === 'string' && typeof bVal === 'string') {
			return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
		}

		return sortDirection === 'asc' ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
	});

	export let onEdit: (sale: SaleData) => void;
	export let onDelete: (id: number) => void;

	async function handleDelete(id: number) {
		if (confirm('Are you sure you want to delete this sale?')) {
			try {
				const response = await fetch(`/api/profit?id=${id}`, {
					method: 'DELETE'
				});

				if (response.ok) {
					onDelete(id);
				} else {
					alert('Failed to delete sale');
				}
			} catch (error) {
				console.error('Error deleting sale:', error);
			}
		}
	}
</script>

<div class="mt-8 overflow-hidden overflow-x-auto rounded-lg">
	<table class="bg-background-secondary-light w-full table-auto">
		<thead class="bg-zinc-700 text-xs uppercase text-zinc-400">
			<tr>
				<th
					class="hover:bg-background-primary-light group cursor-pointer px-6 py-3"
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
					class="hover:bg-background-primary-light group cursor-pointer px-6 py-3"
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
					class="hover:bg-background-primary-light group cursor-pointer px-6 py-3"
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
					class="hover:bg-background-primary-light group cursor-pointer px-6 py-3"
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
					class="hover:bg-background-primary-light group cursor-pointer px-6 py-3"
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
					class="hover:bg-background-primary-light group cursor-pointer px-6 py-3"
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
					class="hover:bg-background-primary-light group cursor-pointer px-6 py-3"
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
				<tr
					class="bg-background-secondary-light border-b border-zinc-700 transition-colors hover:bg-zinc-700"
				>
					<td class="whitespace-nowrap px-6 py-4 text-xs text-zinc-300">
						{formatDateForDisplay(sale.sell_date)}
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
					<td class="whitespace-nowrap px-6 py-4 text-xs text-zinc-300">
						<div class="flex gap-2">
							<button
								class="rounded border border-blue-800 px-2 py-1 hover:bg-blue-900"
								on:click={() => onEdit(sale)}
							>
								Edit
							</button>
							<button
								class="rounded border border-red-800 px-2 py-1 hover:bg-red-900"
								on:click={() => handleDelete(sale.id)}
							>
								Delete
							</button>
						</div>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
