<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		visible = false,
		maxWidth = 'max-w-2xl',
		children
	}: {
		visible?: boolean;
		maxWidth?: string;
		children: Snippet;
	} = $props();

	// Lock body scroll when modal is visible
	$effect(() => {
		if (visible) {
			const prev = document.body.style.overflow;
			document.body.style.overflow = 'hidden';
			return () => {
				document.body.style.overflow = prev;
			};
		}
	});
</script>

{#if visible}
	<div
		class="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-75 p-2 sm:p-4"
		role="dialog"
		aria-modal="true"
	>
		<div
			class="flex max-h-full w-full {maxWidth} flex-col rounded-lg bg-background-secondary-light shadow-lg"
		>
			<div class="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
				{@render children()}
			</div>
		</div>
	</div>
{/if}
