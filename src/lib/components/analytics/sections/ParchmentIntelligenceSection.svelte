<script lang="ts">
	import { goto } from '$app/navigation';
	import ExpandablePanel from '$lib/components/analytics/ExpandablePanel.svelte';
	import AnalyticsLoadingPanel from '$lib/components/analytics/AnalyticsLoadingPanel.svelte';
	import type {
		PriceSnapshot,
		ArrivalBean,
		DelistingBean,
		ComparisonBean,
		SupplierHealthRow
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
		scopedSupplierHealth: SupplierHealthRow[];
		filteredArrivals: ArrivalBean[];
		filteredDelistings: DelistingBean[];
		originBarData: OriginBenchmarkRow[];
		hasSnapshots: boolean;
		windowMode: WindowMode;
		viewModeLabel: string;
		arrivalPanelBadge: string | undefined;
		arrivalPanelTotalItems: number;
		arrivalExpandLabel: string | undefined;
		delistingPanelBadge: string | undefined;
		delistingPanelTotalItems: number;
		delistingExpandLabel: string | undefined;
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
		scopedSupplierHealth,
		filteredArrivals,
		filteredDelistings,
		originBarData,
		hasSnapshots,
		windowMode,
		viewModeLabel,
		arrivalPanelBadge,
		arrivalPanelTotalItems,
		arrivalExpandLabel,
		delistingPanelBadge,
		delistingPanelTotalItems,
		delistingExpandLabel,
		onRetry,
		onWindowModeChange
	}: Props = $props();
</script>

