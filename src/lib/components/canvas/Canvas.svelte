<script lang="ts">
	import { canvasStore } from '$lib/stores/canvasStore.svelte';
	import CanvasLayout from './CanvasLayout.svelte';
	import CanvasBlockDetail from './CanvasBlockDetail.svelte';
	import { type BlockAction, type CanvasBlock } from '$lib/types/genui';
	import { groupCanvasBlocks } from '$lib/services/canvasGrouping';

	let { onAction, onScrollToMessage, onExecuteAction } = $props<{
		onAction?: (action: BlockAction) => void;
		onScrollToMessage?: (messageId: string) => void;
		onExecuteAction?: (
			executionId: string,
			actionType: string,
			fields: Record<string, unknown>,
			blockId?: string
		) => Promise<unknown>;
	}>();

	// Minimized blocks shown as a tray at the bottom, grouped by category so the
	// tray mirrors the windowed canvas (one entry per minimized category).
	let minimizedGroups = $derived(
		groupCanvasBlocks(canvasStore.blocks.filter((b: CanvasBlock) => b.minimized))
	);

	function handleAction(action: BlockAction) {
		if (action.type === 'scroll-to-message' && onScrollToMessage) {
			onScrollToMessage(action.messageId);
			return;
		}
		onAction?.(action);
	}

	function handleToggleLock(blockIds: string[]) {
		const shouldUnlock = blockIds.some((blockId) =>
			canvasStore.blocks.some((b: CanvasBlock) => b.id === blockId && b.pinned)
		);
		for (const blockId of blockIds) {
			canvasStore.dispatch({ type: shouldUnlock ? 'unpin' : 'pin', blockId });
		}
	}

	function handleMinimize(blockId: string) {
		canvasStore.dispatch({ type: 'minimize', blockId });
	}

	function handleRemove(blockId: string) {
		canvasStore.dispatch({ type: 'remove', blockId });
		if (detailBlockId === blockId) detailBlockId = null;
	}

	function restoreGroup(blocks: CanvasBlock[]) {
		for (const b of blocks) canvasStore.dispatch({ type: 'restore', blockId: b.id });
	}

	function removeGroup(blocks: CanvasBlock[]) {
		for (const b of blocks) handleRemove(b.id);
	}

	// ─── Pop-out detail panel ──────────────────────────────────────────────────
	let detailBlockId = $state<string | null>(null);
	let detailBlock = $derived(
		detailBlockId
			? (canvasStore.blocks.find((b: CanvasBlock) => b.id === detailBlockId) ?? null)
			: null
	);

	function handleExpand(blockId: string) {
		detailBlockId = blockId;
	}
</script>

