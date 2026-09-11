<script lang="ts">
	import { tick } from 'svelte';
	import Canvas from '$lib/components/canvas/Canvas.svelte';
	import type { BlockAction } from '$lib/types/genui';

	let {
		open,
		overlay,
		expanded,
		canExpand,
		onClose,
		onToggleExpand,
		onAction,
		onScrollToMessage,
		onExecuteAction
	} = $props<{
		open: boolean;
		overlay: boolean;
		expanded: boolean;
		canExpand: boolean;
		onClose: () => void;
		onToggleExpand: () => void;
		onAction: (action: BlockAction) => void;
		onScrollToMessage: (messageId: string) => void;
		onExecuteAction: (
			executionId: string,
			actionType: string,
			fields: Record<string, unknown>,
			blockId?: string
		) => Promise<unknown>;
	}>();
	let surface: HTMLDivElement;
	let hasOpened = $state(false);
	$effect(() => {
		if (open) hasOpened = true;
	});

	$effect(() => {
		if (!open) return;
		void overlay;
		void tick().then(() => surface?.focus());
	});
	$effect(() => {
		if (!open || !overlay) return;
		const previous = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = previous;
		};
	});

	function handleKeydown(event: KeyboardEvent) {
		if (!open || event.defaultPrevented) return;
		// Nested coffee/detail dialogs own their own Escape and focus behavior.
		const nested = (event.target as HTMLElement).closest('[role="dialog"]');
		if (nested && nested !== surface) return;
		if (event.key === 'Escape') {
			// A visible nested detail panel remains the topmost owner even when a
			// background control inside this workspace has focus.
			if (surface.querySelector('[data-detail-dialog]')) return;
			event.preventDefault();
			event.stopPropagation();
			onClose();
		} else if (event.key === 'Tab' && overlay) {
			const focusable = Array.from(
				surface.querySelectorAll<HTMLElement>(
					'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]'
				)
			).filter((el) => !el.closest('[hidden], [inert]') && el.getClientRects().length > 0);
			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			if (!first) {
				event.preventDefault();
				surface.focus();
			} else if (
				event.shiftKey &&
				(document.activeElement === first || document.activeElement === surface)
			) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		}
	}

	// No second canvas is mounted for mobile or expanded mode. Local proposal
	// edits and requests survive closing, resizing, and switching presentation.
</script>

<div
	bind:this={surface}
	hidden={!open}
	role={overlay ? 'dialog' : 'region'}
	aria-modal={overlay ? true : undefined}
	aria-label="Evidence workspace"
	tabindex="-1"
	onkeydown={handleKeydown}
	class="evidence-workspace min-h-0 min-w-0 flex-1 flex-col bg-surface-canvas outline-none {overlay
		? 'fixed inset-0 z-[70]'
		: 'relative border-l border-line'}"
>
	{#if hasOpened}
		<Canvas
			{onAction}
			{onScrollToMessage}
			{onExecuteAction}
			{onClose}
			{canExpand}
			{expanded}
			{onToggleExpand}
		/>
	{/if}
</div>

<style>
	.evidence-workspace:not([hidden]) {
		display: flex;
	}
</style>
