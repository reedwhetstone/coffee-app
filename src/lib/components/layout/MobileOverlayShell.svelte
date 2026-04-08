<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import type { Snippet } from 'svelte';

	let {
		open = false,
		variant = 'sheet',
		onClose = () => {},
		children
	} = $props<{
		open?: boolean;
		variant?: 'full' | 'sheet';
		onClose?: () => void;
		children: Snippet;
	}>();

	$effect(() => {
		if (!open || typeof document === 'undefined') return;

		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';

		return () => {
			document.body.style.overflow = previousOverflow;
		};
	});

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && open) {
			onClose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<div class="fixed inset-0 z-[45] md:hidden" aria-modal="true" role="dialog">
		<button
			type="button"
			class="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
			onclick={onClose}
			aria-label="Close overlay"
			transition:fade={{ duration: 150 }}
		></button>

		<div class="relative flex h-full w-full {variant === 'sheet' ? 'items-end' : 'items-stretch'}">
			<div
				class="relative w-full overflow-hidden bg-background-primary-light shadow-2xl ring-1 ring-border-light/70 {variant ===
				'full'
					? 'h-full'
					: 'max-h-[85vh] rounded-t-[1.75rem]'}"
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
