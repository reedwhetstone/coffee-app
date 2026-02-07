<script lang="ts">
	import { canvasStore } from '$lib/stores/canvasStore.svelte';
	import CanvasLayout from './CanvasLayout.svelte';
	import type { BlockAction, CanvasBlock } from '$lib/types/genui';

	let { onAction, onScrollToMessage, onExecuteAction } = $props<{
		onAction?: (action: BlockAction) => void;
		onScrollToMessage?: (messageId: string) => void;
		onExecuteAction?: (actionType: string, fields: Record<string, unknown>) => Promise<void>;
	}>();

	// Minimized blocks shown as title bar at bottom
	let minimizedBlocks = $derived(canvasStore.blocks.filter((b: CanvasBlock) => b.minimized));

	function handleAction(action: BlockAction) {
		if (action.type === 'scroll-to-message' && onScrollToMessage) {
			onScrollToMessage(action.messageId);
			return;
		}
		onAction?.(action);
	}

	function handleRemove(blockId: string) {
		canvasStore.dispatch({ type: 'remove', blockId });
	}

	function handlePin(blockId: string) {
		const block = canvasStore.blocks.find((b: CanvasBlock) => b.id === blockId);
		if (block?.pinned) {
			canvasStore.dispatch({ type: 'unpin', blockId });
		} else {
			canvasStore.dispatch({ type: 'pin', blockId });
		}
	}

	function handleMinimize(blockId: string) {
		canvasStore.dispatch({ type: 'minimize', blockId });
	}

	function handleRestore(blockId: string) {
		canvasStore.dispatch({ type: 'restore', blockId });
	}
</script>

<div class="flex h-full flex-col bg-background-primary-light">
	<!-- Canvas header -->
	<div class="flex items-center justify-between border-b border-border-light px-3 py-2">
		<div class="flex items-center gap-2">
			<span class="text-sm font-medium text-text-primary-light">Canvas</span>
			<span class="rounded-full bg-background-tertiary-light/10 px-2 py-0.5 text-xs text-text-secondary-light">
				{canvasStore.blockCount}
			</span>
		</div>
		<div class="flex items-center gap-1">
			{#if canvasStore.blockCount > 1}
				<!-- Layout toggle buttons -->
				<button
					onclick={() => canvasStore.dispatch({ type: 'layout', layout: 'focus' })}
					class="rounded p-1 text-xs transition-colors {canvasStore.layout === 'focus' ? 'layout-btn-active' : 'text-text-secondary-light'}"
					title="Focus view"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<rect x="3" y="3" width="18" height="18" rx="2" stroke-width="2"/>
					</svg>
				</button>
				<button
					onclick={() => canvasStore.dispatch({ type: 'layout', layout: 'comparison' })}
					class="rounded p-1 text-xs transition-colors {canvasStore.layout === 'comparison' ? 'layout-btn-active' : 'text-text-secondary-light'}"
					title="Comparison view"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<rect x="3" y="3" width="8" height="18" rx="1" stroke-width="2"/>
						<rect x="13" y="3" width="8" height="18" rx="1" stroke-width="2"/>
					</svg>
				</button>
				<button
					onclick={() => canvasStore.dispatch({ type: 'layout', layout: 'dashboard' })}
					class="rounded p-1 text-xs transition-colors {canvasStore.layout === 'dashboard' ? 'layout-btn-active' : 'text-text-secondary-light'}"
					title="Dashboard view"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<rect x="3" y="3" width="7" height="7" rx="1" stroke-width="2"/>
						<rect x="14" y="3" width="7" height="7" rx="1" stroke-width="2"/>
						<rect x="3" y="14" width="7" height="7" rx="1" stroke-width="2"/>
						<rect x="14" y="14" width="7" height="7" rx="1" stroke-width="2"/>
					</svg>
				</button>
			{/if}
			{#if canvasStore.blockCount > 0}
				<button
					onclick={() => canvasStore.clearAll()}
					class="ml-1 rounded p-1 text-text-secondary-light transition-colors hover:text-red-500"
					title="Clear all"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
					</svg>
				</button>
			{/if}
		</div>
	</div>

	<!-- Canvas content -->
	<div class="flex-1 overflow-hidden">
		{#if canvasStore.visibleBlocks.length === 0 && minimizedBlocks.length === 0}
			<!-- Empty state -->
			<div class="flex h-full flex-col items-center justify-center p-6 text-center">
				<svg class="mb-3 h-12 w-12 text-text-secondary-light/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
				</svg>
				<p class="text-sm text-text-secondary-light">
					Blocks will appear here as the AI responds
				</p>
			</div>
		{:else}
			<CanvasLayout
				blocks={canvasStore.visibleBlocks}
				layout={canvasStore.layout}
				focusBlockId={canvasStore.focusBlockId}
				onAction={handleAction}
				{onExecuteAction}
				onRemove={handleRemove}
				onPin={handlePin}
				onMinimize={handleMinimize}
			/>
		{/if}
	</div>

	<!-- Minimized blocks bar -->
	{#if minimizedBlocks.length > 0}
		<div class="flex gap-1 border-t border-border-light px-2 py-1.5">
			{#each minimizedBlocks as mb (mb.id)}
				<button
					onclick={() => handleRestore(mb.id)}
					class="flex items-center gap-1 rounded bg-background-secondary-light px-2 py-1 text-xs text-text-secondary-light ring-1 ring-border-light transition-colors hover:text-text-primary-light"
				>
					<span>{mb.block.type.replace(/-/g, ' ')}</span>
					<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
					</svg>
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	:global(.layout-btn-active) {
		background-color: rgba(99, 102, 241, 0.1);
		color: var(--color-text-primary-light, #111827);
	}
</style>
