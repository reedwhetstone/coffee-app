<script lang="ts">
	import { canvasStore } from '$lib/stores/canvasStore.svelte';
	import CanvasLayout from './CanvasLayout.svelte';
	import CanvasBlockDetail from './CanvasBlockDetail.svelte';
	import { defaultBlockTitle, type BlockAction, type CanvasBlock } from '$lib/types/genui';
	import { blockSupportsDetail } from '$lib/services/blockDetail';

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

	let active = $derived(canvasStore.focusedBlock ?? canvasStore.visibleBlocks[0] ?? null);

	function blockLabel(block: CanvasBlock): string {
		return block.title?.trim() || defaultBlockTitle(block.block.type);
	}

	function handleAction(action: BlockAction) {
		if (action.type === 'scroll-to-message' && onScrollToMessage) {
			onScrollToMessage(action.messageId);
			return;
		}
		onAction?.(action);
	}

	function focusBlock(blockId: string) {
		canvasStore.dispatch({ type: 'focus', blockId });
	}

	function togglePin(block: CanvasBlock) {
		canvasStore.dispatch({ type: block.pinned ? 'unpin' : 'pin', blockId: block.id });
	}

	function removeBlock(blockId: string) {
		canvasStore.dispatch({ type: 'remove', blockId });
		if (detailBlockId === blockId) detailBlockId = null;
	}

	let detailBlockId = $state<string | null>(null);
	let detailBlock = $derived(
		detailBlockId
			? (canvasStore.blocks.find((block: CanvasBlock) => block.id === detailBlockId) ?? null)
			: null
	);
</script>

<div class="flex h-full min-h-0 flex-col bg-surface-canvas">
	{#if active}
		<header class="flex shrink-0 items-center justify-between gap-3 border-b border-line px-3 py-2">
			<div class="min-w-0">
				<div class="flex items-center gap-2">
					<h2 class="truncate text-sm font-medium text-ink" title={blockLabel(active)}>
						{blockLabel(active)}
					</h2>
					{#if active.pinned}
						<span
							class="rounded-full bg-accent-subtle px-1.5 py-0.5 text-[10px] font-medium text-ink"
						>
							Pinned
						</span>
					{/if}
				</div>
				{#if active.title?.trim()}
					<p class="truncate text-xs text-muted">{defaultBlockTitle(active.block.type)}</p>
				{/if}
			</div>

			<div class="flex shrink-0 items-center gap-0.5" aria-label="Active evidence controls">
				{#if active.messageId && onScrollToMessage}
					<button
						type="button"
						onclick={() => onScrollToMessage?.(active.messageId)}
						class="rounded-md p-1.5 text-muted transition-colors hover:bg-surface-panel hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
						title="Go to source message"
						aria-label="Go to source message"
					>
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="1.5"
								d="M8 10h8M8 14h5m-7 5-3 2v-5a8 8 0 1 1 3 3Z"
							/>
						</svg>
					</button>
				{/if}
				{#if blockSupportsDetail(active.block)}
					<button
						type="button"
						onclick={() => (detailBlockId = active?.id ?? null)}
						class="rounded-md p-1.5 text-muted transition-colors hover:bg-surface-panel hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
						title="Open details"
						aria-label="Open active evidence details"
					>
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="1.5"
								d="M4 16v2a2 2 0 0 0 2 2h2m8 0h2a2 2 0 0 0 2-2v-2M16 4h2a2 2 0 0 1 2 2v2M8 4H6a2 2 0 0 0-2 2v2"
							/>
						</svg>
					</button>
				{/if}
				<button
					type="button"
					onclick={() => togglePin(active)}
					class="rounded-md p-1.5 transition-colors hover:bg-surface-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent {active.pinned
						? 'text-accent'
						: 'text-muted hover:text-ink'}"
					title={active.pinned ? 'Unpin evidence' : 'Pin evidence'}
					aria-label={active.pinned ? 'Unpin active evidence' : 'Pin active evidence'}
					aria-pressed={active.pinned}
				>
					<svg
						class="h-4 w-4"
						fill={active.pinned ? 'currentColor' : 'none'}
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="1.5"
							d="m14 4 6 6-3 1-4 4-1 5-2-2-4 4 2-6-2-2 5-1 4-4-1-3Z"
						/>
					</svg>
				</button>
				<button
					type="button"
					onclick={() => removeBlock(active.id)}
					class="rounded-md p-1.5 text-muted transition-colors hover:bg-danger-subtle hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
					title="Remove evidence"
					aria-label="Remove active evidence"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="1.5"
							d="M6 18 18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>
		</header>

		<main class="min-h-0 flex-1">
			<CanvasLayout
				blocks={canvasStore.visibleBlocks}
				focusBlockId={active.id}
				onAction={handleAction}
				{onExecuteAction}
			/>
		</main>

		<nav
			class="shrink-0 border-t border-line bg-surface-panel/70 px-2 py-2"
			aria-label="Evidence shelf"
		>
			<div class="mb-1 flex items-center justify-between px-1">
				<span class="text-xs font-semibold text-muted">Evidence shelf</span>
				<button
					type="button"
					onclick={() => canvasStore.clearAll()}
					class="rounded-md px-1.5 py-0.5 text-[11px] text-muted transition-colors hover:bg-surface-raised hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
					title="Remove all unpinned evidence"
				>
					Clear unpinned
				</button>
			</div>
			<div class="flex gap-1.5 overflow-x-auto pb-0.5">
				{#each canvasStore.visibleBlocks as shelfBlock (shelfBlock.id)}
					<button
						type="button"
						onclick={() => focusBlock(shelfBlock.id)}
						aria-current={shelfBlock.id === active.id ? 'true' : undefined}
						aria-label={`${blockLabel(shelfBlock)}${shelfBlock.pinned ? ', pinned' : ''}`}
						class="group flex min-w-[8.5rem] max-w-[11rem] shrink-0 items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent {shelfBlock.id ===
						active.id
							? 'border-accent bg-surface-raised text-ink'
							: shelfBlock.pinned
								? 'border-accent/40 bg-accent-subtle/40 text-ink hover:border-accent/70'
								: 'border-line bg-surface-canvas text-muted hover:border-accent/40 hover:text-ink'}"
					>
						<span class="min-w-0 flex-1">
							<span class="block truncate text-xs font-medium">{blockLabel(shelfBlock)}</span>
							<span class="block truncate text-[10px] text-muted"
								>{defaultBlockTitle(shelfBlock.block.type)}</span
							>
						</span>
						{#if shelfBlock.pinned}
							<span class="text-accent" aria-hidden="true">●</span>
						{/if}
					</button>
				{/each}
			</div>
		</nav>
	{:else}
		<div class="flex h-full flex-col items-center justify-center p-6 text-center">
			<svg
				class="mb-3 h-10 w-10 text-muted/30"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="1.5"
					d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5A3.375 3.375 0 0 0 10.125 2.25H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625A1.125 1.125 0 0 0 4.5 3.375v17.25c0 .621.504 1.125 1.125 1.125h12.75a1.125 1.125 0 0 0 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
				/>
			</svg>
			<p class="text-sm font-medium text-ink">Your evidence workspace is ready</p>
			<p class="mt-1 max-w-xs text-sm text-muted">
				Open a result from the conversation to explore it here.
			</p>
		</div>
	{/if}
</div>

<CanvasBlockDetail
	canvasBlock={detailBlock}
	onClose={() => (detailBlockId = null)}
	onAction={handleAction}
	{onExecuteAction}
/>
