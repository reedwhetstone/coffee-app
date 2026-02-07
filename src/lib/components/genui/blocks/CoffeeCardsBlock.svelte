<script lang="ts">
	import type { CoffeeCardsBlock } from '$lib/types/genui';
	import CoffeeCard from '$lib/components/CoffeeCard.svelte';
	import { parseTastingNotes } from '$lib/utils/parseTastingNotes';

	let { block } = $props<{
		block: CoffeeCardsBlock;
	}>();

	let layout = $derived(block.layout ?? 'inline');
	let annotationMap = $derived(() => {
		const map = new Map<number, { annotation?: string; highlight?: boolean }>();
		if (block.annotations) {
			for (const a of block.annotations) {
				map.set(a.id, { annotation: a.annotation, highlight: a.highlight });
			}
		}
		return map;
	});

	let hasAnnotations = $derived(!!block.annotations && block.annotations.length > 0);
</script>

{#if layout === 'grid'}
	<!-- Grid layout: side-by-side for comparison -->
	<div class="my-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
		{#each block.data as coffee (coffee.id)}
			{@const meta = annotationMap().get(coffee.id)}
			<CoffeeCard
				{coffee}
				{parseTastingNotes}
				compact={hasAnnotations}
				highlighted={meta?.highlight}
				annotation={meta?.annotation ?? ''}
			/>
		{/each}
	</div>
{:else if layout === 'focused'}
	<!-- Focused layout: single highlighted recommendation -->
	<div class="my-2">
		{#each block.data.slice(0, 1) as coffee (coffee.id)}
			{@const meta = annotationMap().get(coffee.id)}
			<CoffeeCard
				{coffee}
				{parseTastingNotes}
				highlighted={true}
				annotation={meta?.annotation ?? ''}
			/>
		{/each}
	</div>
{:else}
	<!-- Inline layout (default): vertical stack for exploration -->
	<div class="my-2 space-y-3">
		{#each block.data as coffee (coffee.id)}
			{@const meta = annotationMap().get(coffee.id)}
			<CoffeeCard
				{coffee}
				{parseTastingNotes}
				compact={hasAnnotations}
				highlighted={meta?.highlight}
				annotation={meta?.annotation ?? ''}
			/>
		{/each}
	</div>
{/if}
