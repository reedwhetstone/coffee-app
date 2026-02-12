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
	class="inline-flex items-center gap-1.5 rounded-md bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-600/20 transition-all hover:bg-purple-100 hover:ring-purple-600/30"
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
	<span class="text-purple-500">flavor profile</span>
	<svg class="h-3 w-3 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="2"
			d="M13 7l5 5m0 0l-5 5m5-5H6"
		/>
	</svg>
</button>