<div class="relative mb-8">
	{#if !isParchmentIntelligence}
		<div class="pointer-events-none select-none">
			<div class="mb-8 blur-sm filter">
				<div class="mb-3">
					<h2 class="text-xl font-semibold text-text-primary-light">Supplier Price Comparison</h2>
					<p class="mt-1 text-sm text-text-secondary-light">
						Everyone can explore the core market view. Parchment Intelligence adds deeper supplier
						comparisons.
					</p>
				</div>
				<div
					class="rounded-lg border border-border-light bg-background-primary-light p-6 shadow-sm"
				>
					<div class="space-y-2">
						{#each Array(6) as _}
							<div class="flex items-center gap-3 border-b border-border-light/40 py-2">
								<div class="h-4 w-28 rounded bg-background-secondary-light"></div>
								<div class="h-4 w-16 rounded bg-background-secondary-light"></div>
								<div class="h-4 w-20 rounded bg-background-secondary-light"></div>
								<div class="ml-auto h-4 w-14 rounded bg-background-secondary-light"></div>
							</div>
						{/each}
					</div>
				</div>
			</div>

			<div class="mb-8 blur-sm filter">
				<div class="mb-3">
					<h2 class="text-xl font-semibold text-text-primary-light">Supplier Catalog Health</h2>
					<p class="mt-1 text-sm text-text-secondary-light">
						Catalog breadth, origin coverage, and supplier signals for deeper sourcing review.
					</p>
				</div>
				<div
					class="rounded-lg border border-border-light bg-background-primary-light p-6 shadow-sm"
				>
					<div class="space-y-2">
						{#each Array(6) as _}
							<div class="flex items-center gap-3 border-b border-border-light/40 py-2">
								<div class="h-4 w-24 rounded bg-background-secondary-light"></div>
								<div class="h-4 w-12 rounded bg-background-secondary-light"></div>
								<div class="h-4 w-16 rounded bg-background-secondary-light"></div>
								<div class="ml-auto h-4 w-14 rounded bg-background-secondary-light"></div>
							</div>
						{/each}
					</div>
				</div>
			</div>

			<div class="mb-8 blur-sm filter">
				<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
					<div class="rounded-lg border border-amber-200 bg-background-primary-light p-6 shadow-sm">
						<div class="mb-3 flex items-center gap-2">
							<span class="text-sm font-semibold text-background-tertiary-light"
								>Parchment Intelligence</span
							>
						</div>
						<div class="mb-4 flex items-center justify-between gap-3">
							<p class="text-sm text-text-secondary-light">
								New coffees added in the last {windowMode === '7d' ? '7' : '30'} days.
							</p>
							<div
								class="flex rounded-full border border-amber-200 bg-amber-50 p-0.5 text-xs font-medium"
							>
								{#each [{ value: '7d', label: '7d' }, { value: '30d', label: '30d' }] as opt}
									<button
										onclick={() => onWindowModeChange(opt.value as WindowMode)}
										class="rounded-full px-3 py-1 transition-all duration-150 {windowMode ===
										opt.value
											? 'bg-amber-200 text-amber-900 shadow-sm'
											: 'text-amber-900/70 hover:text-amber-900'}"
									>
										{opt.label}
									</button>
								{/each}
							</div>
						</div>
						<h2 class="text-xl font-semibold text-text-primary-light">New Arrivals</h2>
						<p class="mt-1 text-sm text-text-secondary-light">
							Expanded monitoring for newly added coffees across suppliers.
						</p>
						<div class="mt-3 space-y-2">
							{#each Array(4) as _}
								<div class="flex items-center gap-3 border-b border-border-light/40 py-2">
									<div class="h-4 w-32 rounded bg-background-secondary-light"></div>
									<div class="h-4 w-16 rounded bg-background-secondary-light"></div>
									<div class="ml-auto h-4 w-12 rounded bg-amber-100"></div>
								</div>
							{/each}
						</div>
					</div>
					<div class="rounded-lg border border-red-200 bg-background-primary-light p-6 shadow-sm">
						<div class="mb-3 flex items-center gap-2">
							<span class="text-sm font-semibold text-background-tertiary-light"
								>Parchment Intelligence</span
							>
						</div>
						<div class="mb-4 flex items-center justify-between gap-3">
							<p class="text-sm text-text-secondary-light">
								Coffees removed in the last {windowMode === '7d' ? '7' : '30'} days.
							</p>
							<div
								class="flex rounded-full border border-red-200 bg-red-50 p-0.5 text-xs font-medium"
							>
								{#each [{ value: '7d', label: '7d' }, { value: '30d', label: '30d' }] as opt}
									<button
										onclick={() => onWindowModeChange(opt.value as WindowMode)}
										class="rounded-full px-3 py-1 transition-all duration-150 {windowMode ===
										opt.value
											? 'bg-red-200 text-red-900 shadow-sm'
											: 'text-red-900/70 hover:text-red-900'}"
									>
										{opt.label}
									</button>
								{/each}
							</div>
						</div>
						<h2 class="text-xl font-semibold text-text-primary-light">Recent Delistings</h2>
						<p class="mt-1 text-sm text-text-secondary-light">
							Expanded monitoring for catalog removals and turnover.
						</p>
						<div class="mt-3 space-y-2">
							{#each Array(4) as _}
								<div class="flex items-center gap-3 border-b border-border-light/40 py-2">
									<div class="h-4 w-32 rounded bg-background-secondary-light"></div>
									<div class="h-4 w-16 rounded bg-background-secondary-light"></div>
									<div class="ml-auto h-4 w-12 rounded bg-red-100"></div>
								</div>
							{/each}
						</div>
					</div>
				</div>
			</div>

			<div class="blur-sm filter">
				<div class="mb-3">
					<h2 class="text-xl font-semibold text-text-primary-light">
						Parchment Intelligence overview
					</h2>
					<p class="mt-1 text-sm text-text-secondary-light">
						Deeper market visibility for sourcing, purchasing, and supplier benchmarking in one
						place.
					</p>
				</div>
				<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
					<div
						class="rounded-lg border border-border-light bg-background-primary-light p-6 shadow-sm"
					>
						<h3 class="mb-2 text-lg font-semibold text-text-primary-light">Origin benchmarks</h3>
						<div class="grid grid-cols-3 gap-3">
							{#each Array(9) as _}
								<div class="rounded bg-background-secondary-light p-3">
									<div class="h-4 w-3/4 rounded bg-background-tertiary-light/30"></div>
									<div class="mt-2 h-6 w-1/2 rounded bg-background-tertiary-light/20"></div>
								</div>
							{/each}
						</div>
					</div>
					<div
						class="rounded-lg border border-border-light bg-background-primary-light p-6 shadow-sm"
					>
						<h3 class="mb-2 text-lg font-semibold text-text-primary-light">
							Longer-term trend detail
						</h3>
						<div class="mt-4 h-40 rounded bg-background-secondary-light"></div>
					</div>
				</div>
			</div>
		</div>

		<div
			class="absolute inset-0 flex flex-col items-center justify-center rounded-lg bg-gradient-to-b from-background-primary-light/60 to-background-primary-light"
		>
			<div
				class="mx-4 max-w-xl rounded-xl border border-background-tertiary-light/30 bg-background-primary-light p-8 text-center shadow-lg"
			>
				<div class="mb-3 text-3xl">📈</div>
				<h3 class="mb-2 text-2xl font-bold text-text-primary-light">
					Source with the full market in view.
				</h3>
				<p class="mb-4 text-text-secondary-light">
					Supplier comparisons, arrival and delisting feeds, origin benchmarks, and the weekly
					procurement brief. Built for sourcing pros making real buying decisions.
				</p>
				<ul class="mb-6 space-y-2 text-sm text-text-secondary-light">
					<li>Compare 40+ importers on price, coverage, and freshness</li>
					<li>Track new arrivals the day they stock</li>
					<li>Catch delistings before your next order closes</li>
					<li>Origin-level benchmarks with 6-month and 1-year depth</li>
				</ul>
				<div class="flex flex-col gap-3 sm:flex-row sm:justify-center">
					<button
						onclick={() => goto('/subscription?plan=intelligence-monthly&intent=checkout')}
						class="rounded-md bg-background-tertiary-light px-8 py-3 font-semibold text-white transition-all duration-200 hover:bg-opacity-90"
					>
						Start Intelligence
					</button>
					{#if !session}
						<button
							onclick={() => goto('/subscription')}
							class="rounded-md border border-background-tertiary-light px-8 py-3 font-semibold text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white"
						>
							See free market view
						</button>
					{/if}
				</div>
			</div>
		</div>
	{:else}
		<div id="supplier-comparison" class="space-y-6">
			<ExpandablePanel
				title="Supplier price comparison"
				subtitle="Compare current supplier pricing for a selected origin in the {viewModeLabel} scope."
				totalItems={scopedComparisonBeans.length}
			>
				<AnalyticsLoadingPanel
					ready={Boolean(SupplierComparisonTableComponent)}
					title="Supplier price comparison"
					description="Loading supplier comparison tools."
					height="h-64"
					panelClass="border-border-light"
					errorMessage={memberVisualsError}
					{onRetry}
				>
					{#if SupplierComparisonTableComponent}
						<SupplierComparisonTableComponent beans={scopedComparisonBeans} />
					{/if}
				</AnalyticsLoadingPanel>
			</ExpandablePanel>

			<ExpandablePanel
				title="Supplier catalog health"
				subtitle="Review catalog breadth, coverage, and pricing for suppliers active in the {viewModeLabel} scope."
				totalItems={scopedSupplierHealth.length}
			>
				<AnalyticsLoadingPanel
					ready={Boolean(SupplierHealthTableComponent)}
					title="Supplier catalog health"
					description="Loading supplier catalog health views."
					height="h-64"
					panelClass="border-border-light"
					errorMessage={memberVisualsError}
					{onRetry}
				>
					{#if SupplierHealthTableComponent}
						<div
							class="rounded-lg border border-border-light bg-background-primary-light p-6 shadow-sm"
						>
							<SupplierHealthTableComponent rows={scopedSupplierHealth} />
						</div>
					{/if}
				</AnalyticsLoadingPanel>
			</ExpandablePanel>

			<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<ExpandablePanel
					title="New arrivals"
					badge={arrivalPanelBadge}
					badgeColor="amber"
					totalItems={arrivalPanelTotalItems}
					expandLabel={arrivalExpandLabel}
				>
					<div class="rounded-lg border border-amber-200 bg-background-primary-light p-6 shadow-sm">
						<div class="mb-4 flex items-center justify-between gap-3">
							<p class="text-sm text-text-secondary-light">
								New coffees added in the last {windowMode === '7d' ? '7' : '30'} days.
							</p>
							<div
								class="flex rounded-full border border-amber-200 bg-amber-50 p-0.5 text-xs font-medium"
							>
								{#each [{ value: '7d', label: '7d' }, { value: '30d', label: '30d' }] as opt}
									<button
										onclick={() => onWindowModeChange(opt.value as WindowMode)}
										class="rounded-full px-3 py-1 transition-all duration-150 {windowMode ===
										opt.value
											? 'bg-amber-200 text-amber-900 shadow-sm'
											: 'text-amber-900/70 hover:text-amber-900'}"
									>
										{opt.label}
									</button>
								{/each}
							</div>
						</div>
						<div class="overflow-x-auto">
							<table class="min-w-full text-sm">
								<thead>
									<tr class="border-b border-border-light">
										<th class="pb-2 pr-3 text-left text-xs font-semibold text-text-secondary-light"
											>Bean</th
										>
										<th class="pb-2 pr-3 text-left text-xs font-semibold text-text-secondary-light"
											>Origin</th
										>
										<th class="pb-2 pr-3 text-right text-xs font-semibold text-text-secondary-light"
											>$/lb</th
										>
										<th class="pb-2 text-left text-xs font-semibold text-text-secondary-light"
											>Supplier</th
										>
									</tr>
								</thead>
								<tbody>
									{#each filteredArrivals as bean}
										<tr class="border-b border-border-light/40 hover:bg-amber-50">
											<td class="py-2 pr-3 font-medium text-text-primary-light">{bean.name}</td>
											<td class="py-2 pr-3 text-text-secondary-light">{bean.country ?? '—'}</td>
											<td class="py-2 pr-3 text-right text-text-primary-light"
												>{bean.price_per_lb != null ? '$' + bean.price_per_lb.toFixed(2) : '—'}</td
											>
											<td class="py-2 text-text-secondary-light">{bean.source ?? '—'}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
				</ExpandablePanel>

				<ExpandablePanel
					title="Recent Delistings"
					badge={delistingPanelBadge}
					badgeColor="red"
					totalItems={delistingPanelTotalItems}
					expandLabel={delistingExpandLabel}
				>
					<div class="rounded-lg border border-red-200 bg-background-primary-light p-6 shadow-sm">
						<div class="mb-4 flex items-center justify-between gap-3">
							<p class="text-sm text-text-secondary-light">
								Coffees removed in the last {windowMode === '7d' ? '7' : '30'} days.
							</p>
							<div
								class="flex rounded-full border border-red-200 bg-red-50 p-0.5 text-xs font-medium"
							>
								{#each [{ value: '7d', label: '7d' }, { value: '30d', label: '30d' }] as opt}
									<button
										onclick={() => onWindowModeChange(opt.value as WindowMode)}
										class="rounded-full px-3 py-1 transition-all duration-150 {windowMode ===
										opt.value
											? 'bg-red-200 text-red-900 shadow-sm'
											: 'text-red-900/70 hover:text-red-900'}"
									>
										{opt.label}
									</button>
								{/each}
							</div>
						</div>
						<div class="overflow-x-auto">
							<table class="min-w-full text-sm">
								<thead>
									<tr class="border-b border-border-light">
										<th class="pb-2 pr-3 text-left text-xs font-semibold text-text-secondary-light"
											>Bean</th
										>
										<th class="pb-2 pr-3 text-left text-xs font-semibold text-text-secondary-light"
											>Origin</th
										>
										<th class="pb-2 pr-3 text-right text-xs font-semibold text-text-secondary-light"
											>Last $/lb</th
										>
										<th class="pb-2 text-left text-xs font-semibold text-text-secondary-light"
											>Supplier</th
										>
									</tr>
								</thead>
								<tbody>
									{#each filteredDelistings as bean}
										<tr class="border-b border-border-light/40 hover:bg-red-50">
											<td class="py-2 pr-3 font-medium text-text-primary-light">{bean.name}</td>
											<td class="py-2 pr-3 text-text-secondary-light">{bean.country ?? '—'}</td>
											<td class="py-2 pr-3 text-right text-text-primary-light"
												>{bean.price_per_lb != null ? '$' + bean.price_per_lb.toFixed(2) : '—'}</td
											>
											<td class="py-2 text-text-secondary-light">{bean.source ?? '—'}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
				</ExpandablePanel>
			</div>

			<ExpandablePanel
				title="Origin benchmarks"
				subtitle="Origin-level pricing benchmarks and longer-term trend context."
				totalItems={originBarData.length}
			>
				<div
					class="rounded-lg border border-background-tertiary-light/20 bg-background-primary-light p-6 shadow-sm"
				>
					{#if hasSnapshots}
						<div class="overflow-x-auto">
							<table class="min-w-full text-sm">
								<thead>
									<tr class="border-b border-border-light">
										<th class="py-2 pr-4 text-left font-semibold text-text-secondary-light"
											>Origin</th
										>
										<th class="py-2 pr-4 text-right font-semibold text-text-secondary-light"
											>Avg $/lb</th
										>
										<th class="py-2 pr-4 text-right font-semibold text-text-secondary-light">Min</th
										>
										<th class="py-2 pr-4 text-right font-semibold text-text-secondary-light">Max</th
										>
										<th class="py-2 text-right font-semibold text-text-secondary-light"
											>Suppliers</th
										>
									</tr>
								</thead>
								<tbody>
									{#each originBarData as row}
										<tr class="border-b border-border-light/50 hover:bg-background-secondary-light">
											<td class="py-2 pr-4 font-medium text-text-primary-light">{row.origin}</td>
											<td class="py-2 pr-4 text-right font-semibold text-text-primary-light"
												>${row.price_avg.toFixed(2)}</td
											>
											<td class="py-2 pr-4 text-right text-text-secondary-light"
												>{row.price_min?.toFixed(2) ?? '—'}</td
											>
											<td class="py-2 pr-4 text-right text-text-secondary-light"
												>{row.price_max?.toFixed(2) ?? '—'}</td
											>
											<td class="py-2 text-right text-text-secondary-light">{row.supplier_count}</td
											>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{:else}
						<div
							class="flex h-24 items-center justify-center rounded-lg bg-background-secondary-light"
						>
							<p class="text-sm text-text-secondary-light">
								Awaiting first price snapshot (today's scraper run).
							</p>
						</div>
					{/if}
				</div>
			</ExpandablePanel>

			<AnalyticsLoadingPanel
				ready={Boolean(PriceTierChartComponent)}
				title="Price spread analysis"
				description="Loading the latest origin price spread analysis."
				height="h-64"
				panelClass="border-background-tertiary-light/20"
				errorMessage={memberVisualsError}
				{onRetry}
			>
				<div
					class="rounded-lg border border-background-tertiary-light/20 bg-background-primary-light p-6 shadow-sm"
				>
					<div class="mb-2 flex items-center gap-2">
						<span class="text-sm font-semibold text-background-tertiary-light"
							>Parchment Intelligence</span
						>
					</div>
					<h2 class="mb-1 text-xl font-semibold text-text-primary-light">Price spread analysis</h2>
					<p class="mb-4 text-sm text-text-secondary-light">
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
</div>
