<script lang="ts">
	import { type CanvasBlock, type CanvasLayout, type BlockAction } from '$lib/types/genui';
	import GenUIBlockRenderer from '$lib/components/genui/GenUIBlockRenderer.svelte';
	import { canvasStore } from '$lib/stores/canvasStore.svelte';
	import { blockSupportsDetail } from '$lib/services/blockDetail';
	import { groupCanvasBlocks, subTabLabel, type CanvasGroup } from '$lib/services/canvasGrouping';

	let {
		blocks,
		layout,
		focusBlockId,
		onAction,
		onExecuteAction,
		onMinimize,
		onRemove,
		onToggleLock,
		onExpand
	} = $props<{
		blocks: CanvasBlock[];
		layout: CanvasLayout;
		focusBlockId: string | null;
		onAction?: (action: BlockAction) => void;
		onExecuteAction?: (
			executionId: string,
			actionType: string,
			fields: Record<string, unknown>,
			blockId?: string
		) => Promise<unknown>;
		onMinimize: (blockId: string) => void;
		onRemove: (blockId: string) => void;
		onToggleLock: (blockIds: string[]) => void;
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

	function minimizeWindow(group: CanvasGroup) {
		for (const b of group.blocks) onMinimize(b.id);
	}

	function toggleActiveTabLock(block: CanvasBlock) {
		onToggleLock([block.id]);
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
			class:is-pinned={active.pinned}
		>
			<!-- Window header bar -->
			<div class="flex items-center justify-between gap-2 border-b border-line px-3 py-1.5">
				<div class="flex min-w-0 items-center gap-2">
					<span class="truncate text-xs font-medium text-muted" title={group.label}>
						{group.label}
					</span>
					{#if group.blocks.length > 1}
						<span class="rounded-full bg-accent/10 px-1.5 text-[10px] text-muted">
							{group.blocks.length}
						</span>
					{/if}
					{#if active.pinned}
						<span class="text-xs text-warning">tab locked</span>
					{:else if group.pinnedCount > 0}
						<span class="text-xs text-warning">{group.pinnedCount} locked</span>
					{/if}
				</div>
				<div class="flex shrink-0 items-center gap-1">
					{#if layout === 'focus' && group.blocks.length === 1 && !isFocused}
						<button
							onclick={() => selectSubTab(group.key, active.id)}
							class="rounded p-0.5 text-muted transition-colors hover:text-ink"
							title="Focus window"
						>
							<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<circle cx="12" cy="12" r="3" stroke-width="1.5" />
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="1.5"
									d="M12 2v3m0 14v3m10-10h-3M5 12H2m17.071-7.071-2.121 2.121M7.05 16.95l-2.121 2.121m14.142 0-2.121-2.121M7.05 7.05 4.929 4.929"
								/>
							</svg>
						</button>
					{/if}
					{#if onExpand && blockSupportsDetail(active.block)}
						<button
							onclick={() => onExpand?.(active.id)}
							class="rounded p-0.5 text-muted transition-colors hover:text-ink"
							title="Open detail panel"
						>
							<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="1.5"
									d="M4 16v2a2 2 0 002 2h2m8 0h2a2 2 0 002-2v-2M16 4h2a2 2 0 012 2v2M8 4H6a2 2 0 00-2 2v2"
								/>
							</svg>
						</button>
					{/if}
					<!-- Lock toggle: pins only the active tab so mixed groups keep accurate
					     per-tab locked/unlocked state. -->
					<button
						onclick={() => toggleActiveTabLock(active)}
						class="rounded p-0.5 transition-colors"
						class:text-warning={active.pinned}
						class:text-muted={!active.pinned}
						class:hover:text-warning={!active.pinned}
						title={active.pinned ? 'Unlock active tab' : 'Lock active tab in place'}
						aria-pressed={active.pinned}
					>
						<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<rect x="5" y="11" width="14" height="9" rx="2" stroke-width="1.5" />
							{#if active.pinned}
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="1.5"
									d="M8 11V7a4 4 0 018 0v4"
								/>
							{:else}
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="1.5"
									d="M8 11V7a4 4 0 014-4 4 4 0 013.464 2"
								/>
							{/if}
						</svg>
					</button>
					<!-- Remove only the active tab. This is intentionally distinct from
					     minimizing, which keeps the tab in the restore tray. -->
					<button
						onclick={() => onRemove(active.id)}
						class="rounded p-0.5 text-muted transition-colors hover:text-danger"
						title="Remove active tab"
						aria-label={`Remove active ${group.label} tab`}
					>
						<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="1.5"
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
					<!-- Minimize the whole window -->
					<button
						onclick={() => minimizeWindow(group)}
						class="rounded p-0.5 text-muted transition-colors hover:text-ink"
						title="Minimize window"
					>
						<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="1.5"
								d="M20 12H4"
							/>
						</svg>
					</button>
				</div>
			</div>

			<!-- Sub-tab bar (only when the category has more than one block) -->
			{#if group.blocks.length > 1}
				<div class="flex items-center gap-1 overflow-x-auto border-b border-line px-2 py-1">
					{#each group.blocks as member, i (member.id)}
						{@const isActive = member.id === active.id}
						<div
							class="group/subtab flex shrink-0 items-center rounded-md text-xs transition-colors {isActive
								? 'bg-accent/15 text-ink'
								: 'text-muted hover:bg-surface-panel'}"
						>
							<button
								onclick={() => selectSubTab(group.key, member.id)}
								class="max-w-[140px] truncate px-2 py-0.5"
								title={`${subTabLabel(member, i)} (${member.pinned ? 'locked' : 'unlocked'})`}
								aria-label={`${subTabLabel(member, i)} tab, ${member.pinned ? 'locked' : 'unlocked'}`}
							>
								{#if member.pinned}<span class="mr-0.5 text-warning" title="Locked tab">●</span
									>{/if}{subTabLabel(member, i)}
							</button>
							<button
								onclick={() => onRemove(member.id)}
								class="px-1 text-muted opacity-0 transition-opacity hover:text-danger group-hover/subtab:opacity-100"
								title="Close this tab"
								aria-label="Close {subTabLabel(member, i)}"
							>
								<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="1.5"
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
					canvasBlockId={active.id}
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
		border: 1px solid var(--color-line, #e5e7eb);
		background: var(--color-surface-panel, #f9fafb);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		animation: canvasBlockIn 0.3s ease-out;
	}

	.canvas-block-wrapper.is-focused {
		border-color: var(--color-accent, #6366f1);
		box-shadow: 0 0 0 1px var(--color-accent, #6366f1);
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
