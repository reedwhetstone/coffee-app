<script lang="ts">
	import SvelteMarkdown from '@humanspeak/svelte-markdown';
	import type { TastingNotes } from '$lib/types/coffee.types';

	let { 
		message,
		coffeeCards = [],
		coffeeData = [],
		parseTastingNotes,
		onCoffeePreview
	} = $props<{
		message: string;
		coffeeCards?: number[];
		coffeeData?: any[];
		parseTastingNotes: (tastingNotesJson: string | null | object) => TastingNotes | null;
		onCoffeePreview?: (coffeeIds: number[]) => void;
	}>();

	// Filter coffee data to match the requested card IDs
	let filteredCoffeeData = $derived(() => {
		if (!coffeeCards || coffeeCards.length === 0) return [];
		return coffeeData.filter((coffee: any) => coffeeCards.includes(coffee.id));
	});

	// Handle opening coffee preview
	function handleCoffeePreview() {
		if (onCoffeePreview && coffeeCards.length > 0) {
			onCoffeePreview(coffeeCards);
		}
	}
</script>

<!-- Coffee Recommendations Section -->
{#if coffeeCards && coffeeCards.length > 0 && filteredCoffeeData().length > 0}
	<div class="mb-4 rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
		<div class="mb-3 flex items-center justify-between">
			<h3 class="font-semibold text-text-primary-light">
				Coffee Recommendations ({filteredCoffeeData().length})
			</h3>
			<button
				onclick={handleCoffeePreview}
				class="rounded-md bg-background-tertiary-light px-3 py-1 text-sm font-medium text-white transition-all duration-200 hover:bg-opacity-90"
			>
				View Details
			</button>
		</div>
		
		<!-- Coffee List -->
		<div class="space-y-2">
			{#each filteredCoffeeData() as coffee}
				<div class="rounded-md border border-border-light bg-background-primary-light p-3 transition-all hover:bg-background-tertiary-light hover:text-white hover:border-background-tertiary-light">
					<div class="flex items-center justify-between">
						<div class="flex-1">
							<h4 class="font-medium">{coffee.name}</h4>
							<p class="text-sm opacity-75">
								{[coffee.continent, coffee.country, coffee.region].filter(Boolean).join(' > ') || 'Origin not specified'}
							</p>
							{#if coffee.ai_description}
								<p class="mt-1 text-xs opacity-60 line-clamp-2">
									{coffee.ai_description}
								</p>
							{/if}
						</div>
						<div class="ml-4 text-right">
							<div class="font-bold">
								${coffee.cost_lb}/lb
							</div>
							{#if coffee.processing}
								<div class="text-xs opacity-75">
									{coffee.processing}
								</div>
							{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>
		
		<!-- Preview Button at Bottom -->
		<div class="mt-3 text-center">
			<button
				onclick={handleCoffeePreview}
				class="rounded-md border border-background-tertiary-light px-4 py-2 text-sm text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white"
			>
				<svg class="mr-2 inline h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
				</svg>
				View Full Details
			</button>
		</div>
	</div>
{/if}

<!-- Markdown Content -->
<div class="prose prose-sm max-w-none text-text-primary-light prose-headings:text-text-primary-light prose-p:text-text-primary-light prose-strong:text-text-primary-light prose-ul:text-text-primary-light prose-ol:text-text-primary-light prose-li:text-text-primary-light">
	<SvelteMarkdown source={message} />
</div>