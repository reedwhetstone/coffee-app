<script lang="ts">
	import type { PageData } from './$types';
	import type {
		PriceSnapshot,
		ProcessBucket,
		OriginRangeRow,
		ArrivalBean,
		DelistingBean,
		ComparisonBean,
		SupplierHealthRow
	} from './+page.server';
	import { goto } from '$app/navigation';
	import ExpandablePanel from '$lib/components/analytics/ExpandablePanel.svelte';
	import AnalyticsLoadingPanel from '$lib/components/analytics/AnalyticsLoadingPanel.svelte';
	import type { DeferredAnalyticsComponent } from './deferredModules';
	import {
		loadMemberAnalyticsModules,
		loadPublicAnalyticsModules,
		loadSupplierAnalyticsModules
	} from './deferredModules';

	let { data } = $props<{ data: PageData }>();

	let lineChartExpanded = $state(false);
	let originChartExpanded = $state(false);
	let OriginLineChartComponent = $state<DeferredAnalyticsComponent | null>(null);
	let OriginBarChartComponent = $state<DeferredAnalyticsComponent | null>(null);
	let ProcessDonutChartComponent = $state<DeferredAnalyticsComponent | null>(null);
	let PriceTierChartComponent = $state<DeferredAnalyticsComponent | null>(null);
	let SupplierComparisonTableComponent = $state<DeferredAnalyticsComponent | null>(null);
	let SupplierHealthTableComponent = $state<DeferredAnalyticsComponent | null>(null);
	let publicChartsLoading = $state(true);
	let memberVisualsLoading = $state(false);
	let publicChartsError = $state<string | null>(null);
	let memberVisualsError = $state<string | null>(null);
	let publicChartsRetryKey = $state(0);
	let memberVisualsRetryKey = $state(0);

	// Extended trend time range selector (Parchment Intelligence feature)
	type TrendRange = '90d' | '6m' | '1y';
	type WindowMode = '7d' | '30d';
	let trendRange = $state<TrendRange>('90d');
	let windowMode = $state<WindowMode>('7d');

	let {
		session,
		isParchmentIntelligence,
		stats,
		snapshots,
		processDistribution,
		originRangeData,
		recentArrivals,
		recentDelistings,
		comparisonBeans,
		supplierHealth
	} = $derived(
		data as {
			session: PageData['session'];
			isParchmentIntelligence: boolean;
			stats: {
				totalBeansTracked: number;
				stockedRetailBeans: number;
				stockedWholesaleBeans: number;
				totalSuppliers: number;
				originsCount: number;
				lastUpdated: string | null;
			};
			snapshots: PriceSnapshot[];
			processDistribution: ProcessBucket[];
			originRangeData: OriginRangeRow[];
			recentArrivals: ArrivalBean[];
			recentDelistings: DelistingBean[];
			comparisonBeans: ComparisonBean[];
			supplierHealth: SupplierHealthRow[];
		}
	);

	type ViewMode = 'retail' | 'wholesale' | 'all';
	let viewMode = $state<ViewMode>('retail');

	let filteredSnapshots = $derived.by(() => {
		if (viewMode === 'retail') return snapshots.filter((s) => !s.wholesale_only);
		if (viewMode === 'wholesale') return snapshots.filter((s) => s.wholesale_only);

		const merged = new Map<string, PriceSnapshot>();
		for (const s of snapshots) {
			const key = `${s.origin}|${s.snapshot_date}`;
			const existing = merged.get(key);
			if (!existing) {
				merged.set(key, { ...s, wholesale_only: false });
			} else {
				const w1 = existing.sample_size || 1;
				const w2 = s.sample_size || 1;
				const totalW = w1 + w2;
				const wavg = (a: number | null, b: number | null): number | null => {
					if (a == null && b == null) return null;
					if (a == null) return b;
					if (b == null) return a;
					return (a * w1 + b * w2) / totalW;
				};
				merged.set(key, {
					...existing,
					price_avg: wavg(existing.price_avg, s.price_avg),
					price_median: wavg(existing.price_median, s.price_median),
					price_min:
						existing.price_min != null && s.price_min != null
							? Math.min(existing.price_min, s.price_min)
							: (existing.price_min ?? s.price_min),
					price_max:
						existing.price_max != null && s.price_max != null
							? Math.max(existing.price_max, s.price_max)
							: (existing.price_max ?? s.price_max),
					price_p25: wavg(existing.price_p25, s.price_p25),
					price_p75: wavg(existing.price_p75, s.price_p75),
					supplier_count: existing.supplier_count + s.supplier_count,
					sample_size: totalW
				});
			}
		}
		return Array.from(merged.values()).sort(
			(a, b) => a.snapshot_date.localeCompare(b.snapshot_date) || a.origin.localeCompare(b.origin)
		);
	});

	let trendSnapshots = $derived.by((): PriceSnapshot[] => {
		const now = new Date();
		let daysBack: number;
		if (trendRange === '6m') daysBack = 183;
		else if (trendRange === '1y') daysBack = 365;
		else daysBack = 90;
		const cutoff = new Date(now);
		cutoff.setDate(cutoff.getDate() - daysBack);
		const cutoffStr = cutoff.toISOString().split('T')[0];
		return snapshots.filter((s) => s.snapshot_date >= cutoffStr && !s.wholesale_only);
	});

	let filteredProcessDist = $derived.by((): ProcessBucket[] => {
		if (viewMode === 'retail') return processDistribution.filter((b) => !b.wholesale);
		if (viewMode === 'wholesale') return processDistribution.filter((b) => b.wholesale);
		const merged = new Map<string, number>();
		for (const b of processDistribution) {
			merged.set(b.name, (merged.get(b.name) ?? 0) + b.count);
		}
		return Array.from(merged.entries())
			.sort((a, b) => b[1] - a[1])
			.map(([name, count]) => ({ name, count, wholesale: false }));
	});

	let displayStockedCount = $derived.by(() => {
		if (viewMode === 'retail') return stats.stockedRetailBeans;
		if (viewMode === 'wholesale') return stats.stockedWholesaleBeans;
		return stats.stockedRetailBeans + stats.stockedWholesaleBeans;
	});

	let originBarData = $derived.by(() => {
		if (!filteredSnapshots || filteredSnapshots.length === 0) return [];
		const latestDate = filteredSnapshots.reduce(
			(max, s) => (s.snapshot_date > max ? s.snapshot_date : max),
			''
		);
		const byOrigin = new Map<
			string,
			{ sum: number; count: number; suppliers: number; sample_size: number }
		>();
		for (const s of filteredSnapshots) {
			if (s.snapshot_date !== latestDate || s.price_avg == null) continue;
			const cur = byOrigin.get(s.origin) ?? { sum: 0, count: 0, suppliers: 0, sample_size: 0 };
			cur.sum += s.price_avg;
			cur.count += 1;
			cur.suppliers = Math.max(cur.suppliers, s.supplier_count);
			cur.sample_size += s.sample_size ?? 0;
			byOrigin.set(s.origin, cur);
		}
		return Array.from(byOrigin.entries()).map(([origin, v]) => ({
			origin,
			price_avg: Math.round((v.sum / v.count) * 100) / 100,
			supplier_count: v.suppliers,
			sample_size: v.sample_size
		}));
	});

	let lineSnapshots = $derived(filteredSnapshots.filter((s) => s.price_avg != null));
	let hasSnapshots = $derived(filteredSnapshots.length > 0);
	let stockedBeans = $derived(stats.stockedRetailBeans + stats.stockedWholesaleBeans);

	let filteredArrivals = $derived.by(() => {
		const cutoffDays = windowMode === '7d' ? 7 : 30;
		const cutoff = new Date();
		cutoff.setDate(cutoff.getDate() - cutoffDays);
		return recentArrivals.filter((bean) => {
			if (!bean.stocked_date) return false;
			return new Date(bean.stocked_date + 'T00:00:00') >= cutoff;
		});
	});

	let filteredDelistings = $derived.by(() => {
		const cutoffDays = windowMode === '7d' ? 7 : 30;
		const cutoff = new Date();
		cutoff.setDate(cutoff.getDate() - cutoffDays);
		return recentDelistings.filter((bean) => {
			if (!bean.unstocked_date) return false;
			return new Date(bean.unstocked_date + 'T00:00:00') >= cutoff;
		});
	});

	function formatDate(dateStr: string | null) {
		if (!dateStr) return 'N/A';
		return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function formatRelativeTime(dateStr: string | null): string {
		if (!dateStr) return 'Daily';
		const now = new Date();
		const todayStr = now.toISOString().split('T')[0];
		const yesterdayDate = new Date(now);
		yesterdayDate.setDate(yesterdayDate.getDate() - 1);
		const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

		if (dateStr === todayStr) {
			const updated = new Date(dateStr + 'T00:00:00');
			const hoursAgo = Math.floor((now.getTime() - updated.getTime()) / 3600000);
			if (hoursAgo < 1) return 'Just now';
			if (hoursAgo === 1) return '1h ago';
			return `${hoursAgo}h ago`;
		}
		if (dateStr === yesterdayStr) return 'Yesterday';
		return formatDate(dateStr);
	}

	const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
		{ value: 'retail', label: 'Retail' },
		{ value: 'wholesale', label: 'Wholesale' },
		{ value: 'all', label: 'All' }
	];

	function buildDeferredLoadError(section: string) {
		return `We couldn't load ${section} right now. Please retry.`;
	}

	function retryPublicCharts() {
		publicChartsError = null;
		publicChartsLoading = true;
		publicChartsRetryKey += 1;
	}

	function retryMemberVisuals() {
		memberVisualsError = null;
		memberVisualsLoading = true;
		memberVisualsRetryKey += 1;
	}

	$effect(() => {
		const retryKey = publicChartsRetryKey;
		void retryKey;

		if (OriginLineChartComponent && OriginBarChartComponent && ProcessDonutChartComponent) {
			publicChartsLoading = false;
			publicChartsError = null;
			return;
		}

		let cancelled = false;
		publicChartsLoading = true;
		publicChartsError = null;

		void loadPublicAnalyticsModules()
			.then(
				({
					OriginLineChartComponent: originLine,
					OriginBarChartComponent: originBar,
					ProcessDonutChartComponent: processDonut
				}) => {
					if (cancelled) return;
					OriginLineChartComponent = originLine;
					OriginBarChartComponent = originBar;
					ProcessDonutChartComponent = processDonut;
				}
			)
			.catch((error) => {
				if (cancelled) return;
				console.error('Failed to load analytics chart modules:', error);
				publicChartsError = buildDeferredLoadError('the overview charts');
			})
			.finally(() => {
				if (!cancelled) {
					publicChartsLoading = false;
				}
			});

		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		const memberEnabled = isParchmentIntelligence;
		const retryKey = memberVisualsRetryKey;
		void retryKey;

		if (!memberEnabled) {
			memberVisualsLoading = false;
			memberVisualsError = null;
			return;
		}

		if (
			PriceTierChartComponent &&
			SupplierComparisonTableComponent &&
			SupplierHealthTableComponent
		) {
			memberVisualsLoading = false;
			memberVisualsError = null;
			return;
		}

		let cancelled = false;
		memberVisualsLoading = true;
		memberVisualsError = null;

		void Promise.all([loadMemberAnalyticsModules(), loadSupplierAnalyticsModules()])
			.then(([memberModules, supplierModules]) => {
				if (cancelled) return;
				PriceTierChartComponent = memberModules.PriceTierChartComponent;
				SupplierComparisonTableComponent = supplierModules.SupplierComparisonTableComponent;
				SupplierHealthTableComponent = supplierModules.SupplierHealthTableComponent;
			})
			.catch((error) => {
				if (cancelled) return;
				console.error('Failed to load member analytics modules:', error);
				memberVisualsError = buildDeferredLoadError('the Parchment Intelligence modules');
			})
			.finally(() => {
				if (!cancelled) {
					memberVisualsLoading = false;
				}
			});

		return () => {
			cancelled = true;
		};
	});

	let analyticsShellMessage = $derived.by(() => {
		const pending: string[] = [];
		if (publicChartsLoading) pending.push('charts');
		if (isParchmentIntelligence && memberVisualsLoading)
			pending.push('Parchment Intelligence modules');
		if (pending.length === 0) return '';
		if (pending.length === 1) return pending[0];
		return `${pending.slice(0, -1).join(', ')} and ${pending.at(-1)}`;
	});
