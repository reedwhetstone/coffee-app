<script lang="ts">
	import { type CanvasBlock, type CanvasLayout, type BlockAction } from '$lib/types/genui';
	import GenUIBlockRenderer from '$lib/components/genui/GenUIBlockRenderer.svelte';
	import { canvasStore } from '$lib/stores/canvasStore.svelte';
	import { blockSupportsDetail } from '$lib/services/blockDetail';
	import { groupCanvasBlocks, subTabLabel } from '$lib/services/canvasGrouping';

	let { blocks, layout, focusBlockId, onAction, onExecuteAction, onMinimize, onToggleLock, onExpand } =
		$props<{
			blocks: CanvasBlock[];
			layout: CanvasLayout;
			focusBlockId: string | null;
			onAction?: (action: BlockAction) => void;
			onExecuteAction?: (actionType: string, fields: Record<string, unknown>) => Promise<void>;
			onMinimize: (blockId: string) => void;
			onToggleLock: (blockId: string) => void;
			onExpand?: (blockId: string) => void;
		}>();

	// Blocks are grouped by category into windows; each member is a sub-tab.
	let groups = $derived(groupCanvasBlocks(blocks));

	// Which sub-tab is active per group (by group key → block id). The focused
	// block always wins so focusing/AI updates surface the right sub-tab.
	let activeByGroup = $state<Record<string, string>>({});

	function activeBlockFor(group: { key: string; blocks: CanvasBlock[] }): CanvasBlock {
		if (focusBlockId) {
			const focused = group.blocks.find((b) => b.id === focusBlockId);
			if (focused) return focused;
		}
		const wanted = activeByGroup[group.key];
		const chosen = wanted ? group.blocks.find((b) => b.id === wanted) : undefined;
		return chosen ?? group.blocks[group.blocks.length - 1];
	}

	function selectSubTab(groupKey: string, blockId: string) {
		activeByGroup = { ...activeByGroup, [groupKey]: blockId };
		canvasStore.dispatch({ type: 'focus', blockId });
	}

	function minimizeWindow(group: { blocks: CanvasBlock[] }) {
		for (const b of group.blocks) onMinimize(b.id);
	}
</script>

<div class="canvas-layout canvas-layout-{layout}">
	{#each groups as group (group.key)}
		{@const active = activeBlockFor(group)}
		{@const isFocused = group.blocks.some((b) => b.id === focusBlockId)}
		<div
			class="canvas-block-wrapper"
			class:is-focused={isFocused && layout === 'focus'}
			class:is-secondary={!isFocused && layout === 'focus'}
			class:is-pinned={group.pinned}
		>
			<!-- Window header bar -->
			<div class="flex items-center justify-between gap-2 border-b border-border-light px-3 py-1.5">
				<div class="flex min-w-0 items-center gap-2">
					<span class="truncate text-xs font-medium text-text-secondary-light" title={group.label}>
						{group.label}
					</span>
					{#if group.blocks.length > 1}
						<span
							class="rounded-full bg-background-tertiary-light/10 px-1.5 text-[10px] text-text-secondary-light"
						>
							{group.blocks.length}
						</span>
					{/if}
					{#if group.pinned}
						<span class="text-xs text-amber-500">locked</span>
					{/if}
				</div>
				<div class="flex shrink-0 items-center gap-1">
					{#if onExpand && blockSupportsDetail(active.block)}
						<button
							onclick={() => onExpand?.(active.id)}
							class="rounded p-0.5 text-text-secondary-light transition-colors hover:text-text-primary-light"
							title="Open detail panel"
						>
							<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M4 16v2a2 2 0 002 2h2m8 0h2a2 2 0 002-2v-2M16 4h2a2 2 0 012 2v2M8 4H6a2 2 0 00-2 2v2"
								/>
							</svg>
						</button>
					{/if}
					<!-- Lock toggle: locks the whole window so the agent can't replace,
					     remove, reorder, or re-lay-out it — it can only add new content
					     below. Operates on the active sub-tab's block. -->
					<button
						onclick={() => onToggleLock(active.id)}
						class="rounded p-0.5 transition-colors"
						class:text-amber-500={active.pinned}
						class:text-text-secondary-light={!active.pinned}
						class:hover:text-amber-500={!active.pinned}
						title={active.pinned ? 'Unlock window' : 'Lock window in place'}
						aria-pressed={active.pinned}
					>
						<svg
							class="h-3.5 w-3.5"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<rect x="5" y="11" width="14" height="9" rx="2" stroke-width="2" />
							{#if active.pinned}
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 018 0v4" />
							{:else}
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 014-4 4 4 0 013.464 2" />
							{/if}
						</svg>
					</button>
					<!-- Minimize the whole window -->
					<button
						onclick={() => minimizeWindow(group)}
						class="rounded p-0.5 text-text-secondary-light transition-colors hover:text-text-primary-light"
						title="Minimize window"
					>
						<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
						</svg>
					</button>
				</div>
			</div>

			<!-- Sub-tab bar (only when the category has more than one block) -->
			{#if group.blocks.length > 1}
				<div class="flex items-center gap-1 overflow-x-auto border-b border-border-light px-2 py-1">
					{#each group.blocks as member, i (member.id)}
						{@const isActive = member.id === active.id}
						<div
							class="group/subtab flex shrink-0 items-center rounded-md text-xs transition-colors {isActive
								? 'bg-background-tertiary-light/15 text-text-primary-light'
								: 'text-text-secondary-light hover:bg-background-secondary-light'}"
						>
							<button
								onclick={() => selectSubTab(group.key, member.id)}
								class="max-w-[140px] truncate px-2 py-0.5"
								title={subTabLabel(member, i)}
							>
								{#if member.pinned}<span class="mr-0.5 text-amber-500">●</span>{/if}{subTabLabel(
									member,
									i
								)}
							</button>
							<button
								onclick={() => onMinimize(member.id)}
								class="px-1 text-text-secondary-light opacity-0 transition-opacity hover:text-red-500 group-hover/subtab:opacity-100"
								title="Close this tab"
								aria-label="Close {subTabLabel(member, i)}"
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

			<!-- Active block content -->
			<div class="canvas-block-content overflow-auto p-3">
				<GenUIBlockRenderer
					block={active.block}
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

	/* Focus: primary window takes most space, others as small tiles below */
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

	/* Dashboard: denser grid of windows */
	.canvas-layout-dashboard {
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		align-content: start;
	}

	/* Stack: single full-width column (reads well, mobile-friendly) */
	.canvas-layout-stack {
		grid-template-columns: 1fr;
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
