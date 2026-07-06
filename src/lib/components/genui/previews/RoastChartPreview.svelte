<script lang="ts">
	import type { RoastChartBlock, BlockAction } from '$lib/types/genui';

	let { block, onAction, canvasBlockId } = $props<{
		block: RoastChartBlock;
		onAction?: (action: BlockAction) => void;
		canvasBlockId?: string;
	}>();

	function handleClick() {
		if (canvasBlockId) {
			onAction?.({ type: 'focus-canvas-block', blockId: canvasBlockId });
		}
	}
</script>

<button
	onclick={handleClick}
	class="inline-flex items-center gap-1.5 rounded-md bg-warning-subtle px-2.5 py-1 text-xs font-medium text-warning-strong ring-1 ring-inset ring-warning/20 transition-all hover:bg-warning/15 hover:ring-warning/30"
>
	<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="2"
			d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
		/>
	</svg>
	<span>Roast #{block.data.roastId} chart</span>
	<svg class="h-3 w-3 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="2"
			d="M13 7l5 5m0 0l-5 5m5-5H6"
		/>
	</svg>
</button>
