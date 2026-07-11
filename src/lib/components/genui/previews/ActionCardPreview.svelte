<script lang="ts">
	import type { ActionCardBlock, BlockAction } from '$lib/types/genui';

	let { block, onAction, canvasBlockId } = $props<{
		block: ActionCardBlock;
		onAction?: (action: BlockAction) => void;
		canvasBlockId?: string;
	}>();

	const statusColors: Record<string, string> = {
		proposed: 'bg-warning-subtle text-warning-strong ring-warning/20 hover:bg-warning/15',
		executing: 'bg-info-subtle text-info-strong ring-info/20',
		success: 'bg-success-subtle text-success-strong ring-success/20',
		failed: 'bg-danger-subtle text-danger-strong ring-danger/20 hover:bg-danger/15'
	};

	const statusIcons: Record<string, string> = {
		proposed: 'M12 9v2m0 4h.01',
		executing:
			'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
		success: 'M5 13l4 4L19 7',
		failed: 'M6 18L18 6M6 6l12 12'
	};

	function handleClick() {
		if (canvasBlockId) {
			onAction?.({ type: 'focus-canvas-block', blockId: canvasBlockId });
		}
	}
</script>

<button
	onclick={handleClick}
	class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-all {statusColors[
		block.data.status
	] || statusColors.proposed}"
>
	<svg
		class="h-3.5 w-3.5 {block.data.status === 'executing' ? 'animate-spin' : ''}"
		fill="none"
		stroke="currentColor"
		viewBox="0 0 24 24"
	>
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="2"
			d={statusIcons[block.data.status] || statusIcons.proposed}
		/>
	</svg>
	<span>{block.data.summary}</span>
	{#if block.data.status === 'proposed'}
		<svg class="h-3 w-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M13 7l5 5m0 0l-5 5m5-5H6"
			/>
		</svg>
	{/if}
</button>
