<script lang="ts">
	import { tick } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import type { Snippet } from 'svelte';

	let {
		open = false,
		variant = 'sheet',
		onClose = () => {},
		label,
		labelledBy,
		children
	} = $props<{
		open?: boolean;
		variant?: 'full' | 'sheet';
		onClose?: () => void;
		label?: string;
		labelledBy?: string;
		children: Snippet;
	}>();

	let dialogElement = $state<HTMLDivElement | null>(null);
	let previouslyFocusedElement = $state<HTMLElement | null>(null);

	function getFocusableElements(): HTMLElement[] {
		if (!dialogElement) return [];

		return Array.from(
			dialogElement.querySelectorAll<HTMLElement>(
				'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
			)
		).filter((element) => !element.hasAttribute('disabled') && element.tabIndex !== -1);
	}

	async function focusDialog() {
		await tick();
		const [firstFocusable] = getFocusableElements();
		(firstFocusable ?? dialogElement)?.focus();
	}

	$effect(() => {
		if (!open || typeof document === 'undefined') return;

		previouslyFocusedElement =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		void focusDialog();

		return () => {
			document.body.style.overflow = previousOverflow;
			if (previouslyFocusedElement?.isConnected) {
				previouslyFocusedElement.focus();
			}
		};
	});

	function handleKeydown(event: KeyboardEvent) {
		if (!open) return;

		if (event.key === 'Escape') {
			event.preventDefault();
			onClose();
			return;
		}

		if (event.key !== 'Tab') return;

		const focusableElements = getFocusableElements();
		if (focusableElements.length === 0) {
			event.preventDefault();
			dialogElement?.focus();
			return;
		}

		const firstFocusable = focusableElements[0];
		const lastFocusable = focusableElements[focusableElements.length - 1];
		const activeElement = document.activeElement;

		if (event.shiftKey) {
			if (activeElement === firstFocusable || activeElement === dialogElement) {
				event.preventDefault();
				lastFocusable.focus();
			}
			return;
		}

		if (activeElement === lastFocusable) {
			event.preventDefault();
			firstFocusable.focus();
		}
	}
</script>

{#if open}
	<div class="fixed inset-0 z-[45] md:hidden">
		<button
			type="button"
			class="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
			onclick={onClose}
			aria-label="Close overlay"
			transition:fade={{ duration: 150 }}
		></button>

		<div class="relative flex h-full w-full {variant === 'sheet' ? 'items-end' : 'items-stretch'}">
			<div
				bind:this={dialogElement}
				class="relative w-full overflow-hidden bg-background-primary-light shadow-2xl ring-1 ring-border-light/70 {variant ===
				'full'
					? 'h-full'
					: 'max-h-[85vh] rounded-t-[1.75rem]'}"
				role="dialog"
				aria-modal="true"
				aria-label={label}
				aria-labelledby={labelledBy}
				tabindex="-1"
				onkeydown={handleKeydown}
				transition:fly={{
					y: variant === 'full' ? 0 : 28,
					duration: 200
				}}
			>
				{@render children()}
			</div>
		</div>
	</div>
{/if}
