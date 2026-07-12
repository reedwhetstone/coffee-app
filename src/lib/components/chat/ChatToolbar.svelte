<script lang="ts">
	import { canvasStore } from '$lib/stores/canvasStore.svelte';

	let {
		variant,
		canvasOpen,
		hasMessages,
		onOpenMemory,
		onToggleMobileCanvas,
		onToggleDesktopCanvas,
		onExport,
		onClear,
		clearDisabled = false
	} = $props<{
		/** 'page' = full /chat workbench; 'drawer' = slide-in panel */
		variant: 'page' | 'drawer';
		/** Whether the desktop canvas split-pane is currently open */
		canvasOpen: boolean;
		/** Whether any chat messages exist (controls Export/Clear visibility) */
		hasMessages: boolean;
		onOpenMemory: () => void;
		onToggleMobileCanvas: () => void;
		onToggleDesktopCanvas: () => void;
		onExport: () => void;
		onClear: () => void;
		clearDisabled?: boolean;
	}>();
</script>

<!-- Keep the active evidence workspace visible. Less-frequent workspace actions live in a
     labeled menu so the sourcing workflow remains primary. -->
<div class="flex items-center justify-end border-b border-line px-3 py-1.5">
	<div class="flex items-center gap-2">
		{#if !canvasStore.isEmpty}
			<button
				onclick={onToggleMobileCanvas}
				class="rounded-md border border-line px-2 py-0.5 text-xs text-muted transition-all hover:text-ink {variant ===
				'page'
					? 'md:hidden'
					: ''}"
			>
				Evidence ({canvasStore.blockCount})
			</button>
			{#if variant === 'page'}
				<button
					onclick={onToggleDesktopCanvas}
					class="hidden rounded-md border border-line px-2 py-0.5 text-xs text-muted transition-all hover:text-ink md:block"
				>
					{canvasOpen ? 'Hide' : 'Show'} evidence ({canvasStore.blockCount})
				</button>
			{/if}
		{/if}
		<details class="relative">
			<summary
				class="cursor-pointer list-none rounded-md border border-line px-2 py-0.5 text-xs text-muted transition-all hover:text-ink"
			>
				Workspace actions
			</summary>
			<div
				class="absolute right-0 z-20 mt-1 flex min-w-44 flex-col gap-1 rounded-md border border-line bg-surface-panel p-1.5 shadow-lg"
			>
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
						Export research
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
	</div>
</div>
