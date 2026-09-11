<script lang="ts">
	import ChatDisclosure from './ChatDisclosure.svelte';
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

<div
	class={variant === 'drawer'
		? 'relative flex min-h-14 shrink-0 items-center justify-between gap-2 border-b border-line bg-surface-panel/40 px-3'
		: 'flex shrink-0 items-center gap-1'}
>
	{#if variant === 'drawer'}
		<p class="min-w-0 truncate text-sm font-semibold text-ink">{agentName}</p>
	{/if}
	<div class="flex shrink-0 items-center gap-1">
		{#if !canvasStore.isEmpty}
			<button
				type="button"
				onclick={onToggleCanvas}
				aria-expanded={canvasOpen}
				class="min-h-11 whitespace-nowrap rounded-md px-2 text-xs font-medium text-ink hover:bg-surface-panel focus-visible:ring-2 focus-visible:ring-accent"
			>
				Evidence <span class="ml-1 text-muted">{canvasStore.blockCount}</span>
			</button>
		{/if}
		<ChatDisclosure
			label="Workspace actions"
			align="right"
			anchorToTrigger={variant === 'page'}
			upward={variant === 'page'}
			closeOnSelect
		>
			{#snippet trigger()}<span aria-hidden="true">•••</span>{/snippet}
			<div class="flex flex-col gap-1">
				{#if variant === 'drawer'}
					<a
						href="/chat"
						class="flex min-h-11 items-center rounded px-2 text-left text-xs text-ink hover:bg-surface-canvas"
						>Open full workspace</a
					>
				{/if}
				<button
					type="button"
					onclick={onOpenMemory}
					class="min-h-11 rounded px-2 text-left text-xs text-ink hover:bg-surface-canvas"
					>Conversation memory</button
				>
				{#if hasMessages}
					<button
						type="button"
						onclick={onExport}
						class="min-h-11 rounded px-2 text-left text-xs text-ink hover:bg-surface-canvas"
						>Export conversation</button
					>
					<button
						type="button"
						onclick={onClear}
						disabled={clearDisabled}
						class="min-h-11 rounded px-2 text-left text-xs text-danger hover:bg-danger-subtle disabled:opacity-50"
						>Clear conversation</button
					>
				{/if}
			</div>
		</ChatDisclosure>
		{#if onCloseDrawer}
			<button
				type="button"
				onclick={onCloseDrawer}
				aria-label={`Close ${agentName}`}
				class="min-h-11 min-w-11 rounded-md text-muted hover:text-ink">✕</button
			>
		{/if}
	</div>
</div>
