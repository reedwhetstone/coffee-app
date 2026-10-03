<script lang="ts">
	import type { ErrorBlock } from '$lib/types/genui';

	let { block } = $props<{
		block: ErrorBlock;
	}>();

	// A step that did not complete inside a finished answer is a note, not a failure.
	let tone = $derived(
		block.data.severity === 'notice'
			? 'border border-line bg-surface-panel text-muted'
			: 'bg-danger-subtle font-medium text-danger-strong ring-1 ring-inset ring-danger/20'
	);
</script>

<span class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs {tone}">
	<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="2"
			d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
		/>
	</svg>
	<span>{block.data.message}</span>
</span>
