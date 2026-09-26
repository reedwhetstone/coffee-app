<script lang="ts">
	import type { BlockAction, CoffeeCardsBlock } from '$lib/types/genui';

	let { block, onAction, canvasBlockId } = $props<{
		block: CoffeeCardsBlock;
		onAction?: (action: BlockAction) => void;
		canvasBlockId?: string;
	}>();

	let count = $derived(block.data.length);
	let label = $derived(`${count} ${count === 1 ? 'coffee' : 'coffees'}`);
</script>

<section aria-label="Coffee results" class="not-prose my-3 max-w-2xl">
	{#if canvasBlockId && onAction}
		<button
			type="button"
			onclick={() => onAction?.({ type: 'focus-canvas-block', blockId: canvasBlockId })}
			class="flex min-h-11 w-full items-center gap-3 rounded-lg border border-line bg-surface-panel px-3 py-2 text-left text-sm text-ink transition-colors hover:border-accent hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
			aria-label={`View ${label} on canvas`}
		>
			<span
				class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent-subtle text-accent"
				aria-hidden="true">▦</span
			>
			<span class="min-w-0 flex-1">
				<span class="block font-medium">{label}</span>
				<span class="block text-xs text-muted">View the cards on canvas</span>
			</span>
			<span class="text-muted" aria-hidden="true">↗</span>
		</button>
	{:else}
		<p class="rounded-lg border border-line bg-surface-panel px-3 py-2 text-sm text-muted">
			{label} · No longer on canvas
		</p>
	{/if}
</section>