</script>

<div class="mb-8 border-l-4 border-background-tertiary-light pl-6">
	<h1 class="mb-2 text-4xl font-bold text-text-primary-light">Green coffee market visibility</h1>
	<p class="text-lg text-text-secondary-light">
		Track live pricing, supplier movement, and origin coverage across {stats.totalSuppliers} US suppliers
		and {stats.originsCount} origins.
		{#if stats.lastUpdated}
			Last updated {formatDate(stats.lastUpdated)}.
		{:else}
			Data collection started March 21, 2026.
		{/if}
	</p>
</div>

<div class="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
	<div
		class="rounded-lg border border-border-light bg-background-primary-light p-4 text-center shadow-sm"
	>
		<div class="text-3xl font-bold text-background-tertiary-light">{stats.totalSuppliers}</div>
		<div class="mt-1 text-sm text-text-secondary-light">Suppliers tracked</div>
	</div>
	<div
		class="rounded-lg border border-border-light bg-background-primary-light p-4 text-center shadow-sm"
	>
		<div class="text-3xl font-bold text-background-tertiary-light">
			{displayStockedCount.toLocaleString()}
		</div>
		<div class="mt-1 text-sm text-text-secondary-light">
			{#if viewMode === 'retail'}
				Stocked retail
			{:else if viewMode === 'wholesale'}
				Stocked wholesale
			{:else}
				Stocked beans
			{/if}
		</div>
		{#if viewMode === 'all'}
			<div class="mt-0.5 text-xs text-text-secondary-light/60">
				{stats.stockedRetailBeans.toLocaleString()} retail · {stats.stockedWholesaleBeans.toLocaleString()}
				wholesale
			</div>
		{:else}
			<div class="mt-0.5 text-xs text-text-secondary-light/60">
				{stats.totalBeansTracked.toLocaleString()} total tracked
			</div>
		{/if}
	</div>
	<div
		class="rounded-lg border border-border-light bg-background-primary-light p-4 text-center shadow-sm"
	>
		<div class="text-3xl font-bold text-background-tertiary-light">{stats.originsCount}</div>
		<div class="mt-1 text-sm text-text-secondary-light">Origins covered</div>
	</div>
	<div
		class="rounded-lg border border-border-light bg-background-primary-light p-4 text-center shadow-sm"
	>
		<div class="text-xl font-bold text-background-tertiary-light">
			{formatRelativeTime(stats.lastUpdated)}
		</div>
		<div class="mt-1 text-sm text-text-secondary-light">Last updated</div>
	</div>
</div>

<div class="mb-6 flex items-center gap-3">
	<span class="text-sm font-medium text-text-secondary-light">View:</span>
	<div
		class="flex rounded-full border border-border-light bg-background-secondary-light p-1 shadow-sm"
	>
		{#each VIEW_OPTIONS as opt}
			<button
				onclick={() => (viewMode = opt.value)}
				class="rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-150
				{viewMode === opt.value
					? 'bg-background-tertiary-light text-white shadow-sm'
					: 'text-text-secondary-light hover:text-text-primary-light'}"
			>
				{opt.label}
			</button>
		{/each}
	</div>
</div>

<div class="mb-6 rounded-lg border border-border-light bg-background-secondary-light px-5 py-3">
	<p class="text-sm font-medium text-text-primary-light">
		See daily market movement across <span class="text-background-tertiary-light"
			>{stats.totalSuppliers}</span
		>
		suppliers. <span class="text-background-tertiary-light">{stockedBeans.toLocaleString()}</span>
		active listings from <span class="text-background-tertiary-light">{stats.originsCount}</span> origins.
	</p>
</div>

{#if analyticsShellMessage}
	<div
		class="mb-6 rounded-lg border border-background-tertiary-light/20 bg-background-primary-light px-5 py-3 shadow-sm"
		aria-live="polite"
	>
		<div class="flex items-start gap-3">
			<span class="mt-1 h-2.5 w-2.5 animate-pulse rounded-full bg-background-tertiary-light"></span>
			<div>
				<p class="text-sm font-semibold text-text-primary-light">Loading market visuals</p>
				<p class="mt-1 text-xs text-text-secondary-light">
					The overview is ready first. {analyticsShellMessage} are loading next.
				</p>
			</div>
		</div>
	</div>
{/if}

<div class="mb-8 space-y-6">
	<ExpandablePanel
		title="Origin price trends"
		subtitle="Average $/lb by top origins over the last 30 days, ranked by market activity"
		collapsedMaxHeight="420px"
		showGradient={false}
		onExpandChange={(v) => (lineChartExpanded = v)}
	>
		<AnalyticsLoadingPanel
			ready={Boolean(OriginLineChartComponent)}
			title="Origin price trends"
			description="Loading 30-day origin price history."
			height={lineChartExpanded ? 'h-[60vh]' : 'h-64'}
			errorMessage={publicChartsError}
			onRetry={retryPublicCharts}
		>
			<div class="rounded-lg border border-border-light bg-background-primary-light p-6 shadow-sm">
				<h2 class="mb-1 text-xl font-semibold text-text-primary-light">Origin price trends</h2>
				<p class="mb-4 text-sm text-text-secondary-light">
					Average $/lb by top origins over the last 30 days, ranked by market activity
					{#if viewMode === 'retail'}(retail){:else if viewMode === 'wholesale'}(wholesale){:else}(all){/if}
				</p>
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
				onRetry={retryPublicCharts}
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
				onRetry={retryPublicCharts}
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
					{#if originRangeData.length > 0}
						<div class="w-full">
							{#if OriginBarChartComponent}
								<OriginBarChartComponent data={originRangeData} expanded={originChartExpanded} />
							{/if}
						</div>
					{:else}
						<div
							class="flex h-40 flex-col items-center justify-center rounded-lg bg-background-secondary-light"
						>
							<p class="text-sm font-medium text-text-secondary-light">
								📊 No origin data available
							</p>
							<p class="mt-1 text-xs text-text-secondary-light">
								Requires stocked beans with price_per_lb values in the catalog.
							</p>
						</div>
					{/if}
				</div>
			</AnalyticsLoadingPanel>
		</ExpandablePanel>
	</div>
</div>

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
							<span
								class="text-sm font-semibold uppercase tracking-wide text-background-tertiary-light"
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
										onclick={() => (windowMode = opt.value as WindowMode)}
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
							Expanded monitoring for newly added coffees across {stats.totalSuppliers} suppliers.
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
							<span
								class="text-sm font-semibold uppercase tracking-wide text-background-tertiary-light"
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
										onclick={() => (windowMode = opt.value as WindowMode)}
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
					Go deeper with Parchment Intelligence
				</h3>
				<p class="mb-4 text-text-secondary-light">
					The public view gives you the core market picture first. Upgrade when you need supplier
					comparisons, supplier health, arrivals, delistings, origin benchmarks, and longer-term
					trends.
				</p>
				<ul class="mb-6 space-y-2 text-sm text-text-secondary-light">
					<li>Supplier comparison and catalog health views</li>
					<li>Arrival and delisting tracking</li>
					<li>Origin benchmarks plus 6-month and 1-year trend views</li>
				</ul>
				<div class="flex flex-col gap-3 sm:flex-row sm:justify-center">
					<button
						onclick={() => goto('/subscription')}
						class="rounded-md bg-background-tertiary-light px-8 py-3 font-semibold text-white transition-all duration-200 hover:bg-opacity-90"
					>
						See plans
					</button>
					{#if !session}
						<button
							onclick={() => goto('/subscription')}
							class="rounded-md border border-background-tertiary-light px-8 py-3 font-semibold text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white"
						>
							Browse full catalog first
						</button>
					{/if}
				</div>
			</div>
		</div>
	{:else}
		<div class="space-y-6">
			<ExpandablePanel
				title="Supplier price comparison"
				subtitle="Compare current supplier pricing for a selected origin."
				totalItems={comparisonBeans.length}
			>
				<AnalyticsLoadingPanel
					ready={Boolean(SupplierComparisonTableComponent)}
					title="Supplier price comparison"
					description="Loading supplier comparison tools."
					height="h-64"
					panelClass="border-border-light"
					errorMessage={memberVisualsError}
					onRetry={retryMemberVisuals}
				>
					{#if SupplierComparisonTableComponent}
						<SupplierComparisonTableComponent beans={comparisonBeans} />
					{/if}
				</AnalyticsLoadingPanel>
			</ExpandablePanel>

			<ExpandablePanel
				title="Supplier catalog health"
				subtitle="Review catalog breadth, coverage, and pricing by supplier."
				totalItems={supplierHealth.length}
			>
				<AnalyticsLoadingPanel
					ready={Boolean(SupplierHealthTableComponent)}
					title="Supplier catalog health"
					description="Loading supplier catalog health views."
					height="h-64"
					panelClass="border-border-light"
					errorMessage={memberVisualsError}
					onRetry={retryMemberVisuals}
				>
					{#if SupplierHealthTableComponent}
						<div
							class="rounded-lg border border-border-light bg-background-primary-light p-6 shadow-sm"
						>
							<SupplierHealthTableComponent rows={supplierHealth} />
						</div>
					{/if}
				</AnalyticsLoadingPanel>
			</ExpandablePanel>

			<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<ExpandablePanel
					title="New arrivals"
					badge={`+${filteredArrivals.length}`}
					badgeColor="amber"
					totalItems={filteredArrivals.length}
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
										onclick={() => (windowMode = opt.value as WindowMode)}
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
										<th
											class="pb-2 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary-light"
											>Bean</th
										>
										<th
											class="pb-2 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary-light"
											>Origin</th
										>
										<th
											class="pb-2 pr-3 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary-light"
											>$/lb</th
										>
										<th
											class="pb-2 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary-light"
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
					badge={`-${filteredDelistings.length}`}
					badgeColor="red"
					totalItems={filteredDelistings.length}
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
										onclick={() => (windowMode = opt.value as WindowMode)}
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
										<th
											class="pb-2 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary-light"
											>Bean</th
										>
										<th
											class="pb-2 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary-light"
											>Origin</th
										>
										<th
											class="pb-2 pr-3 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary-light"
											>Last $/lb</th
										>
										<th
											class="pb-2 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary-light"
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
												>{filteredSnapshots
													.find((s) => s.origin === row.origin)
													?.price_min?.toFixed(2) ?? '—'}</td
											>
											<td class="py-2 pr-4 text-right text-text-secondary-light"
												>{filteredSnapshots
													.find((s) => s.origin === row.origin)
													?.price_max?.toFixed(2) ?? '—'}</td
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

			<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<AnalyticsLoadingPanel
					ready={Boolean(PriceTierChartComponent)}
					title="Price spread analysis"
					description="Loading the latest origin price spread analysis."
					height="h-64"
					panelClass="border-background-tertiary-light/20"
					errorMessage={memberVisualsError}
					onRetry={retryMemberVisuals}
				>
					<div
						class="rounded-lg border border-background-tertiary-light/20 bg-background-primary-light p-6 shadow-sm"
					>
						<div class="mb-2 flex items-center gap-2">
							<span
								class="text-sm font-semibold uppercase tracking-wide text-background-tertiary-light"
								>Parchment Intelligence</span
							>
						</div>
						<h2 class="mb-1 text-xl font-semibold text-text-primary-light">
							Price spread analysis
						</h2>
						<p class="mb-4 text-sm text-text-secondary-light">
							Retail versus wholesale median price by origin in the latest snapshot
						</p>
						{#if PriceTierChartComponent}
							<PriceTierChartComponent {snapshots} />
						{/if}
					</div>
				</AnalyticsLoadingPanel>

				<div
					class="rounded-lg border border-background-tertiary-light/20 bg-background-primary-light p-6 shadow-sm"
				>
					<div class="mb-2 flex items-center gap-2">
						<span
							class="text-sm font-semibold uppercase tracking-wide text-background-tertiary-light"
							>Parchment Intelligence</span
						>
					</div>
					<h2 class="mb-1 text-xl font-semibold text-text-primary-light">
						Longer-term trend detail
					</h2>
					<p class="mb-4 text-sm text-text-secondary-light">
						Price trends across longer time horizons for retail origins
					</p>
					<div class="mb-3 flex items-center gap-2">
						<span class="text-xs font-medium text-text-secondary-light">Range:</span>
						<div
							class="flex rounded-full border border-border-light bg-background-secondary-light p-0.5 shadow-sm"
						>
							{#each [{ value: '90d', label: '90 days' }, { value: '6m', label: '6 months' }, { value: '1y', label: '1 year' }] as opt}
								<button
									onclick={() => (trendRange = opt.value as TrendRange)}
									class="rounded-full px-3 py-1 text-xs font-medium transition-all duration-150
										{trendRange === opt.value
										? 'bg-background-tertiary-light text-white shadow-sm'
										: 'text-text-secondary-light hover:text-text-primary-light'}"
								>
									{opt.label}
								</button>
							{/each}
						</div>
					</div>
					<div class="h-64">
						{#if OriginLineChartComponent}
							<OriginLineChartComponent snapshots={trendSnapshots} mode="price" />
						{:else}
							<div class="h-full animate-pulse rounded-xl bg-background-secondary-light/80"></div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<div class="mt-4 rounded-lg bg-background-secondary-light p-4 text-xs text-text-secondary-light">
	<strong class="text-text-primary-light">Data source:</strong> Daily prices aggregated from
	{stats.totalSuppliers} US green coffee importers and roasters. The Purveyors Price Index updates each
	morning, and origin plus processing details come directly from supplier listings.
</div>
