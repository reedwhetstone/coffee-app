<script lang="ts">
	import ExpandablePanel from '$lib/components/analytics/ExpandablePanel.svelte';
	import AnalyticsLoadingPanel from '$lib/components/analytics/AnalyticsLoadingPanel.svelte';
	import type { PriceSnapshot, ProcessBucket, OriginRangeRow } from '../../../../routes/analytics/+page.server';
	import type { DeferredAnalyticsComponent } from '../../../../routes/analytics/deferredModules';

	type TrendRange = '90d' | '6m' | '1y';
	type ViewMode = 'retail' | 'wholesale' | 'all';

	interface Props {
		OriginLineChartComponent: DeferredAnalyticsComponent | null;
		OriginBarChartComponent: DeferredAnalyticsComponent | null;
		ProcessDonutChartComponent: DeferredAnalyticsComponent | null;
		publicChartsError: string | null;
		/** All filtered (by viewMode) snapshots; this section applies its own date window. */
		filteredSnapshots: PriceSnapshot[];
		filteredProcessDist: ProcessBucket[];
		scopedOriginRangeData: OriginRangeRow[];
		displayStockedCount: number;
		viewMode: ViewMode;
		isParchmentIntelligence: boolean;
		onRetry: () => void;
	}

	const TREND_RANGE_OPTIONS: { value: TrendRange; label: string }[] = [
		{ value: '90d', label: '90 days' },
		{ value: '6m', label: '6 months' },
		{ value: '1y', label: '1 year' }
	];

	let {
		OriginLineChartComponent,
		OriginBarChartComponent,
		ProcessDonutChartComponent,
		publicChartsError,
		filteredSnapshots,
		filteredProcessDist,
		scopedOriginRangeData,
		displayStockedCount,
		viewMode,
		isParchmentIntelligence,
		onRetry
	}: Props = $props();

	let lineChartExpanded = $state(false);
	let originChartExpanded = $state(false);
	let trendRange = $state<TrendRange>('90d');

	let trendSnapshots = $derived.by((): PriceSnapshot[] => {
		const now = new Date();
		let daysBack: number;
		if (trendRange === '6m') daysBack = 183;
		else if (trendRange === '1y') daysBack = 365;
		else daysBack = 90;
		const cutoff = new Date(now);
		cutoff.setDate(cutoff.getDate() - daysBack);
		const cutoffStr = cutoff.toISOString().split('T')[0];
		return filteredSnapshots.filter((s) => s.snapshot_date >= cutoffStr);
	});

	let lineSnapshots = $derived(trendSnapshots.filter((s) => s.price_avg != null));
</script>

