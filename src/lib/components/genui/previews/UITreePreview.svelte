<script lang="ts">
	import type { BlockAction, UITreeBlock } from '$lib/types/genui';

	let { block, onAction, canvasBlockId } = $props<{
		block: UITreeBlock;
		onAction?: (action: BlockAction) => void;
		canvasBlockId?: string;
	}>();
</script>

<button
	type="button"
	class="inline-flex items-center gap-2 rounded-md bg-surface-panel px-3 py-1.5 text-sm text-ink ring-1 ring-line hover:ring-accent"
	onclick={() =>
		canvasBlockId && onAction?.({ type: 'focus-canvas-block', blockId: canvasBlockId })}
>
	<span class="font-medium">{block.data.title ?? 'Workspace'}</span>
	<span class="text-xs text-muted">Open on canvas</span>
</button>
