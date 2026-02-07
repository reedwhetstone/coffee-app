<script lang="ts">
	import type { CoffeeCardsBlock, BlockAction } from '$lib/types/genui';

	let { block, onAction, canvasBlockId } = $props<{
		block: CoffeeCardsBlock;
		onAction?: (action: BlockAction) => void;
		canvasBlockId?: string;
	}>();

	let count = $derived(block.data.length);
	let firstCoffee = $derived(block.data[0]);
	let origin = $derived(firstCoffee?.country || firstCoffee?.continent || '');
	let score = $derived(firstCoffee?.score ? `${firstCoffee.score}pts` : '');

	function handleClick() {
		if (canvasBlockId) {
			onAction?.({ type: 'focus-canvas-block', blockId: canvasBlockId });
		}
	}
</script>

<button
	onclick={handleClick}
	class="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20 transition-all hover:bg-emerald-100 hover:ring-emerald-600/30"
>
	<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
	</svg>
	{#if count === 1}
		<span>{firstCoffee?.name || 'Coffee'}</span>
		{#if origin}<span class="text-emerald-500">{origin}</span>{/if}
		{#if score}<span class="text-emerald-500">{score}</span>{/if}
	{:else}
		<span>{count} coffees</span>
	{/if}
	<svg class="h-3 w-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
	</svg>
</button>
