<script lang="ts">
	import type { TastingRadarBlock, BlockAction } from '$lib/types/genui';

	let { block, onAction, canvasBlockId } = $props<{
		block: TastingRadarBlock;
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
	class="inline-flex items-center gap-1.5 rounded-md bg-intelligence-subtle px-2.5 py-1 text-xs font-medium text-intelligence-strong ring-1 ring-inset ring-intelligence/20 transition-all hover:bg-intelligence/15 hover:ring-intelligence/30"
>
	<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="2"
			d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"
		/>
	</svg>
	<span>{block.data.beanName}</span>
	<span class="text-intelligence">flavor profile</span>
	<svg class="h-3 w-3 text-intelligence" fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="2"
			d="M13 7l5 5m0 0l-5 5m5-5H6"
		/>
	</svg>
</button>
