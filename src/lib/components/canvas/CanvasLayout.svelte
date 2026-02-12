<script lang="ts">
	import type { CanvasBlock, CanvasLayout, BlockAction } from '$lib/types/genui';
	import GenUIBlockRenderer from '$lib/components/genui/GenUIBlockRenderer.svelte';
	import { canvasStore } from '$lib/stores/canvasStore.svelte';

	let { blocks, layout, focusBlockId, onAction, onExecuteAction, onRemove, onPin, onMinimize } =
		$props<{
			blocks: CanvasBlock[];
			layout: CanvasLayout;
			focusBlockId: string | null;
			onAction?: (action: BlockAction) => void;
			onExecuteAction?: (actionType: string, fields: Record<string, unknown>) => Promise<void>;
			onRemove: (blockId: string) => void;
			onPin: (blockId: string) => void;
			onMinimize: (blockId: string) => void;
		}>();
</script>

<div class="canvas-layout canvas-layout-{layout}">
	{#each blocks as canvasBlock (canvasBlock.id)}
		{@const isFocused = canvasBlock.id === focusBlockId}
		<div
			class="canvas-block-wrapper"
			class:is-focused={isFocused && layout === 'focus'}
			class:is-secondary={!isFocused && layout === 'focus'}
			class:is-pinned={canvasBlock.pinned}
		>
			<!-- Block header bar -->
			<div class="flex items-center justify-between border-b border-border-light px-3 py-1.5">
				<div class="flex items-center gap-2">
					<span class="text-xs font-medium text-text-secondary-light">
						{canvasBlock.block.type.replace(/-/g, ' ')}
					</span>
					{#if canvasBlock.pinned}
						<span class="text-xs text-amber-500">pinned</span>
					{/if}
				</div>
				<div class="flex items-center gap-1">
					<!-- Focus button (when not in focus layout or not focused) -->
					{#if layout !== 'focus' || !isFocused}
						<button
							onclick={() => canvasStore.dispatch({ type: 'focus', blockId: canvasBlock.id })}
							class="rounded p-0.5 text-text-secondary-light transition-colors hover:text-text-primary-light"
							title="Focus"
						>
							<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
								/>
							</svg>
						</button>
					{/if}
					<!-- Pin toggle -->
					<button
						onclick={() => onPin(canvasBlock.id)}
						class="rounded p-0.5 transition-colors"
						class:text-amber-500={canvasBlock.pinned}
						class:text-text-secondary-light={!canvasBlock.pinned}
						class:hover:text-amber-500={!canvasBlock.pinned}
						title={canvasBlock.pinned ? 'Unpin' : 'Pin'}
					>
						<svg
							class="h-3.5 w-3.5"
							fill={canvasBlock.pinned ? 'currentColor' : 'none'}
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
							/>
						</svg>
					</button>
					<!-- Minimize -->
					<button
						onclick={() => onMinimize(canvasBlock.id)}
						class="rounded p-0.5 text-text-secondary-light transition-colors hover:text-text-primary-light"
						title="Minimize"
					>
						<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
						</svg>
					</button>
					<!-- Close button -->
					<button
						onclick={() => onRemove(canvasBlock.id)}
						class="rounded p-0.5 text-text-secondary-light transition-colors hover:text-red-500"
						title="Remove"
					>
						<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				</div>
			</div>

			<!-- Block content -->
			<div class="canvas-block-content overflow-auto p-3">
				<GenUIBlockRenderer
					block={canvasBlock.block}
					renderMode="canvas"
					{onAction}
					{onExecuteAction}
				/>
			</div>
		</div>
	{/each}
</div>

<style>
	.canvas-layout {
		display: grid;
		gap: 0.75rem;
		height: 100%;
		overflow-y: auto;
		padding: 0.75rem;
		transition:
			grid-template-columns 0.3s ease,
			grid-template-rows 0.3s ease;
	}

	/* Focus: primary block takes most space, others as small tiles below */
	.canvas-layout-focus {
		grid-template-columns: 1fr;
		grid-template-rows: auto;
	}
	.canvas-layout-focus .is-focused {
		order: -1;
	}
	.canvas-layout-focus .is-secondary {
		max-height: 200px;
	}

	/* Comparison: equal side-by-side */
	.canvas-layout-comparison {
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		align-content: start;
	}

	/* Dashboard: grid of items */
	.canvas-layout-dashboard {
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		align-content: start;
	}

	.canvas-block-wrapper {
		border-radius: 0.5rem;
		border: 1px solid var(--color-border-light, #e5e7eb);
		background: var(--color-background-secondary-light, #f9fafb);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		animation: canvasBlockIn 0.3s ease-out;
	}

	.canvas-block-wrapper.is-focused {
		border-color: var(--color-background-tertiary-light, #6366f1);
		box-shadow: 0 0 0 1px var(--color-background-tertiary-light, #6366f1);
	}

	.canvas-block-wrapper.is-pinned {
		border-color: #f59e0b;
	}

	.canvas-block-content {
		flex: 1;
		min-height: 0;
	}

	@keyframes canvasBlockIn {
		from {
			opacity: 0;
			transform: scale(0.97);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}
</style>
