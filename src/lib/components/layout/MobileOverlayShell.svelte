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
		hideOnDesktop = true,
		keepMounted = false,
		children
	} = $props<{
		open?: boolean;
		variant?: 'full' | 'sheet' | 'drawer';
		onClose?: () => void;
		label?: string;
		labelledBy?: string;
		hideOnDesktop?: boolean;
		keepMounted?: boolean;
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

{#if open || keepMounted}
	<div class="fixed inset-0 z-[60] {hideOnDesktop ? 'md:hidden' : ''} {open ? '' : 'hidden'}">
		<button
			type="button"
			class="absolute inset-0 bg-ink/55 backdrop-blur-sm"
			onclick={onClose}
			aria-label="Close overlay"
			transition:fade={{ duration: 150 }}
		></button>

		<div
			class="relative flex h-full w-full {variant === 'sheet'
				? 'items-end'
				: variant === 'drawer'
					? 'items-stretch justify-end'
					: 'items-stretch'}"
		>
			<div
				bind:this={dialogElement}
				class="relative flex w-full flex-col overflow-hidden bg-surface-canvas shadow-2xl ring-1 ring-line/70 {variant ===
				'full'
					? 'h-full'
					: variant === 'drawer'
						? 'h-full md:w-[32rem]'
						: 'max-h-[85dvh] rounded-t-[1.75rem]'}"
				role="dialog"
				aria-modal="true"
				aria-label={label}
				aria-labelledby={labelledBy}
				tabindex="-1"
				onkeydown={handleKeydown}
				transition:fly={{
					x: variant === 'drawer' ? 28 : 0,
					y: variant === 'sheet' ? 28 : 0,
					duration: 200
				}}
			>
				<div
					class="min-h-0 flex-1 overflow-y-auto overscroll-contain"
					data-mobile-overlay-scroll-region
				>
					{@render children()}
				</div>
			</div>
		</div>
	</div>
{/if}
