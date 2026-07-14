<script lang="ts">
	import type { BlockAction, CanvasBlock } from '$lib/types/genui';
	import GenUIBlockRenderer from '$lib/components/genui/GenUIBlockRenderer.svelte';

	let { blocks, focusBlockId, onAction, onExecuteAction } = $props<{
		blocks: CanvasBlock[];
		focusBlockId: string | null;
		onAction?: (action: BlockAction) => void;
		onExecuteAction?: (
			executionId: string,
			actionType: string,
			fields: Record<string, unknown>,
			blockId?: string
		) => Promise<unknown>;
	}>();
</script>

<!-- Show one scene and keep only inactive action cards mounted. Shelf switches
     must not discard their edited fields or in-flight requests; ordinary
     evidence can unmount to avoid hidden fetches and chart initialization. -->
<div class="relative h-full overflow-hidden">
	{#each blocks as canvasBlock (canvasBlock.id)}
		{#if canvasBlock.id === focusBlockId || canvasBlock.block.type === 'action-card'}
			<section
				hidden={canvasBlock.id !== focusBlockId}
				aria-label={canvasBlock.title ?? 'Active evidence'}
				class="h-full overflow-auto px-3 py-4 sm:px-4"
			>
				<GenUIBlockRenderer
					block={canvasBlock.block}
					renderMode="canvas"
					{onAction}
					{onExecuteAction}
					canvasBlockId={canvasBlock.id}
				/>
			</section>
		{/if}
	{/each}
</div>
