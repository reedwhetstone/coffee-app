<script lang="ts">
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
		supplierComparisonHref: string;
		supplierComparisonLabel: string;
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
		supplierComparisonHref,
		supplierComparisonLabel,
		copyLinkStatus,
		onCopyFilteredCatalogLink
	}: Props = $props();
</script>

<div class="rounded-lg border border-border-light bg-background-secondary-light px-5 py-4">
	<div class="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
		<div class="max-w-3xl">
			<p class="text-xs font-semibold uppercase tracking-wide text-background-tertiary-light">
				Live supply, updated daily
			</p>
			<h1 class="mt-1 text-2xl font-bold text-text-primary-light sm:text-3xl">
				Green Coffee Catalog
			</h1>
			<p class="mt-2 text-sm leading-relaxed text-text-secondary-light sm:text-base">
				Every stocked green coffee from 40+ US importers in one place — origin, process, score, and
				live pricing, normalized daily. When the Market Index shows movement, this is where you find
				the named lots behind it.
			</p>
			<div class="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
				<div
					class="relative overflow-hidden rounded-md border border-border-light bg-background-primary-light px-3 py-2"
				>
					<p class="text-lg font-semibold text-text-primary-light">
						{catalogResultCount.toLocaleString()}
					</p>
					<p class="text-xs text-text-secondary-light">Active rows in this query</p>
					{#if isRefetching}
						<div
							class="absolute inset-x-0 bottom-0 h-0.5 bg-background-tertiary-light/20"
							role="status"
							aria-live="polite"
						>
							<div class="h-full w-full animate-pulse bg-background-tertiary-light"></div>
							<span class="sr-only">Updating results</span>
						</div>
					{/if}
				</div>
				<div class="rounded-md border border-border-light bg-background-primary-light px-3 py-2">
					<p class="text-lg font-semibold text-text-primary-light">{visibleOriginCount}</p>
					<p class="text-xs text-text-secondary-light">Origins shown on this page</p>
				</div>
				<div class="rounded-md border border-border-light bg-background-primary-light px-3 py-2">
					<p class="text-lg font-semibold text-text-primary-light">{visibleSupplierCount}</p>
					<p class="text-xs text-text-secondary-light">Suppliers shown on this page</p>
				</div>
				<div class="rounded-md border border-border-light bg-background-primary-light px-3 py-2">
					<p class="text-lg font-semibold text-text-primary-light">{visiblePricedCount}</p>
					<p class="text-xs text-text-secondary-light">Priced rows shown</p>
				</div>
			</div>
			{#if canUseSourcingIntelligence && trackedIdsSize > 0}
				<p class="mt-2 text-xs text-text-secondary-light">
					<span class="font-semibold text-background-tertiary-light">{trackedIdsSize}</span>
					{trackedIdsSize === 1 ? 'lot' : 'lots'} tracked ·
					{trackedCountOnPage} on this page ·
					{#if trackedOnlyView}
						<a
							href="/catalog"
							class="font-semibold text-background-tertiary-light hover:text-text-primary-light"
						>
							Show full catalog
						</a>
					{:else}
						<a
							href="/catalog?tracked=only"
							class="font-semibold text-background-tertiary-light hover:text-text-primary-light"
						>
							View all tracked
						</a>
					{/if}
				</p>
			{/if}
		</div>
		<div
			class="w-full rounded-lg border border-background-tertiary-light/20 bg-background-primary-light p-4 lg:max-w-sm"
		>
			<p class="text-sm font-semibold text-text-primary-light">
				See the market behind these coffees
			</p>
			<p class="mt-1 text-sm text-text-secondary-light">
				The Market Index tracks price movement, arrivals, and supplier coverage across this whole
				catalog — then come back here for the named lots.
			</p>
			<div class="mt-3 flex flex-col gap-2 sm:flex-row lg:flex-col">
				<a
					href="/analytics"
					class="rounded-md bg-background-tertiary-light px-3 py-2 text-center text-sm font-medium text-white transition-all duration-200 hover:bg-opacity-90"
				>
					Open the Market Index
				</a>
				<a
					href={supplierComparisonHref}
					class="rounded-md border border-background-tertiary-light px-3 py-2 text-center text-sm font-medium text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white"
				>
					{supplierComparisonLabel}
				</a>
			</div>
			<div class="mt-3 border-t border-border-light pt-3">
				<button
					onclick={onCopyFilteredCatalogLink}
					class="rounded-md border border-border-light bg-background-primary-light px-3 py-1.5 text-sm font-medium text-text-primary-light shadow-sm transition-colors hover:border-background-tertiary-light hover:text-background-tertiary-light"
				>
					{copyLinkStatus === 'copied'
						? 'Copied filtered link'
						: copyLinkStatus === 'error'
							? 'Copy failed'
							: 'Copy filtered link'}
				</button>
				<p class="mt-1 text-xs text-text-secondary-light">
					Share the current catalog filters, sort, and page with one link.
				</p>
			</div>
		</div>
	</div>
</div>
