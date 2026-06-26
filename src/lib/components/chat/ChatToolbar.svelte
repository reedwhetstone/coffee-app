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
<div class="flex items-center justify-end border-b border-border-light px-3 py-1.5">
	<div class="flex items-center gap-2">
		<button
			onclick={onOpenMemory}
			class="rounded-md border border-border-light px-2 py-0.5 text-xs text-text-secondary-light transition-all hover:text-text-primary-light"
			title="View and edit the persistent memory document"
		>
			Memory
		</button>
		{#if !canvasStore.isEmpty}
			<button
				onclick={onToggleMobileCanvas}
				class="rounded-md border border-border-light px-2 py-0.5 text-xs text-text-secondary-light transition-all hover:text-text-primary-light {variant ===
				'page'
					? 'md:hidden'
					: ''}"
			>
				Canvas ({canvasStore.blockCount})
			</button>
			{#if variant === 'page'}
				<button
					onclick={onToggleDesktopCanvas}
					class="hidden rounded-md border border-border-light px-2 py-0.5 text-xs text-text-secondary-light transition-all hover:text-text-primary-light md:block"
				>
					{canvasOpen ? 'Hide' : 'Show'} Canvas ({canvasStore.blockCount})
				</button>
			{/if}
		{/if}
		{#if hasMessages}
			<button
				onclick={onExport}
				class="rounded-md border border-background-tertiary-light px-2 py-0.5 text-xs text-background-tertiary-light transition-all hover:bg-background-tertiary-light hover:text-white"
			>
				Export
			</button>
			<button
				onclick={onClear}
				class="rounded-md border border-red-500 px-2 py-0.5 text-xs text-red-500 transition-all hover:bg-red-500 hover:text-white"
			>
				Clear
			</button>
		{/if}
	</div>
</div>