<section class="mb-8 space-y-6" aria-label="Evidence charts">
	<ExpandablePanel
		title="Origin price trends"
		subtitle="Average $/lb by top origins, ranked by market activity"
		collapsedMaxHeight="420px"
		showGradient={false}
		onExpandChange={(v) => (lineChartExpanded = v)}
	>
		<AnalyticsLoadingPanel
			ready={Boolean(OriginLineChartComponent)}
			title="Origin price trends"
			description="Loading origin price history."
			height={lineChartExpanded ? 'h-[60vh]' : 'h-64'}
			errorMessage={publicChartsError}
			onRetry={onRetry}
		>
			<div class="rounded-lg border border-border-light bg-background-primary-light p-6 shadow-sm">
				<h2 class="mb-1 text-xl font-semibold text-text-primary-light">Origin price trends</h2>
				<p class="mb-3 text-sm text-text-secondary-light">
					Average $/lb by top origins, ranked by market activity
					{#if viewMode === 'retail'}(retail){:else if viewMode === 'wholesale'}(wholesale){:else}(all){/if}
				</p>
				<div class="mb-4 flex items-center gap-2">
					<span class="text-xs font-medium text-text-secondary-light">Range:</span>
					<div
						class="flex rounded-full border border-border-light bg-background-secondary-light p-0.5 shadow-sm"
					>
						{#each TREND_RANGE_OPTIONS as opt}
							{@const locked = opt.value !== '90d' && !isParchmentIntelligence}
							<button
								onclick={() => {
									if (!locked) trendRange = opt.value;
								}}
								disabled={locked}
								title={locked ? 'Longer horizons require Parchment Intelligence' : undefined}
								class="rounded-full px-3 py-1 text-xs font-medium transition-all duration-150
									{trendRange === opt.value
									? 'bg-background-tertiary-light text-white shadow-sm'
									: locked
										? 'cursor-not-allowed text-text-secondary-light/50'
										: 'text-text-secondary-light hover:text-text-primary-light'}"
							>
								{opt.label}{locked ? ' 🔒' : ''}
							</button>
						{/each}
					</div>
				</div>
				<div class={lineChartExpanded ? 'h-[60vh] w-full' : 'h-64 w-full'}>
					{#if OriginLineChartComponent}
						<OriginLineChartComponent
							snapshots={lineSnapshots}
							expanded={lineChartExpanded}
							mode="price"
						/>
					{/if}
				</div>
			</div>
		</AnalyticsLoadingPanel>
	</ExpandablePanel>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
		<ExpandablePanel
			title="Processing mix"
			subtitle="How current listings break down by processing style"
			collapsedMaxHeight="360px"
			showGradient={false}
		>
			<AnalyticsLoadingPanel
				ready={Boolean(ProcessDonutChartComponent)}
				title="Processing mix"
				description="Loading stocked catalog processing distribution."
				height="h-56"
				errorMessage={publicChartsError}
				onRetry={onRetry}
			>
				<div
					class="rounded-lg border border-border-light bg-background-primary-light p-6 shadow-sm"
				>
					<h2 class="mb-1 text-xl font-semibold text-text-primary-light">Processing mix</h2>
					<p class="mb-4 text-sm text-text-secondary-light">
						Distribution across {displayStockedCount.toLocaleString()} stocked beans
						{#if viewMode === 'retail'}(retail){:else if viewMode === 'wholesale'}(wholesale){:else}(all){/if}
					</p>
					{#if filteredProcessDist.length > 0}
						<div class="h-56 w-full">
							{#if ProcessDonutChartComponent}
								<ProcessDonutChartComponent data={filteredProcessDist} />
							{/if}
						</div>
					{:else}
						<div
							class="flex h-40 items-center justify-center rounded-lg bg-background-secondary-light"
						>
							<p class="text-sm text-text-secondary-light">No catalog data yet.</p>
						</div>
					{/if}
				</div>
			</AnalyticsLoadingPanel>
		</ExpandablePanel>

		<ExpandablePanel
			title="Origin price ranges"
			subtitle="Compare the pricing spread across top origins. Expand to choose the set you want to review."
			collapsedMaxHeight="460px"
			showGradient={false}
			onExpandChange={(v) => (originChartExpanded = v)}
		>
			<AnalyticsLoadingPanel
				ready={Boolean(OriginBarChartComponent)}
				title="Origin price ranges"
				description="Loading live origin price comparisons from the current catalog."
				height="h-[28rem]"
				errorMessage={publicChartsError}
				onRetry={onRetry}
			>
				<div
					class="rounded-lg border border-border-light bg-background-primary-light p-6 shadow-sm"
				>
					<h2 class="mb-1 text-xl font-semibold text-text-primary-light">Origin price ranges</h2>
					<p class="mb-4 text-sm text-text-secondary-light">
						See how current prices spread across origins in the live catalog. The default view
						highlights the busiest origins, and the expanded view lets you choose your comparison
						set.
					</p>
					{#if scopedOriginRangeData.length > 0}
						<div class="w-full">
							{#if OriginBarChartComponent}
								{#key viewMode}
									<OriginBarChartComponent
										data={scopedOriginRangeData}
										expanded={originChartExpanded}
									/>
								{/key}
							{/if}
						</div>
					{:else}
						<div
							class="flex h-40 flex-col items-center justify-center rounded-lg bg-background-secondary-light"
						>
							<p class="text-sm font-medium text-text-secondary-light">No origin data available</p>
							<p class="mt-1 text-xs text-text-secondary-light">
								Requires stocked beans with price_per_lb values in the catalog.
							</p>
						</div>
					{/if}
				</div>
			</AnalyticsLoadingPanel>
		</ExpandablePanel>
	</div>
</section>
