<script lang="ts">
	import CoffeeCard from '$lib/components/CoffeeCard.svelte';
	import type { CoffeeCatalog } from '$lib/types/component.types';
	import type { TastingNotes } from '$lib/types/coffee.types';

	let { coffee, parseTastingNotes } = $props<{
		coffee: CoffeeCatalog;
		parseTastingNotes: (tastingNotesJson: string | null | object) => TastingNotes | null;
	}>();
</script>

<CoffeeCard {coffee} {parseTastingNotes}>
	{#snippet detailContent()}
		<section aria-label="Portfolio detail">
			<h3>Portfolio roast history</h3>
			<p>Inventory, cupping, roasting, and analytics stay inside the canonical panel.</p>
		</section>
	{/snippet}
</CoffeeCard>
