<script lang="ts">
	import type { CoffeeCardsBlock, BlockAction } from '$lib/types/genui';
	import type { CoffeeCatalog } from '$lib/types/component.types';

	let { block, onAction } = $props<{
		block: CoffeeCardsBlock;
		onAction?: (action: BlockAction) => void;
	}>();

	function handleCardClick(coffee: CoffeeCatalog) {
		if (onAction) {
			const allIds = block.data.map((c: CoffeeCatalog) => c.id);
			onAction({ type: 'coffee-preview', coffeeIds: allIds, focusId: coffee.id });
		}
	}
</script>

<div class="my-4">
	<h3 class="mb-3 font-semibold text-text-primary-light">
		Coffee Recommendations ({block.data.length})
	</h3>
	<div class="space-y-3">
		{#each block.data as coffee (coffee.id)}
			<button
				type="button"
				class="group w-full rounded-lg bg-background-primary-light p-4 text-left shadow-sm ring-1 ring-border-light transition-all hover:scale-[1.02] hover:ring-background-tertiary-light"
				onclick={() => handleCardClick(coffee)}
			>
				<div
					class="flex flex-col space-y-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0"
				>
					<div class="flex-1">
						<h4
							class="font-semibold text-text-primary-light group-hover:text-background-tertiary-light"
						>
							{coffee.name}
						</h4>
						<div class="mt-1 flex items-center justify-between">
							<p class="text-sm font-medium text-background-tertiary-light">
								{coffee.source}
							</p>
							<div class="text-right sm:hidden">
								<div class="font-bold text-background-tertiary-light">
									${coffee.cost_lb}/lb
								</div>
								{#if coffee.processing}
									<div class="text-xs text-text-secondary-light">
										{coffee.processing.length > 25
											? coffee.processing.substring(0, 25) + '...'
											: coffee.processing}
									</div>
								{/if}
							</div>
						</div>
						{#if coffee.ai_description}
							<p class="my-2 line-clamp-2 text-xs text-text-secondary-light">
								{coffee.ai_description}
							</p>
						{/if}
					</div>
					<div class="hidden flex-col items-end space-y-1 sm:flex">
						<div class="text-right">
							<div class="font-bold text-background-tertiary-light">
								${coffee.cost_lb}/lb
							</div>
							{#if coffee.processing}
								<div class="mt-1 text-xs text-background-tertiary-light">
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
						class="h-4 w-4 text-text-secondary-light transition-transform group-hover:translate-x-1 group-hover:text-background-tertiary-light"
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
