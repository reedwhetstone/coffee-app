<script lang="ts">
	import UINodeView from './UINodeView.svelte';
	import { canvasStore } from '$lib/stores/canvasStore.svelte';
	import type { BlockAction, UITreeBlock } from '$lib/types/genui';
	import type { BlockStateValue } from '$lib/genui/catalog';

	let { block, blockId, onAction } = $props<{
		block: UITreeBlock;
		/** Canvas block id that owns the shared state; without it the tree is read-only. */
		blockId?: string;
		onAction?: (action: BlockAction) => void;
	}>();

	let blockState = $derived(
		blockId ? canvasStore.blocks.find((b) => b.id === blockId)?.state : undefined
	);

	function setState(key: string, value: BlockStateValue) {
		if (!blockId) return;
		canvasStore.dispatch({ type: 'set-block-state', blockId, key, value });
	}
</script>

<div class="flex w-full flex-col gap-3">
	{#if block.data.title}
		<h2 class="text-base font-semibold text-ink">{block.data.title}</h2>
	{/if}
	<UINodeView node={block.data.root} {blockState} onState={blockId ? setState : undefined} {onAction} />
</div>
