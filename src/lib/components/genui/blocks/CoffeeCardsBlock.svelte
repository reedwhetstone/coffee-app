<script lang="ts">
	import type { CoffeeCardsBlock } from '$lib/types/genui';
	import type { CoffeeCatalog } from '$lib/types/component.types';
	import CoffeeCard from '$lib/components/CoffeeCard.svelte';
	import { parseTastingNotes } from '$lib/utils/parseTastingNotes';

	let { block } = $props<{ block: CoffeeCardsBlock }>();

	let viewport: HTMLDivElement | undefined = $state();
	let activeIndex = $state(0);
	let initializedKey = $state('');

	let annotationMap = $derived(() => {
		const map = new Map<number, { annotation?: string; highlight?: boolean }>();
		for (const annotation of block.annotations ?? []) {
			map.set(annotation.id, {
				annotation: annotation.annotation,
				highlight: annotation.highlight
			});
		}
		return map;
	});

	$effect(() => {
		const blockKey = `${block.focusId ?? ''}:${block.data.map((coffee: CoffeeCatalog) => coffee.id).join(',')}`;
		if (blockKey === initializedKey) return;
		const focusIndex = block.focusId
			? block.data.findIndex((coffee: CoffeeCatalog) => coffee.id === block.focusId)
			: -1;
		const highlightedIndex = block.data.findIndex(
			(coffee: CoffeeCatalog) => annotationMap().get(coffee.id)?.highlight
		);
		const nextIndex = focusIndex >= 0 ? focusIndex : highlightedIndex >= 0 ? highlightedIndex : 0;
		activeIndex = nextIndex;
		initializedKey = blockKey;
		requestAnimationFrame(() => selectCoffee(nextIndex, 'instant'));
	});

	function selectCoffee(index: number, behavior: 'auto' | 'instant' | 'smooth' = 'smooth') {
		const nextIndex = Math.max(0, Math.min(index, block.data.length - 1));
		activeIndex = nextIndex;
		viewport?.children
			.item(nextIndex)
			?.scrollIntoView({ behavior, block: 'nearest', inline: 'start' });
	}

	function handleScroll() {
		if (!viewport?.clientWidth) return;
		activeIndex = Math.max(
			0,
			Math.min(Math.round(viewport.scrollLeft / viewport.clientWidth), block.data.length - 1)
		);
	}
</script>

{#if block.data.length === 0}
	<div class="rounded-lg border border-line bg-surface-panel p-4 text-sm text-muted">
		No coffee results to review.
	</div>
{:else}
	<div class="coffee-navigator" role="region" aria-label="Coffee results">
		{#if block.data.length > 1}
			<div class="mb-2 flex items-center justify-between gap-3 px-0.5">
				<p class="text-xs text-muted" aria-live="polite">
					Coffee {activeIndex + 1} of {block.data.length}
				</p>
				<div class="flex items-center gap-1">
					<button
						type="button"
						onclick={() => selectCoffee(activeIndex - 1)}
						disabled={activeIndex === 0}
						class="rounded-md border border-line bg-surface-raised p-1.5 text-muted transition-colors hover:border-accent/50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default disabled:opacity-40"
						aria-label="Previous coffee"
					>
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="1.5"
								d="m15 18-6-6 6-6"
							/>
						</svg>
					</button>
					<button
						type="button"
						onclick={() => selectCoffee(activeIndex + 1)}
						disabled={activeIndex === block.data.length - 1}
						class="rounded-md border border-line bg-surface-raised p-1.5 text-muted transition-colors hover:border-accent/50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default disabled:opacity-40"
						aria-label="Next coffee"
					>
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="1.5"
								d="m9 18 6-6-6-6"
							/>
						</svg>
					</button>
				</div>
			</div>
		{/if}

		<div
			bind:this={viewport}
			onscroll={handleScroll}
			class="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
		>
			{#each block.data as coffee, index (coffee.id)}
				{@const meta = annotationMap().get(coffee.id)}
				<div
					class="min-w-full snap-start px-0.5"
					aria-hidden={index !== activeIndex ? 'true' : undefined}
					inert={index !== activeIndex}
				>
					<CoffeeCard
						{coffee}
						{parseTastingNotes}
						compact={true}
						showCatalogLink={true}
						highlighted={meta?.highlight || coffee.id === block.focusId}
						annotation={meta?.annotation ?? ''}
					/>
				</div>
			{/each}
		</div>

		{#if block.data.length > 1}
			<div class="mt-2 flex justify-center gap-1.5" aria-label="Choose coffee result">
				{#each block.data as coffee, index (coffee.id)}
					<button
						type="button"
						onclick={() => selectCoffee(index)}
						class="h-1.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent {index ===
						activeIndex
							? 'w-5 bg-accent'
							: 'w-1.5 bg-line hover:bg-muted/50'}"
						aria-label={`Show coffee ${index + 1}: ${coffee.name ?? 'Untitled coffee'}`}
						aria-current={index === activeIndex ? 'true' : undefined}
					></button>
				{/each}
			</div>
		{/if}
	</div>
{/if}
