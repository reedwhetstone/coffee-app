<script lang="ts">
	import { canvasStore } from '$lib/stores/canvasStore.svelte';
	import type { CherryAgentName } from '$lib/cherry/identity';

	let {
		agentName,
		variant,
		canvasOpen,
		hasMessages,
		onOpenMemory,
		onToggleCanvas,
		onCloseDrawer,
		onExport,
		onClear,
		clearDisabled = false
	} = $props<{
		agentName: CherryAgentName;
		/** 'page' = full /chat workbench; 'drawer' = slide-in panel */
		variant: 'page' | 'drawer';
		/** Whether the desktop canvas split-pane is currently open */
		canvasOpen: boolean;
		/** Whether any chat messages exist (controls Export/Clear visibility) */
		hasMessages: boolean;
		onOpenMemory: () => void;
		onToggleCanvas: () => void;
		onCloseDrawer?: () => void;
		onExport: () => void;
		onClear: () => void;
		clearDisabled?: boolean;
	}>();
</script>

<!-- Keep the active evidence workspace visible. Less-frequent workspace actions live in a
     labeled menu so the sourcing workflow remains primary. -->

<div
	class="flex shrink-0 items-center justify-between gap-2 border-b border-line bg-surface-panel/40 px-4 py-3"
>
	<div class="min-w-0">
		<p class="truncate text-sm font-semibold text-ink">{agentName}</p>
		<p class="hidden truncate text-xs text-muted sm:block">Coffee-native AI from Purveyors</p>
	</div>
	<div class="flex items-center gap-2">
		{#if !canvasStore.isEmpty}
			<button
				type="button"
				onclick={onToggleCanvas}
				aria-expanded={canvasOpen}
				class="whitespace-nowrap rounded-md border border-line bg-surface-canvas px-3 py-2 text-xs font-medium text-ink transition-colors hover:border-accent focus-visible:ring-2 focus-visible:ring-accent"
			>
				Evidence <span class="ml-1 text-muted">{canvasStore.blockCount}</span>
			</button>
		{/if}
		<details class="relative">
			<summary
				class="cursor-pointer list-none rounded-md border border-line px-2 py-2 text-xs text-muted transition-all hover:text-ink"
			>
				<span class="sr-only sm:not-sr-only">Workspace actions</span><span
					class="sm:hidden"
					aria-hidden="true">•••</span
				>
			</summary>
			<div
				class="absolute right-0 z-20 mt-1 flex min-w-44 flex-col gap-1 rounded-md border border-line bg-surface-panel p-1.5 shadow-lg"
			>
				{#if variant === 'drawer'}
					<a
						href="/chat"
						class="rounded px-2 py-2 text-left text-xs text-ink hover:bg-surface-canvas"
						>Open full workspace</a
					>
				{/if}
				<button
					onclick={onOpenMemory}
					class="rounded px-2 py-1.5 text-left text-xs text-muted hover:bg-surface-canvas hover:text-ink"
					title="View and edit the persistent memory document"
				>
					Conversation memory
				</button>
				{#if hasMessages}
					<button
						onclick={onExport}
						class="rounded px-2 py-1.5 text-left text-xs text-muted hover:bg-surface-canvas hover:text-ink"
					>
						Export conversation
					</button>
					<button
						onclick={onClear}
						disabled={clearDisabled}
						class="rounded px-2 py-1.5 text-left text-xs text-danger hover:bg-danger-subtle disabled:opacity-50"
					>
						Clear conversation
					</button>
				{/if}
			</div>
		</details>
		{#if onCloseDrawer}
			<button
				type="button"
				onclick={onCloseDrawer}
				aria-label={`Close ${agentName}`}
				class="rounded-md px-2 py-2 text-muted hover:text-ink">✕</button
			>
		{/if}
	</div>
</div>
