<script lang="ts">
	import { goto } from '$app/navigation';
	import { filterStore } from '$lib/stores/filterStore';
	import CoffeeCard from '$lib/components/CoffeeCard.svelte';
	import type { CoffeeCatalog } from '$lib/types/component.types';
	import type { TastingNotes } from '$lib/types/coffee.types';
	import type { LotPriceContext, OriginPriceStats } from '$lib/catalog/priceContext';

	interface Pagination {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
		hasNext: boolean;
		hasPrev: boolean;
	}

	interface Props {
		session: unknown;
		displayData: CoffeeCatalog[];
		isLoadingMore: boolean;
		isRefetching: boolean;
		activePagination: Pagination;
		activeOriginStats: OriginPriceStats | null;
		trackedIds: Set<number>;
		canUseBeanMatching: boolean;
		canUseSourcingIntelligence: boolean;
		deepLinkCoffeeId: number | null;
		filteredDataLength: number;
		displayLimit: number;
		parseTastingNotes: (tastingNotesJson: string | null | object) => TastingNotes | null;
		getCardPriceContext: (coffee: CoffeeCatalog) => LotPriceContext | null;
		catalogCoffeeId: (coffee: unknown) => number | null;
		catalogCoffeeCardKey: (coffee: CoffeeCatalog) => string;
		onToggleTrack: (catalogId: number) => Promise<void>;
	}

	let {
		session,
		displayData,
		isLoadingMore,
		isRefetching,
		activePagination,
		activeOriginStats,
		trackedIds,
		canUseBeanMatching,
		canUseSourcingIntelligence,
		deepLinkCoffeeId,
		filteredDataLength,
		displayLimit,
		parseTastingNotes,
		getCardPriceContext,
		catalogCoffeeId,
		catalogCoffeeCardKey,
		onToggleTrack
	}: Props = $props();
</script>

