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
		onCoffeePreview?: (coffeeIds: number[], focusId?: number) => void;
	}>();

	// Filter coffee data to match the requested card IDs
	let filteredCoffeeData = $derived(() => {
		if (!coffeeCards || coffeeCards.length === 0) return [];
		return coffeeData.filter((coffee: any) => coffeeCards.includes(coffee.id));
	});

	// Handle individual coffee card click - opens full list with focus on selected coffee
	function handleCoffeeCardClick(coffee: any) {
		if (onCoffeePreview) {
			// Pass all coffee IDs to show full list, with focusId to indicate which one to scroll to
			const allIds = filteredCoffeeData().map((c: any) => c.id);
			onCoffeePreview(allIds, coffee.id);
		}
	}
</script>

<!-- Markdown Content -->
<div
	class="prose prose-sm text-text-primary-light prose-headings:text-text-primary-light prose-p:text-text-primary-light prose-strong:text-text-primary-light prose-ol:text-text-primary-light prose-ul:text-text-primary-light prose-li:text-text-primary-light max-w-none"
>
	<SvelteMarkdown source={message} />
</div>

<!-- Coffee Recommendations Section -->
{#if coffeeCards && coffeeCards.length > 0 && filteredCoffeeData().length > 0}
	<div class="my-4">
		<h3 class="text-text-primary-light mb-3 font-semibold">
			Coffee Recommendations ({filteredCoffeeData().length})
		</h3>

		<!-- Coffee List -->
		<div class="space-y-3">
			{#each filteredCoffeeData() as coffee}
				<button
					type="button"
					class="bg-background-primary-light ring-border-light hover:ring-background-tertiary-light group w-full rounded-lg p-4 text-left shadow-sm ring-1 transition-all hover:scale-[1.02]"
					onclick={() => handleCoffeeCardClick(coffee)}
				>
					<div
						class="flex flex-col space-y-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0"
					>
						<!-- Content section -->
						<div class="flex-1">
							<h4
								class="text-text-primary-light group-hover:text-background-tertiary-light font-semibold"
							>
								{coffee.name}
							</h4>
							<div class="mt-1 flex items-center justify-between">
								<p class="text-background-tertiary-light text-sm font-medium">
									{coffee.source}
								</p>
								<!-- Mobile: Price and processing next to supplier name -->
								<div class="text-right sm:hidden">
									<div class="text-background-tertiary-light font-bold">
										${coffee.cost_lb}/lb
									</div>
									{#if coffee.processing}
										<div class="text-text-secondary-light text-xs">
											{coffee.processing.length > 25
												? coffee.processing.substring(0, 25) + '...'
												: coffee.processing}
										</div>
									{/if}
								</div>
							</div>
							{#if coffee.ai_description}
								<p class="text-text-secondary-light my-2 line-clamp-2 text-xs">
									{coffee.ai_description}
								</p>
							{/if}
						</div>

						<!-- Desktop: Price and processing in sidebar -->
						<div class="hidden flex-col items-end space-y-1 sm:flex">
							<div class="text-right">
								<div class="text-background-tertiary-light font-bold">
									${coffee.cost_lb}/lb
								</div>
								{#if coffee.processing}
									<div class="text-background-tertiary-light mt-1 text-xs">
										{coffee.processing.length > 25
											? coffee.processing.substring(0, 25) + '...'
											: coffee.processing}
									</div>
								{/if}
							</div>
						</div>
					</div>

					<div class="mt-3 flex items-center justify-end">
						<svg
							class="text-text-secondary-light group-hover:text-background-tertiary-light h-4 w-4 transition-transform group-hover:translate-x-1"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
							/>
						</svg>
					</div>
				</button>
			{/each}
		</div>
	</div>
{/if}
