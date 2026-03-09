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
</script>

{#if visible}
	<div
		class="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-75 p-4"
		role="dialog"
		aria-modal="true"
	>
		<div class="w-full {maxWidth} rounded-lg bg-background-secondary-light p-4 shadow-lg md:p-6">
			{@render children()}
		</div>
	</div>
{/if}
