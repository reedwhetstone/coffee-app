<script lang="ts">
	import type { TrackedLotSummary } from '$lib/server/trackedLots';

	type ViewMode = 'retail' | 'wholesale' | 'all';

	interface Props {
		scopedTrackedLots: TrackedLotSummary[];
		trackedDelistedCount: number;
		trackedPriceMovers: TrackedLotSummary[];
		viewModeLabel: string;
		viewMode: ViewMode;
	}

	let { scopedTrackedLots, trackedDelistedCount, trackedPriceMovers, viewModeLabel }: Props =
		$props();

	function formatSigned(value: number | null, precision = 0): string {
		if (value == null) return 'Baseline';
		if (Math.abs(value) < 0.01) return 'Flat';
		const sign = value > 0 ? '+' : '−';
		return `${sign}${Math.abs(value).toFixed(precision)}`;
	}
</script>

{#if scopedTrackedLots.length > 0}
	<section
		class="mb-6 rounded-xl border border-border-light bg-background-primary-light p-5 shadow-sm"
		aria-label="Watchlist signals"
	>
		<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<p class="text-xs font-semibold uppercase tracking-wide text-background-tertiary-light">
					Watchlist signals
				</p>
				<h2 class="mt-1 text-lg font-semibold text-text-primary-light">
					{scopedTrackedLots.length} tracked {viewModeLabel}
					{scopedTrackedLots.length === 1 ? 'lot' : 'lots'}{trackedDelistedCount > 0
						? ` · ${trackedDelistedCount} delisted since tracking`
						: ''}
				</h2>
			</div>
			<a
				href="/catalog?tracked=only"
				class="text-sm font-medium text-background-tertiary-light hover:text-text-primary-light"
			>
				Manage watchlist
			</a>
		</div>
		<div class="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
			{#each scopedTrackedLots.slice(0, 6) as lot (lot.catalogId)}
				<div
					class="min-w-0 rounded-lg border border-border-light bg-background-secondary-light p-3"
				>
					<p class="truncate text-sm font-semibold text-text-primary-light">{lot.name}</p>
					<p class="mt-0.5 truncate text-xs text-text-secondary-light">
						{[lot.source, lot.country].filter(Boolean).join(' · ') || 'Supplier unknown'}
					</p>
					<div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
						{#if lot.stocked === false}
							<span class="rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-700">
								Delisted
							</span>
						{:else}
							<span class="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
								Stocked
							</span>
						{/if}
						{#if lot.currentPrice !== null}
							<span class="font-semibold text-text-primary-light">
								${lot.currentPrice.toFixed(2)}/lb
							</span>
						{/if}
						{#if lot.priceDelta !== null && Math.abs(lot.priceDelta) >= 0.05}
							<span
								class="font-medium {lot.priceDelta > 0 ? 'text-amber-700' : 'text-emerald-700'}"
							>
								{formatSigned(lot.priceDelta, 2)} since tracked
							</span>
						{/if}
					</div>
				</div>
			{/each}
		</div>
		{#if trackedPriceMovers.length > 0}
			<p class="mt-3 text-xs text-text-secondary-light">
				Biggest move since tracking: {trackedPriceMovers[0].name}
				({formatSigned(trackedPriceMovers[0].priceDelta, 2)}/lb).
			</p>
		{/if}
	</section>
{/if}