<div class="space-y-4">
	<!--
		Stale-while-revalidate: keep the already-visible rows on screen while a new
		query is pending. A subtle non-interactive scrim plus a slight dim signals
		the refetch without blanking the page or blocking card interactions.
	-->
	<div class="relative flex-1">
		{#if isRefetching}
			<div
				class="pointer-events-none absolute inset-0 z-10 rounded-lg bg-surface-canvas/40"
				aria-hidden="true"
			></div>
		{/if}
		<div
			class="transition-opacity duration-200"
			class:opacity-60={isRefetching}
			aria-busy={isRefetching}
		>
			{#if !displayData || displayData.length === 0}
				<div class="rounded-lg border border-line bg-surface-panel p-6 text-center">
					<h2 class="text-lg font-semibold text-ink">No catalog rows match this supply query</h2>
					<p class="mx-auto mt-2 max-w-2xl text-sm text-muted">
						Clear or broaden the filters to inspect named coffees, or use the Parchment Market Index
						to review broader origin, supplier, and pricing evidence before returning to row-level
						catalog inspection.
					</p>
					<div class="mt-4 flex flex-col items-center justify-center gap-3 sm:flex-row">
						<button
							onclick={filterStore.clearFilters}
							class="rounded-md border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent"
						>
							Clear catalog filters
						</button>
						<a
							href="/analytics"
							class="rounded-md bg-accent px-4 py-2 text-sm font-medium text-ink transition-all duration-200 hover:bg-opacity-90"
						>
							Review broader Market Index
						</a>
					</div>
				</div>
			{:else}
				{#if activeOriginStats}
					{@const stats = activeOriginStats}
					<div
						class="rounded-lg border border-line bg-surface-panel px-4 py-3"
						aria-label="Origin price context"
					>
						<p class="text-xs font-semibold text-accent">
							{stats.origin} supply context
						</p>
						<div class="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
							<span class="text-muted">
								Median
								<span class="font-semibold text-ink">${stats.median.toFixed(2)}/lb</span>
							</span>
							<span class="text-muted">
								Range
								<span class="font-medium text-ink"
									>${stats.min.toFixed(2)} – ${stats.max.toFixed(2)}</span
								>
							</span>
							<span class="text-muted">
								<span class="font-medium text-ink">{stats.supplier_count}</span>
								{stats.supplier_count === 1 ? 'supplier' : 'suppliers'}
							</span>
							<span class="text-muted">
								<span class="font-medium text-ink">{stats.sample_size}</span> priced lots across all
								suppliers
							</span>
						</div>
					</div>
				{/if}
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
					{#each session ? displayData : displayData.slice(0, 15) as coffee (catalogCoffeeCardKey(coffee))}
						<CoffeeCard
							{coffee}
							{parseTastingNotes}
							showSimilarComparisonAction={true}
							{canUseBeanMatching}
							priceContext={getCardPriceContext(coffee)}
							tracked={trackedIds.has((coffee as unknown as { id: number }).id)}
							onToggleTrack={canUseSourcingIntelligence ? onToggleTrack : undefined}
							initialDetailsOpen={deepLinkCoffeeId === catalogCoffeeId(coffee)}
						/>
					{/each}

					{#if isLoadingMore}
						<div class="flex justify-center p-4">
							<div
								class="h-8 w-8 animate-spin rounded-full border-4 border-accent/30 border-t-accent"
							></div>
						</div>
					{/if}

					{#if !session && (activePagination.total > 15 || displayData.length >= 15)}
						<div class="col-span-full mt-2">
							<div
								class="rounded-lg bg-surface-panel px-8 py-10 text-center shadow-sm ring-1 ring-accent/30"
							>
								<p class="mb-1 text-sm font-medium text-warning-strong">
									You're viewing 15 of {activePagination.total || displayData.length} specialty coffees
								</p>
								<h3 class="mb-2 text-xl font-semibold text-ink">Keep going with a free account</h3>
								<p class="mb-6 text-sm text-muted">
									Create a free account to browse the full catalog, inspect more supply evidence,
									and continue from public market discovery.
								</p>
								<div class="flex flex-col items-center justify-center gap-3 sm:flex-row">
									<button
										onclick={() => goto('/auth')}
										class="rounded-md bg-accent px-6 py-2.5 text-sm font-medium text-ink shadow-sm transition-all duration-200 hover:bg-opacity-90"
									>
										Create free account
									</button>
									<button
										onclick={() => goto('/subscription')}
										class="rounded-md border border-accent px-6 py-2.5 text-sm font-medium text-accent transition-all duration-200 hover:bg-accent hover:text-ink"
									>
										See products
									</button>
								</div>
							</div>
						</div>
					{/if}

					{#if session && activePagination.totalPages > 1}
						<div class="col-span-full flex items-center justify-center gap-4 p-4">
							<button
								onclick={() => filterStore.loadPrevPage()}
								disabled={!activePagination.hasPrev || $filterStore.isLoading || isRefetching}
								class="rounded-md border border-accent px-4 py-2 text-sm font-medium text-accent transition-all duration-200 hover:bg-accent hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
							>
								Previous
							</button>

							<span class="text-sm text-muted">
								Page {activePagination.page} of {activePagination.totalPages}
								({activePagination.total} total items)
							</span>

							<button
								onclick={() => filterStore.loadNextPage()}
								disabled={!activePagination.hasNext || $filterStore.isLoading || isRefetching}
								class="rounded-md border border-accent px-4 py-2 text-sm font-medium text-accent transition-all duration-200 hover:bg-accent hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
							>
								Next
							</button>
						</div>
					{/if}

					{#if session && !$filterStore.pagination.totalPages && !isLoadingMore && displayLimit < filteredDataLength}
						<div class="flex justify-center p-4">
							<p class="text-sm text-ink">Scroll for more coffees...</p>
						</div>
					{/if}

					{#if session && !$filterStore.pagination.totalPages && displayLimit >= filteredDataLength && filteredDataLength > 0}
						<div class="flex justify-center p-4">
							<p class="text-sm text-ink">No more coffees to load</p>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>
