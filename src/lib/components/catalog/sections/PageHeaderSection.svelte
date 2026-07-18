<script lang="ts">
	import AccentSpine from '$lib/components/ui/AccentSpine.svelte';
	interface Props {
		catalogResultCount: number;
		visibleOriginCount: number;
		visibleSupplierCount: number;
		visiblePricedCount: number;
		canUseSourcingIntelligence: boolean;
		isRefetching: boolean;
		trackedIdsSize: number;
		trackedCountOnPage: number;
		trackedOnlyView: boolean;
		copyLinkStatus: 'idle' | 'copied' | 'error';
		onCopyFilteredCatalogLink: () => void;
	}

	let {
		catalogResultCount,
		visibleOriginCount,
		visibleSupplierCount,
		visiblePricedCount,
		canUseSourcingIntelligence,
		isRefetching,
		trackedIdsSize,
		trackedCountOnPage,
		trackedOnlyView,
		copyLinkStatus,
		onCopyFilteredCatalogLink
	}: Props = $props();
</script>

<div class="rounded-lg border border-line bg-surface-panel px-5 py-4">
	<div class="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
		<div class="max-w-3xl">
			<p class="text-xs font-semibold text-accent">Live supply, updated daily</p>
			<h1 class="mt-1 font-serif text-2xl font-medium tracking-tight text-ink sm:text-3xl">
				Green Coffee Catalog
			</h1>
			<p class="mt-2 text-sm leading-relaxed text-muted sm:text-base">
				Every stocked green coffee from 40+ US importers in one place — origin, process, score, and
				live pricing, normalized daily. When the Market Index shows movement, this is where you find
				the named lots behind it.
			</p>
			<div class="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
				<div
					class="relative overflow-hidden rounded-md border border-line bg-surface-canvas px-3 py-2"
				>
					<p class="text-lg font-semibold text-ink">
						{catalogResultCount.toLocaleString()}
					</p>
					<p class="text-xs text-muted">Active rows in this query</p>
					{#if isRefetching}
						<div
							class="absolute inset-x-0 bottom-0 h-0.5 bg-accent/20"
							role="status"
							aria-live="polite"
						>
							<div class="h-full w-full animate-pulse bg-accent"></div>
							<span class="sr-only">Updating results</span>
						</div>
					{/if}
				</div>
				<div class="rounded-md border border-line bg-surface-canvas px-3 py-2">
					<p class="text-lg font-semibold text-ink">{visibleOriginCount}</p>
					<p class="text-xs text-muted">Origins shown on this page</p>
				</div>
				<div class="rounded-md border border-line bg-surface-canvas px-3 py-2">
					<p class="text-lg font-semibold text-ink">{visibleSupplierCount}</p>
					<p class="text-xs text-muted">Suppliers shown on this page</p>
				</div>
				<div class="rounded-md border border-line bg-surface-canvas px-3 py-2">
					<p class="text-lg font-semibold text-ink">{visiblePricedCount}</p>
					<p class="text-xs text-muted">Priced rows shown</p>
				</div>
			</div>
			{#if canUseSourcingIntelligence && trackedIdsSize > 0}
				<p class="mt-2 text-xs text-muted">
					<span class="font-semibold text-accent">{trackedIdsSize}</span>
					{trackedIdsSize === 1 ? 'lot' : 'lots'} tracked ·
					{trackedCountOnPage} on this page ·
					{#if trackedOnlyView}
						<a href="/catalog" class="font-semibold text-accent hover:text-ink">
							Show full catalog
						</a>
					{:else}
						<a href="/catalog?tracked=only" class="font-semibold text-accent hover:text-ink">
							View all tracked
						</a>
					{/if}
				</p>
			{/if}
		</div>
		<div
			class="relative w-full overflow-hidden rounded-lg border border-accent/20 bg-surface-canvas p-4 pl-6 lg:max-w-sm"
		>
			<AccentSpine />
			<p class="text-sm font-semibold text-ink">See the market behind these coffees</p>
			<p class="mt-1 text-sm text-muted">
				The Market Index tracks price movement, arrivals, and supplier coverage across this whole
				catalog — then come back here for the named lots.
			</p>
			{#if catalogResultCount > 0}
				<div class="mt-3">
					<a
						href="/analytics"
						class="rounded-md bg-accent px-3 py-2 text-center text-sm font-medium text-ink transition-all duration-200 hover:bg-opacity-90"
					>
						Open the Market Index
					</a>
				</div>
			{/if}
			<div class="mt-3 border-t border-line pt-3">
				<button
					onclick={onCopyFilteredCatalogLink}
					class="rounded-md border border-line bg-surface-canvas px-3 py-1.5 text-sm font-medium text-ink shadow-sm transition-colors hover:border-accent hover:text-accent"
				>
					{copyLinkStatus === 'copied'
						? 'Copied filtered link'
						: copyLinkStatus === 'error'
							? 'Copy failed'
							: 'Copy filtered link'}
				</button>
				<p class="mt-1 text-xs text-muted">
					Share the current catalog filters, sort, and page with one link.
				</p>
			</div>
		</div>
	</div>
</div>
