<script lang="ts">
	import AccentSpine from '$lib/components/ui/AccentSpine.svelte';
	import ExpandablePanel from '$lib/components/analytics/ExpandablePanel.svelte';
	import AnalyticsLoadingPanel from '$lib/components/analytics/AnalyticsLoadingPanel.svelte';
	import SupplierPriceRangeChart from '$lib/components/analytics/SupplierPriceRangeChart.svelte';
	import MovementByOriginChart from '$lib/components/analytics/MovementByOriginChart.svelte';
	import type {
		PriceSnapshot,
		ArrivalBean,
		DelistingBean,
		ComparisonBean,
		SupplierHealthRow,
		SupplierPriceRange
	} from '../../../../routes/analytics/+page.server';
	import type { DeferredAnalyticsComponent } from '../../../../routes/analytics/deferredModules';

	type WindowMode = '7d' | '30d';

	interface OriginBenchmarkRow {
		origin: string;
		price_avg: number;
		supplier_count: number;
		sample_size: number;
		price_min: number | null;
		price_max: number | null;
	}

	interface Props {
		isParchmentIntelligence: boolean;
		session: unknown;
		PriceTierChartComponent: DeferredAnalyticsComponent | null;
		SupplierComparisonTableComponent: DeferredAnalyticsComponent | null;
		SupplierHealthTableComponent: DeferredAnalyticsComponent | null;
		memberVisualsError: string | null;
		snapshots: PriceSnapshot[];
		scopedComparisonBeans: ComparisonBean[];
		scopedSupplierPriceRanges: SupplierPriceRange[];
		scopedSupplierHealth: SupplierHealthRow[];
		filteredArrivals: ArrivalBean[];
		filteredDelistings: DelistingBean[];
		/** Exact scoped window totals from movement counts (loaded rows are capped). */
		arrivalTotal: number;
		delistingTotal: number;
		/** False when movement counts are missing or the source data is stale (>90d). */
		isMovementDataAvailable: boolean;
		originBarData: OriginBenchmarkRow[];
		hasSnapshots: boolean;
		windowMode: WindowMode;
		viewModeLabel: string;
		onRetry: () => void;
		onWindowModeChange: (v: WindowMode) => void;
	}

	let {
		isParchmentIntelligence,
		session,
		PriceTierChartComponent,
		SupplierComparisonTableComponent,
		SupplierHealthTableComponent,
		memberVisualsError,
		snapshots,
		scopedComparisonBeans,
		scopedSupplierPriceRanges,
		scopedSupplierHealth,
		filteredArrivals,
		filteredDelistings,
		arrivalTotal,
		delistingTotal,
		isMovementDataAvailable,
		originBarData,
		hasSnapshots,
		windowMode,
		viewModeLabel,
		onRetry,
		onWindowModeChange
	}: Props = $props();

	let windowDaysLabel = $derived(windowMode === '7d' ? '7' : '30');

	// The loader caps the named-row lists (50/market), so the loaded rows can be
	// fewer than the exact window totals shown in the KPI strip. The expand
	// affordance must never claim "all" for a truncated list, and no window
	// freshness is claimed when the movement data itself is stale/unavailable.
	let movementLoadedRows = $derived(filteredArrivals.length + filteredDelistings.length);
	let movementWindowTotal = $derived(arrivalTotal + delistingTotal);
	let movementTruncated = $derived(
		isMovementDataAvailable && movementLoadedRows < movementWindowTotal
	);
	let movementExpandLabel = $derived.by(() => {
		if (!isMovementDataAvailable) return `Open ${movementLoadedRows} loaded rows →`;
		if (movementTruncated) return `Open latest ${movementLoadedRows} of ${movementWindowTotal} →`;
		return `View all ${movementWindowTotal} →`;
	});
	let supplierComparisonExpandableRows = $derived(
		scopedSupplierPriceRanges.length + scopedComparisonBeans.length
	);
</script>

