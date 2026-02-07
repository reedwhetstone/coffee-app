<script lang="ts">
	import type { RoastProfilesBlock, BlockAction } from '$lib/types/genui';

	let { block, onAction, canvasBlockId } = $props<{
		block: RoastProfilesBlock;
		onAction?: (action: BlockAction) => void;
		canvasBlockId?: string;
	}>();

	let count = $derived(block.data.length);
	let firstRoast = $derived(block.data[0]);

	function handleClick() {
		if (canvasBlockId) {
			onAction?.({ type: 'focus-canvas-block', blockId: canvasBlockId });
		}
	}
</script>

<button
	onclick={handleClick}
	class="inline-flex items-center gap-1.5 rounded-md bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700 ring-1 ring-inset ring-orange-600/20 transition-all hover:bg-orange-100 hover:ring-orange-600/30"
>
	<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
	</svg>
	{#if count === 1 && firstRoast}
		<span>{firstRoast.batch_name || firstRoast.coffee_name || 'Roast profile'}</span>
	{:else}
		<span>{count} roast profile{count === 1 ? '' : 's'}</span>
	{/if}
	<svg class="h-3 w-3 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
	</svg>
</button>
