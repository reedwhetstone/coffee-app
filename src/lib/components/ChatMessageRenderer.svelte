<script lang="ts">
	import SvelteMarkdown from '@humanspeak/svelte-markdown';
	import CoffeeCard from './CoffeeCard.svelte';
	import type { TastingNotes } from '$lib/types/coffee.types';

	let { 
		message,
		coffeeCards = [],
		coffeeData = [],
		parseTastingNotes
	} = $props<{
		message: string;
		coffeeCards?: number[];
		coffeeData?: any[];
		parseTastingNotes: (tastingNotesJson: string | null | object) => TastingNotes | null;
	}>();

	// Filter coffee data to match the requested card IDs
	let filteredCoffeeData = $derived(() => {
		if (!coffeeCards || coffeeCards.length === 0) return [];
		return coffeeData.filter((coffee: any) => coffeeCards.includes(coffee.id));
	});
</script>

<!-- Coffee Cards Section -->
{#if coffeeCards && coffeeCards.length > 0 && filteredCoffeeData().length > 0}
	<div class="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
		{#each filteredCoffeeData() as coffee}
			<CoffeeCard {coffee} {parseTastingNotes} />
		{/each}
	</div>
{/if}

<!-- Markdown Content -->
<div class="prose prose-sm max-w-none text-text-primary-light prose-headings:text-text-primary-light prose-p:text-text-primary-light prose-strong:text-text-primary-light prose-ul:text-text-primary-light prose-ol:text-text-primary-light prose-li:text-text-primary-light">
	<SvelteMarkdown source={message} />
</div>