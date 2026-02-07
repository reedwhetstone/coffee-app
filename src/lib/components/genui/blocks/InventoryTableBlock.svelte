<script lang="ts">
	import type { InventoryTableBlock, BlockAction } from '$lib/types/genui';

	let { block, onAction: _onAction } = $props<{
		block: InventoryTableBlock;
		onAction?: (action: BlockAction) => void;
	}>();

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function getCoffeeName(item: any): string {
		return item.coffee_name || item.coffee_catalog?.name || item.name || 'Unknown';
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function getSource(item: any): string {
		return item.coffee_catalog?.source || item.source || '-';
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function getCostPerLb(item: any): string {
		const qty = item.purchased_qty_lbs || 0;
		const cost = (item.bean_cost || 0) + (item.tax_ship_cost || 0);
		if (qty > 0) return (cost / qty).toFixed(2);
		return '-';
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function getRoastCount(item: any): number {
		return item.roast_summary?.total_roasts || 0;
	}
</script>

<div class="my-4">
	<h3 class="mb-3 font-semibold text-text-primary-light">
		Inventory ({block.data.length} beans)
	</h3>
	<div class="overflow-x-auto rounded-lg ring-1 ring-border-light">
		<table class="w-full text-sm">
			<thead>
				<tr
					class="border-b border-border-light bg-background-secondary-light text-left text-xs font-medium text-text-secondary-light"
				>
					<th class="sticky left-0 bg-background-secondary-light px-3 py-2">Name</th>
					<th class="px-3 py-2">Source</th>
					<th class="px-3 py-2 text-right">Qty (lbs)</th>
					<th class="px-3 py-2 text-right">Cost/lb</th>
					<th class="px-3 py-2 text-center">Stocked</th>
					<th class="px-3 py-2 text-right">Roasts</th>
				</tr>
			</thead>
			<tbody>
				{#each block.data as item (item.id)}
					<tr
						class="border-b border-border-light last:border-0 hover:bg-background-secondary-light/50"
					>
						<td
							class="sticky left-0 bg-background-primary-light px-3 py-2 font-medium text-text-primary-light"
						>
							{getCoffeeName(item)}
						</td>
						<td class="px-3 py-2 text-text-secondary-light">{getSource(item)}</td>
						<td class="px-3 py-2 text-right text-text-primary-light">
							{item.purchased_qty_lbs || '-'}
						</td>
						<td class="px-3 py-2 text-right text-text-primary-light">
							${getCostPerLb(item)}
						</td>
						<td class="px-3 py-2 text-center">
							{#if item.stocked}
								<span class="inline-block h-2 w-2 rounded-full bg-green-500"></span>
							{:else}
								<span class="inline-block h-2 w-2 rounded-full bg-gray-300"></span>
							{/if}
						</td>
						<td class="px-3 py-2 text-right text-text-secondary-light">
							{getRoastCount(item)}
						</td>
					</tr>
				{/each}
			</tbody>
			{#if block.summary}
				<tfoot>
					<tr
						class="border-t-2 border-border-light bg-background-secondary-light text-xs font-medium text-text-primary-light"
					>
						<td class="sticky left-0 bg-background-secondary-light px-3 py-2">
							Total ({block.summary.stocked_beans} stocked)
						</td>
						<td class="px-3 py-2"></td>
						<td class="px-3 py-2 text-right font-bold">
							{block.summary.total_weight_lbs.toFixed(1)} lbs
						</td>
						<td class="px-3 py-2 text-right font-bold">
							${block.summary.total_value.toFixed(2)}
						</td>
						<td class="px-3 py-2"></td>
						<td class="px-3 py-2"></td>
					</tr>
				</tfoot>
			{/if}
		</table>
	</div>
</div>