{#if !isParchmentIntelligence}
	<!-- Honest gated teaser: state what Intelligence adds, no fake blurred data. -->
	<section
		class="relative mb-8 overflow-hidden rounded-lg border border-accent/20 bg-accent-subtle/10 p-6 pl-8"
		aria-label="Parchment Intelligence"
	>
		<AccentSpine />
		<div class="flex flex-col items-start justify-between gap-5 lg:flex-row lg:items-center">
			<div class="max-w-2xl">
				<h3 class="font-serif text-xl font-medium tracking-tight text-ink">
					The supplier layer runs deeper.
				</h3>
				<p class="mt-2 text-sm leading-6 text-muted">
					Parchment Intelligence adds the working views behind this page: supplier-by-supplier price
					ranges, catalog health, the arrivals and delistings feed by origin, origin benchmarks with
					longer history, and the retail-versus-wholesale spread.
				</p>
				<ul class="mt-3 grid gap-x-6 gap-y-1 text-sm text-muted sm:grid-cols-2">
					<li>Compare 40+ importers on price and coverage</li>
					<li>Track new arrivals the day they stock</li>
					<li>Catch delistings before your next order closes</li>
					<li>Origin benchmarks with 6-month and 1-year depth</li>
				</ul>
			</div>
			<div class="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
				<a
					href="/subscription?plan=intelligence-monthly&intent=checkout"
					class="rounded-md bg-accent px-6 py-2.5 text-center text-sm font-semibold text-ink transition-all duration-200 hover:bg-accent/85"
				>
					Start Intelligence
				</a>
				{#if !session}
					<a
						href="/subscription"
						class="rounded-md border border-accent px-6 py-2.5 text-center text-sm font-medium text-ink transition-all duration-200 hover:bg-accent"
					>
						See plans
					</a>
				{/if}
			</div>
		</div>
	</section>
{:else}
	<div id="supplier-comparison" class="mb-8 space-y-6">
		<!-- Who has what, at what price: visual first, full table in the breakout. -->
		<ExpandablePanel
			title="Supplier price comparison"
			subtitle="Public stocked price ranges per supplier in the {viewModeLabel} scope. Expand for the full supplier range set and lot-level preview."
			totalItems={supplierComparisonExpandableRows}
			expandLabel="Open supplier detail →"
			collapsedMaxHeight="380px"
			showGradient={false}
		>
			<AnalyticsLoadingPanel
				ready={Boolean(SupplierComparisonTableComponent)}
				title="Supplier price comparison"
				description="Loading supplier comparison tools."
				height="h-64"
				panelClass="border-line"
				errorMessage={memberVisualsError}
				{onRetry}
			>
				<div class="rounded-lg border border-line bg-surface-canvas p-5 shadow-sm sm:p-6">
					<div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,28rem)]">
						<div>
							<h2 class="mb-1 text-base font-semibold text-ink">Who has it cheapest?</h2>
							<p class="mb-4 text-sm text-muted">
								Each supplier's price range across public stocked lots in this scope.
							</p>
							<SupplierPriceRangeChart
								rows={scopedSupplierPriceRanges}
								maxSuppliers={Math.max(scopedSupplierPriceRanges.length, 1)}
							/>
						</div>
						<div class="rounded-lg border border-line bg-surface-panel p-4">
							<p class="text-xs font-semibold uppercase tracking-wide text-muted">Preview</p>
							<p class="mt-2 text-sm leading-6 text-muted">
								The range chart uses the full public supplier aggregate. The lot preview stays
								capped and price-ordered so the first rows remain actionable.
							</p>
							<dl class="mt-4 grid grid-cols-2 gap-3 text-sm">
								<div>
									<dt class="text-muted">Suppliers</dt>
									<dd class="mt-1 text-lg font-semibold text-ink">
										{scopedSupplierPriceRanges.length}
									</dd>
								</div>
								<div>
									<dt class="text-muted">Preview lots</dt>
									<dd class="mt-1 text-lg font-semibold text-ink">
										{scopedComparisonBeans.length}
									</dd>
								</div>
							</dl>
						</div>
					</div>
					<div class="mt-6 border-t border-line pt-4">
						<h3 class="mb-3 text-sm font-semibold text-ink">Lot-level preview</h3>
						{#if SupplierComparisonTableComponent}
							<SupplierComparisonTableComponent beans={scopedComparisonBeans} />
						{/if}
					</div>
				</div>
			</AnalyticsLoadingPanel>
		</ExpandablePanel>

		<!-- What's arriving and leaving: one diverging read, tables in the breakout. -->
		<ExpandablePanel
			title="Arrivals & delistings"
			subtitle="Catalog movement by origin over the selected window. Expand for the named lots."
			totalItems={isMovementDataAvailable ? movementWindowTotal : movementLoadedRows}
			expandLabel={movementExpandLabel}
			collapsedMaxHeight="380px"
			showGradient={false}
		>
			<div class="rounded-lg border border-line bg-surface-canvas p-6 shadow-sm">
				<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
					<div>
						<h2 class="text-base font-semibold text-ink">What's arriving and leaving?</h2>
						<p class="mt-1 text-sm text-muted">
							{#if !isMovementDataAvailable}
								Showing {filteredArrivals.length} arrivals and {filteredDelistings.length} delistings
								from the most recent catalog data — movement counts are currently unavailable.
							{:else if movementTruncated}
								Showing the latest {filteredArrivals.length} of {arrivalTotal} arrivals and {filteredDelistings.length}
								of {delistingTotal} delistings from the last {windowDaysLabel} days.
							{:else}
								Showing {filteredArrivals.length} arrivals and {filteredDelistings.length} delistings
								from the last {windowDaysLabel} days.
							{/if}
						</p>
					</div>
					<div
						class="flex rounded-full border border-line bg-surface-panel p-0.5 text-xs font-medium"
					>
						{#each [{ value: '7d', label: '7d' }, { value: '30d', label: '30d' }] as opt}
							<button
								onclick={() => onWindowModeChange(opt.value as WindowMode)}
								class="rounded-full px-3 py-1 transition-all duration-150 {windowMode === opt.value
									? 'bg-accent text-ink shadow-sm'
									: 'text-muted hover:text-ink'}"
							>
								{opt.label}
							</button>
						{/each}
					</div>
				</div>
				<div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,28rem)]">
					<MovementByOriginChart
						arrivals={filteredArrivals}
						delistings={filteredDelistings}
						maxOrigins={999}
					/>
					<div class="rounded-lg border border-line bg-surface-panel p-4">
						<p class="text-xs font-semibold uppercase tracking-wide text-muted">Window summary</p>
						{#if isMovementDataAvailable}
							<dl class="mt-4 grid grid-cols-2 gap-3 text-sm">
								<div>
									<dt class="text-muted">Arrivals</dt>
									<dd class="mt-1 text-lg font-semibold text-success-strong">{arrivalTotal}</dd>
								</div>
								<div>
									<dt class="text-muted">Delistings</dt>
									<dd class="mt-1 text-lg font-semibold text-danger-strong">{delistingTotal}</dd>
								</div>
							</dl>
						{:else}
							<dl class="mt-4 grid grid-cols-2 gap-3 text-sm">
								<div>
									<dt class="text-muted">Loaded arrivals</dt>
									<dd class="mt-1 text-lg font-semibold text-success-strong">
										{filteredArrivals.length}
									</dd>
								</div>
								<div>
									<dt class="text-muted">Loaded delistings</dt>
									<dd class="mt-1 text-lg font-semibold text-danger-strong">
										{filteredDelistings.length}
									</dd>
								</div>
							</dl>
						{/if}
						<p class="mt-3 text-sm leading-6 text-muted">
							{#if isMovementDataAvailable}
								The chart groups movement by origin. Expand to scan the named lots without the main
								page becoming a full-width table wall.
							{:else}
								Counts are unavailable for this window, so this preview only describes the named
								rows currently loaded.
							{/if}
						</p>
					</div>
				</div>

				<div class="mt-6 grid grid-cols-1 gap-6 border-t border-line pt-4 lg:grid-cols-2">
					<div>
						<h3 class="mb-3 text-sm font-semibold text-success-strong">
							New arrivals ({filteredArrivals.length})
						</h3>
						<div class="overflow-x-auto">
							<table class="min-w-full text-sm">
								<thead>
									<tr class="border-b border-line">
										<th class="pb-2 pr-3 text-left text-xs font-semibold text-muted">Bean</th>
										<th class="pb-2 pr-3 text-left text-xs font-semibold text-muted">Origin</th>
										<th class="pb-2 pr-3 text-right text-xs font-semibold text-muted">$/lb</th>
										<th class="pb-2 text-left text-xs font-semibold text-muted">Supplier</th>
									</tr>
								</thead>
								<tbody>
									{#each filteredArrivals as bean}
										<tr class="border-b border-line/40 hover:bg-success-subtle">
											<td class="py-2 pr-3 font-medium text-ink">{bean.name}</td>
											<td class="py-2 pr-3 text-muted">{bean.country ?? '—'}</td>
											<td class="py-2 pr-3 text-right text-ink"
												>{bean.price_per_lb != null ? '$' + bean.price_per_lb.toFixed(2) : '—'}</td
											>
											<td class="py-2 text-muted">{bean.source ?? '—'}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
					<div>
						<h3 class="mb-3 text-sm font-semibold text-danger-strong">
							Recent delistings ({filteredDelistings.length})
						</h3>
						<div class="overflow-x-auto">
							<table class="min-w-full text-sm">
								<thead>
									<tr class="border-b border-line">
										<th class="pb-2 pr-3 text-left text-xs font-semibold text-muted">Bean</th>
										<th class="pb-2 pr-3 text-left text-xs font-semibold text-muted">Origin</th>
										<th class="pb-2 pr-3 text-right text-xs font-semibold text-muted">Last $/lb</th>
										<th class="pb-2 text-left text-xs font-semibold text-muted">Supplier</th>
									</tr>
								</thead>
								<tbody>
									{#each filteredDelistings as bean}
										<tr class="border-b border-line/40 hover:bg-danger-subtle">
											<td class="py-2 pr-3 font-medium text-ink">{bean.name}</td>
											<td class="py-2 pr-3 text-muted">{bean.country ?? '—'}</td>
											<td class="py-2 pr-3 text-right text-ink"
												>{bean.price_per_lb != null ? '$' + bean.price_per_lb.toFixed(2) : '—'}</td
											>
											<td class="py-2 text-muted">{bean.source ?? '—'}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			</div>
		</ExpandablePanel>

		<ExpandablePanel
			title="Supplier catalog health"
			subtitle="Catalog breadth, coverage, and pricing for suppliers active in the {viewModeLabel} scope."
			totalItems={scopedSupplierHealth.length}
		>
			<AnalyticsLoadingPanel
				ready={Boolean(SupplierHealthTableComponent)}
				title="Supplier catalog health"
				description="Loading supplier catalog health views."
				height="h-64"
				panelClass="border-line"
				errorMessage={memberVisualsError}
				{onRetry}
			>
				{#if SupplierHealthTableComponent}
					<div class="rounded-lg border border-line bg-surface-canvas p-6 shadow-sm">
						<SupplierHealthTableComponent rows={scopedSupplierHealth} />
					</div>
				{/if}
			</AnalyticsLoadingPanel>
		</ExpandablePanel>

		<ExpandablePanel
			title="Origin benchmarks"
			subtitle="Origin-level pricing benchmarks and longer-term trend context."
			totalItems={originBarData.length}
		>
			<div class="rounded-lg border border-accent/20 bg-surface-canvas p-6 shadow-sm">
				{#if hasSnapshots}
					<div class="overflow-x-auto">
						<table class="min-w-full text-sm">
							<thead>
								<tr class="border-b border-line">
									<th class="py-2 pr-4 text-left font-semibold text-muted">Origin</th>
									<th class="py-2 pr-4 text-right font-semibold text-muted">Avg $/lb</th>
									<th class="py-2 pr-4 text-right font-semibold text-muted">Min</th>
									<th class="py-2 pr-4 text-right font-semibold text-muted">Max</th>
									<th class="py-2 text-right font-semibold text-muted">Suppliers</th>
								</tr>
							</thead>
							<tbody>
								{#each originBarData as row}
									<tr class="border-b border-line/50 hover:bg-surface-panel">
										<td class="py-2 pr-4 font-medium text-ink">{row.origin}</td>
										<td class="py-2 pr-4 text-right font-semibold text-ink"
											>${row.price_avg.toFixed(2)}</td
										>
										<td class="py-2 pr-4 text-right text-muted"
											>{row.price_min?.toFixed(2) ?? '—'}</td
										>
										<td class="py-2 pr-4 text-right text-muted"
											>{row.price_max?.toFixed(2) ?? '—'}</td
										>
										<td class="py-2 text-right text-muted">{row.supplier_count}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{:else}
					<div class="flex h-24 items-center justify-center rounded-lg bg-surface-panel">
						<p class="text-sm text-muted">Awaiting first price snapshot (today's scraper run).</p>
					</div>
				{/if}
			</div>
		</ExpandablePanel>

		<AnalyticsLoadingPanel
			ready={Boolean(PriceTierChartComponent)}
			title="Price spread analysis"
			description="Loading the latest origin price spread analysis."
			height="h-64"
			panelClass="border-accent/20"
			errorMessage={memberVisualsError}
			{onRetry}
		>
			<div class="rounded-lg border border-accent/20 bg-surface-canvas p-6 shadow-sm">
				<h2 class="mb-1 text-base font-semibold text-ink">Price spread analysis</h2>
				<p class="mb-4 text-sm text-muted">
					Retail versus wholesale median price by origin in the latest snapshot. This chart always
					shows both scopes so the spread stays comparable.
				</p>
				{#if PriceTierChartComponent}
					<PriceTierChartComponent {snapshots} />
				{/if}
			</div>
		</AnalyticsLoadingPanel>
	</div>
{/if}
