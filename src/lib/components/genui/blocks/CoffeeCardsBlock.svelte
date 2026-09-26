<script lang="ts">
	import type { CoffeeCatalog } from '$lib/types/component.types';
	import type { CoffeeCardsBlock } from '$lib/types/genui';
	import CoffeeCard from '$lib/components/CoffeeCard.svelte';
	import { parseTastingNotes } from '$lib/utils/parseTastingNotes';

	let { block } = $props<{ block: CoffeeCardsBlock }>();

	let selectedId = $state<number | null>(null);
	let initialBlock = $state('');
	$effect(() => {
		const key = `${block.focusId ?? ''}:${block.data.map((coffee: CoffeeCatalog) => coffee.id).join(',')}`;
		if (key !== initialBlock) {
			initialBlock = key;
			selectedId = block.focusId ?? null;
		}
	});
</script>

{#if block.data.length === 0}
	<div class="rounded-lg border border-line bg-surface-panel p-4 text-sm text-muted">
		No coffee results to review.
	</div>
{:else}
	<div class="@container" role="region" aria-label="Coffee results">
		{#if block.data.length > 1}
			<p class="mb-3 text-xs text-muted">Compare {block.data.length} coffees</p>
		{/if}
		<div class="grid grid-cols-1 gap-3 @2xl:grid-cols-2 @4xl:grid-cols-3">
			{#each block.data as coffee (coffee.id)}
				{@const meta = block.annotations?.find(
					(item: { id: number; highlight?: boolean; annotation?: string }) => item.id === coffee.id
				)}
				<CoffeeCard
					{coffee}
					{parseTastingNotes}
					compact={true}
					showCatalogLink={true}
					highlighted={meta?.highlight || coffee.id === selectedId}
					annotation={meta?.annotation ?? ''}
					onDetailOpen={() => (selectedId = coffee.id)}
				/>
			{/each}
		</div>
	</div>
{/if}
