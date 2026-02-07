<script lang="ts">
	import type { InventoryTableBlock, BlockAction } from '$lib/types/genui';

	let { block, onAction, canvasBlockId } = $props<{
		block: InventoryTableBlock;
		onAction?: (action: BlockAction) => void;
		canvasBlockId?: string;
	}>();

	let count = $derived(block.data.length);
	let totalLbs = $derived(
		block.summary?.total_weight_lbs ??
			block.data.reduce((sum: number, b: Record<string, unknown>) => sum + ((b.purchased_qty_lbs as number) || 0), 0)
	);

	function handleClick() {
		if (canvasBlockId) {
			onAction?.({ type: 'focus-canvas-block', blockId: canvasBlockId });
		}
	}
</script>

<button
	onclick={handleClick}
	class="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20 transition-all hover:bg-blue-100 hover:ring-blue-600/30"
>
	<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
	</svg>
	<span>{count} bean{count === 1 ? '' : 's'} in inventory</span>
	{#if totalLbs > 0}
		<span class="text-blue-500">{totalLbs.toFixed(1)} lbs</span>
	{/if}
	<svg class="h-3 w-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
	</svg>
</button>
