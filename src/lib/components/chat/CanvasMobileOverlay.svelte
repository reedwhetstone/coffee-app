<script lang="ts">
	import Canvas from '$lib/components/canvas/Canvas.svelte';
	import { canvasStore } from '$lib/stores/canvasStore.svelte';
	import type { BlockAction } from '$lib/types/genui';

	let {
		variant,
		onClose,
		onAction,
		onScrollToMessage,
		onExecuteAction
	} = $props<{
		/** 'page' variant hides this overlay on md+ screens (desktop has the split pane). */
		variant: 'page' | 'drawer';
		onClose: () => void;
		onAction: (action: BlockAction) => void;
		/**
		 * Called when the user taps a "scroll to message" link inside the canvas.
		 * The overlay closes itself first, then delegates to the workspace to scroll.
		 */
		onScrollToMessage: (messageId: string) => void;
		onExecuteAction: (actionType: string, fields: Record<string, unknown>) => Promise<unknown>;
	}>();
</script>

<!-- Full-screen canvas overlay (always visible on mobile; desktop only in drawer variant) -->
<div
	class="fixed inset-0 z-50 flex flex-col bg-background-primary-light {variant === 'page'
		? 'md:hidden'
		: ''}"
>
	<div class="flex items-center justify-between border-b border-border-light px-4 py-3">
		<span class="text-sm font-medium text-text-primary-light">
			Canvas ({canvasStore.blockCount})
		</span>
		<button
			onclick={onClose}
			class="rounded-md px-3 py-1 text-sm text-text-secondary-light transition-colors hover:text-text-primary-light"
		>
			Close
		</button>
	</div>
	<div class="flex-1 overflow-hidden">
		<Canvas
			onAction={onAction}
			onScrollToMessage={(msgId: string) => {
				onClose();
				setTimeout(() => onScrollToMessage(msgId), 300);
			}}
			{onExecuteAction}
		/>
	</div>
</div>
