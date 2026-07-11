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
		onClear
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
	}>();
</script>

<!-- Chat toolbar: Memory, canvas toggles, Export, Clear -->
<div class="flex items-center justify-end border-b border-line px-3 py-1.5">
	<div class="flex items-center gap-2">
		<button
			onclick={onOpenMemory}
			class="rounded-md border border-line px-2 py-0.5 text-xs text-muted transition-all hover:text-ink"
			title="View and edit the persistent memory document"
		>
			Memory
		</button>
		{#if !canvasStore.isEmpty}
			<button
				onclick={onToggleMobileCanvas}
				class="rounded-md border border-line px-2 py-0.5 text-xs text-muted transition-all hover:text-ink {variant ===
				'page'
					? 'md:hidden'
					: ''}"
			>
				Canvas ({canvasStore.blockCount})
			</button>
			{#if variant === 'page'}
				<button
					onclick={onToggleDesktopCanvas}
					class="hidden rounded-md border border-line px-2 py-0.5 text-xs text-muted transition-all hover:text-ink md:block"
				>
					{canvasOpen ? 'Hide' : 'Show'} Canvas ({canvasStore.blockCount})
				</button>
			{/if}
		{/if}
		{#if hasMessages}
			<button
				onclick={onExport}
				class="rounded-md border border-accent px-2 py-0.5 text-xs text-accent transition-all hover:bg-accent hover:text-white"
			>
				Export
			</button>
			<button
				onclick={onClear}
				class="rounded-md border border-danger px-2 py-0.5 text-xs text-danger transition-all hover:bg-danger-strong hover:text-white"
			>
				Clear
			</button>
		{/if}
	</div>
</div>