<div class="flex h-full flex-col bg-surface-canvas">
	<!-- Canvas header -->
	<div class="flex items-center justify-between border-b border-line px-3 py-2">
		<div class="flex items-center gap-2">
			<span class="text-sm font-medium text-ink">Canvas</span>
			<span class="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-muted">
				{canvasStore.blockCount}
			</span>
		</div>
		<div class="flex items-center gap-1">
			{#if canvasStore.blockCount > 1}
				<!-- Layout toggle buttons -->
				<button
					onclick={() => canvasStore.dispatch({ type: 'layout', layout: 'focus' })}
					class="rounded p-1 text-xs transition-colors {canvasStore.layout === 'focus'
						? 'layout-btn-active'
						: 'text-muted'}"
					title="Focus view"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<rect x="3" y="3" width="18" height="18" rx="2" stroke-width="2" />
					</svg>
				</button>
				<button
					onclick={() => canvasStore.dispatch({ type: 'layout', layout: 'comparison' })}
					class="rounded p-1 text-xs transition-colors {canvasStore.layout === 'comparison'
						? 'layout-btn-active'
						: 'text-muted'}"
					title="Comparison view"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<rect x="3" y="3" width="8" height="18" rx="1" stroke-width="2" />
						<rect x="13" y="3" width="8" height="18" rx="1" stroke-width="2" />
					</svg>
				</button>
				<button
					onclick={() => canvasStore.dispatch({ type: 'layout', layout: 'dashboard' })}
					class="rounded p-1 text-xs transition-colors {canvasStore.layout === 'dashboard'
						? 'layout-btn-active'
						: 'text-muted'}"
					title="Dashboard view"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<rect x="3" y="3" width="7" height="7" rx="1" stroke-width="2" />
						<rect x="14" y="3" width="7" height="7" rx="1" stroke-width="2" />
						<rect x="3" y="14" width="7" height="7" rx="1" stroke-width="2" />
						<rect x="14" y="14" width="7" height="7" rx="1" stroke-width="2" />
					</svg>
				</button>
				<button
					onclick={() => canvasStore.dispatch({ type: 'layout', layout: 'stack' })}
					class="rounded p-1 text-xs transition-colors {canvasStore.layout === 'stack'
						? 'layout-btn-active'
						: 'text-muted'}"
					title="Stacked view"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<rect x="3" y="4" width="18" height="5" rx="1" stroke-width="2" />
						<rect x="3" y="15" width="18" height="5" rx="1" stroke-width="2" />
					</svg>
				</button>
			{/if}
			{#if canvasStore.blockCount > 0}
				<button
					onclick={() => canvasStore.clearAll()}
					class="ml-1 rounded p-1 text-muted transition-colors hover:text-danger"
					title="Clear all"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
						/>
					</svg>
				</button>
			{/if}
		</div>
	</div>

	<!-- Canvas content -->
	<div class="flex-1 overflow-hidden">
		{#if canvasStore.visibleBlocks.length === 0 && minimizedGroups.length === 0}
			<!-- Empty state -->
			<div class="flex h-full flex-col items-center justify-center p-6 text-center">
				<svg
					class="mb-3 h-12 w-12 text-muted/30"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="1.5"
						d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
					/>
				</svg>
				<p class="text-sm text-muted">Blocks will appear here as the AI responds</p>
			</div>
		{:else}
			<CanvasLayout
				blocks={canvasStore.visibleBlocks}
				layout={canvasStore.layout}
				focusBlockId={canvasStore.focusBlockId}
				onAction={handleAction}
				{onExecuteAction}
				onToggleLock={handleToggleLock}
				onMinimize={handleMinimize}
				onRemove={handleRemove}
				onExpand={handleExpand}
			/>
		{/if}
	</div>

	<!-- Minimized windows tray (grouped by category) -->
	{#if minimizedGroups.length > 0}
		<div class="flex flex-wrap gap-1 border-t border-line px-2 py-1.5">
			{#each minimizedGroups as group (group.key)}
				<div class="flex items-center rounded bg-surface-panel text-xs text-muted ring-1 ring-line">
					<button
						onclick={() => restoreGroup(group.blocks)}
						class="flex items-center gap-1 px-2 py-1 transition-colors hover:text-ink"
						title={`Restore ${group.label}`}
					>
						<span>{group.label}</span>
						{#if group.blocks.length > 1}
							<span class="text-[10px] text-muted/70">{group.blocks.length}</span>
						{/if}
						<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
							/>
						</svg>
					</button>
					<button
						onclick={() => removeGroup(group.blocks)}
						class="border-l border-line px-1.5 py-1 transition-colors hover:text-danger"
						title={`Remove minimized ${group.label} window`}
						aria-label={`Remove minimized ${group.label} window`}
					>
						<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				</div>
			{/each}
		</div>
	{/if}
</div>

<CanvasBlockDetail
	canvasBlock={detailBlock}
	onClose={() => (detailBlockId = null)}
	onAction={handleAction}
	{onExecuteAction}
/>

<style>
	:global(.layout-btn-active) {
		background-color: rgba(99, 102, 241, 0.1);
		color: var(--color-ink, #111827);
	}
</style>
