<script lang="ts">
	import { tick } from 'svelte';
	import type { CoffeeCatalog } from '$lib/types/component.types';
	import CoffeeCard from '$lib/components/CoffeeCard.svelte';
	import type { BlockAction, CoffeeCardsBlock, CoffeeCardAnnotation } from '$lib/types/genui';
	import { parseTastingNotes } from '$lib/utils/parseTastingNotes';
	import { formatPriceTierSummary } from '$lib/utils/pricing';
	import { normalizeProcessDisplayValue } from '$lib/catalog/processDisplay';

	let { block, onAction, canvasBlockId } = $props<{
		block: CoffeeCardsBlock;
		onAction?: (action: BlockAction) => void;
		canvasBlockId?: string;
	}>();

	let expanded = $state(false);
	let inspectedBlock = $state.raw<CoffeeCardsBlock | null>(null);
	const openDetails = new Set<number>();
	let displayBlock: CoffeeCardsBlock = $derived(inspectedBlock ?? block);
	let root: HTMLElement | undefined = $state();
	let annotations = $derived(
		new Map<number, CoffeeCardAnnotation>(
			displayBlock.annotations?.map((annotation: CoffeeCardAnnotation) => [
				annotation.id,
				annotation
			])
		)
	);
	let focusId = $derived(
		displayBlock.data.some((coffee: CoffeeCatalog) => coffee.id === displayBlock.focusId)
			? displayBlock.focusId
			: displayBlock.data.find((coffee: CoffeeCatalog) => annotations.get(coffee.id)?.highlight)?.id
	);
	let visibleCoffees = $derived.by(() => {
		if (expanded || displayBlock.data.length <= 3) return displayBlock.data;
		const focusIndex = displayBlock.data.findIndex(
			(coffee: CoffeeCatalog) => coffee.id === focusId
		);
		// Keep the supplied order, while retaining a focused result in the bounded preview.
		return focusIndex >= 3
			? displayBlock.data.filter(
					(_: CoffeeCatalog, index: number) => index < 2 || index === focusIndex
				)
			: displayBlock.data.slice(0, 3);
	});

	function inspectCoffee(id: number) {
		inspectedBlock ??= displayBlock;
		openDetails.add(id);
	}

	async function returnToCoffee(id: number) {
		openDetails.delete(id);
		if (openDetails.size === 0) inspectedBlock = null;
		await tick();
		const trigger = root
			?.querySelector(`[data-inline-coffee-id="${id}"]`)
			?.querySelector<HTMLButtonElement>('button');
		(trigger ?? root)?.focus();
	}
</script>

<section bind:this={root} tabindex="-1" aria-label="Coffee results" class="not-prose my-3 min-w-0">
	<div class="mb-3 flex flex-wrap items-start justify-between gap-2">
		<div>
			<p class="text-sm font-semibold text-ink">
				{displayBlock.data.length}
				{displayBlock.data.length === 1 ? 'coffee' : 'coffees'}
			</p>
			<p class="mt-0.5 text-xs leading-relaxed text-muted">
				Details from this answer. Prices and availability may have changed.
			</p>
		</div>
		{#if canvasBlockId && onAction}
			<button
				type="button"
				onclick={() => {
					if (canvasBlockId) onAction?.({ type: 'focus-canvas-block', blockId: canvasBlockId });
				}}
				class="min-h-9 rounded-md border border-line px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-accent hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
			>
				Open evidence
			</button>
		{/if}
	</div>

	{#if displayBlock.data.length === 0}
		<p class="rounded-lg border border-line bg-surface-panel p-3 text-sm text-muted">
			No coffee results to review.
		</p>
	{:else}
		<ul class="space-y-3" aria-label="Returned coffees">
			{#each visibleCoffees as coffee (coffee.id)}
				{@const meta = annotations.get(coffee.id)}
				{@const tiers = formatPriceTierSummary(coffee.price_tiers)}
				<li data-inline-coffee-id={coffee.id}>
					<CoffeeCard
						{coffee}
						{parseTastingNotes}
						compact={true}
						showCatalogLink={true}
						highlighted={meta?.highlight || coffee.id === focusId}
						annotation={meta?.annotation ?? ''}
						detailCloseLabel="Back to answer"
						onDetailOpen={() => inspectCoffee(coffee.id)}
						onDetailClose={() => void returnToCoffee(coffee.id)}
					/>
					{#if tiers || !normalizeProcessDisplayValue(coffee.processing)}
						<p class="mt-1.5 px-1 text-xs leading-relaxed text-muted">
							{#if tiers}<span>{tiers}</span>{/if}
							{#if !normalizeProcessDisplayValue(coffee.processing)}
								<span>{tiers ? ' · ' : ''}Process label unavailable</span>
							{/if}
						</p>
					{/if}
				</li>
			{/each}
		</ul>
		{#if displayBlock.data.length > 3}
			<button
				type="button"
				aria-expanded={expanded}
				onclick={() => (expanded = !expanded)}
				class="mt-3 min-h-10 rounded-md border border-line px-3 py-2 text-xs font-semibold text-muted transition-colors hover:border-accent hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
			>
				{expanded
					? 'Show fewer coffees'
					: `Show ${displayBlock.data.length - 3} more ${displayBlock.data.length === 4 ? 'coffee' : 'coffees'}`}
			</button>
		{/if}
	{/if}
</section>
