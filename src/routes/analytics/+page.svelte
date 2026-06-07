<script lang="ts">
	import type { PageData } from './$types';
	import type {
		PriceSnapshot,
		ProcessBucket,
		OriginRangeRow,
		MovementCounts,
		MovementWindowCounts,
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
		movementCounts,
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
			movementCounts: MovementCounts;
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

	function scopeMovementCount(counts: MovementWindowCounts): number {
		if (viewMode === 'retail') return counts.retail;
		if (viewMode === 'wholesale') return counts.wholesale;
		return counts.retail + counts.wholesale;
	}

	let scopedArrivalCount = $derived.by(() =>
		scopeMovementCount(
			windowMode === '7d' ? movementCounts.arrivals.sevenDay : movementCounts.arrivals.thirtyDay
		)
	);
	let scopedDelistingCount = $derived.by(() =>
		scopeMovementCount(
			windowMode === '7d' ? movementCounts.delistings.sevenDay : movementCounts.delistings.thirtyDay
		)
	);

	let scopedOriginRangeData = $derived.by(() =>
		originRangeData.filter((row) => row.market_scope === viewMode)
	);

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

	function movementWindowCutoff(cutoffDays: number) {
		const reference = stats.lastUpdated ? new Date(stats.lastUpdated + 'T00:00:00') : new Date();
		reference.setDate(reference.getDate() - cutoffDays);
		return reference;
	}

	let filteredArrivals = $derived.by(() => {
		const cutoff = movementWindowCutoff(windowMode === '7d' ? 7 : 30);
		return recentArrivals.filter((bean) => {
			if (viewMode === 'retail' && bean.wholesale) return false;
			if (viewMode === 'wholesale' && !bean.wholesale) return false;
			if (!bean.stocked_date) return false;
			return new Date(bean.stocked_date + 'T00:00:00') >= cutoff;
		});
	});

	let filteredDelistings = $derived.by(() => {
		const cutoff = movementWindowCutoff(windowMode === '7d' ? 7 : 30);
		return recentDelistings.filter((bean) => {
			if (viewMode === 'retail' && bean.wholesale) return false;
			if (viewMode === 'wholesale' && !bean.wholesale) return false;
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

	let latestSnapshotDate = $derived.by(() =>
		filteredSnapshots.reduce(
			(max, snapshot) => (snapshot.snapshot_date > max ? snapshot.snapshot_date : max),
			''
		)
	);

	let previousSnapshotDate = $derived.by(() => {
		const dates = Array.from(
			new Set(filteredSnapshots.map((snapshot) => snapshot.snapshot_date))
		).sort();
		return dates.length > 1 ? dates[dates.length - 2] : '';
	});

	let latestSnapshotRows = $derived.by(() =>
		latestSnapshotDate
			? filteredSnapshots.filter((snapshot) => snapshot.snapshot_date === latestSnapshotDate)
			: []
	);

	let previousSnapshotRows = $derived.by(() =>
		previousSnapshotDate
			? filteredSnapshots.filter((snapshot) => snapshot.snapshot_date === previousSnapshotDate)
			: []
	);

	function averageSnapshotPrice(rows: PriceSnapshot[]): number | null {
		const pricedRows = rows.filter((snapshot) => snapshot.price_avg != null);
		if (pricedRows.length === 0) return null;
		const weighted = pricedRows.reduce(
			(acc, snapshot) => {
				const weight = snapshot.sample_size || 1;
				return {
					sum: acc.sum + (snapshot.price_avg ?? 0) * weight,
					weight: acc.weight + weight
				};
			},
			{ sum: 0, weight: 0 }
		);
		return weighted.weight > 0 ? weighted.sum / weighted.weight : null;
	}

	let latestMarketAverage = $derived(averageSnapshotPrice(latestSnapshotRows));
	let previousMarketAverage = $derived(averageSnapshotPrice(previousSnapshotRows));
	let marketPriceDelta = $derived(
		latestMarketAverage != null && previousMarketAverage != null
			? latestMarketAverage - previousMarketAverage
			: null
	);
	let marketPriceDeltaPercent = $derived(
		marketPriceDelta != null && previousMarketAverage
			? (marketPriceDelta / previousMarketAverage) * 100
			: null
	);
	let latestCoverageCount = $derived(
		latestSnapshotRows.reduce((sum, snapshot) => sum + (snapshot.supplier_count ?? 0), 0)
	);
	let previousCoverageCount = $derived(
		previousSnapshotRows.reduce((sum, snapshot) => sum + (snapshot.supplier_count ?? 0), 0)
	);
	let supplierCoverageDelta = $derived(
		previousCoverageCount > 0 ? latestCoverageCount - previousCoverageCount : null
	);

	function formatMoney(value: number | null): string {
		return value == null ? 'N/A' : `$${value.toFixed(2)}`;
	}

	function formatSigned(value: number | null, precision = 0): string {
		if (value == null) return 'Baseline';
		if (Math.abs(value) < 0.01) return 'Flat';
		const sign = value > 0 ? '+' : '−';
		return `${sign}${Math.abs(value).toFixed(precision)}`;
	}

	let marketReadHeadline = $derived.by(() => {
		if (scopedArrivalCount > scopedDelistingCount) {
			return 'Supply is expanding faster than it is leaving the visible market.';
		}
		if (scopedDelistingCount > scopedArrivalCount) {
			return 'Availability is tightening in the current movement window.';
		}
		if (marketPriceDelta != null && Math.abs(marketPriceDelta) >= 0.05) {
			return marketPriceDelta > 0
				? 'Average visible prices are firming in the latest indexed snapshot.'
				: 'Average visible prices are easing in the latest indexed snapshot.';
		}
		return 'The current market read is stable, with breadth still visible across origins and suppliers.';
	});

	let marketReadDetail = $derived.by(() => {
		const movementWindow = windowMode === '7d' ? '7-day' : '30-day';
		const pricePhrase =
			marketPriceDelta == null
				? 'price movement needs another comparable snapshot'
				: `${formatSigned(marketPriceDelta, 2)}/lb (${formatSigned(marketPriceDeltaPercent, 1)}%) versus the prior comparable snapshot`;
		return `${movementWindow} movement: ${scopedArrivalCount} arrivals and ${scopedDelistingCount} delistings. ${displayStockedCount.toLocaleString()} active ${viewMode} listings are in scope; ${pricePhrase}.`;
	});

	let kpiCards = $derived.by(() => [
		{
			label: 'Price movement',
			value:
				marketPriceDelta == null
					? formatMoney(latestMarketAverage)
					: `${formatSigned(marketPriceDelta, 2)}/lb`,
			detail:
				marketPriceDeltaPercent == null
					? 'Latest indexed average'
					: `${formatSigned(marketPriceDeltaPercent, 1)}% from prior snapshot`,
			tone:
				marketPriceDelta == null || Math.abs(marketPriceDelta) < 0.01
					? 'neutral'
					: marketPriceDelta > 0
						? 'up'
						: 'down'
		},
		{
			label: 'New arrivals',
			value: scopedArrivalCount.toLocaleString(),
			detail: `${windowMode === '7d' ? '7' : '30'}-day stocked movement`,
			tone: 'up'
		},
		{
			label: 'Delistings',
			value: scopedDelistingCount.toLocaleString(),
			detail: `${windowMode === '7d' ? '7' : '30'}-day catalog removals`,
			tone: scopedDelistingCount > scopedArrivalCount ? 'alert' : 'neutral'
		},
		{
			label: 'Supplier coverage',
			value: stats.totalSuppliers.toLocaleString(),
			detail:
				supplierCoverageDelta == null
					? `${stats.originsCount} origins indexed`
					: `${formatSigned(supplierCoverageDelta)} supplier-origin positions`,
			tone: supplierCoverageDelta != null && supplierCoverageDelta < 0 ? 'alert' : 'neutral'
		}
	]);

	let insightCards = $derived.by(() => [
		{
			label: 'Availability read',
			title:
				scopedArrivalCount >= scopedDelistingCount
					? 'Fresh supply is leading current movement.'
					: 'Catalog exits deserve attention before the next buy window.',
			body: `${scopedArrivalCount} arrivals versus ${scopedDelistingCount} delistings in the selected ${windowMode === '7d' ? '7-day' : '30-day'} ${viewMode} scope. Use the gated movement tables for named lots and suppliers.`,
			evidence: `Evidence: ${stats.totalSuppliers} suppliers, latest index ${formatDate(stats.lastUpdated)}`
		},
		{
			label: 'Price posture',
			title:
				marketPriceDelta == null || Math.abs(marketPriceDelta) < 0.05
					? 'Treat price as range evidence, not a single market answer.'
					: marketPriceDelta > 0
						? 'Latest indexed prices are pressing higher.'
						: 'Latest indexed prices are creating selective value pockets.',
			body: `The latest ${viewMode} average is ${formatMoney(latestMarketAverage)}/lb. Origin ranges below show whether that movement is broad or concentrated.`,
			evidence: `Evidence: ${latestSnapshotRows.length || scopedOriginRangeData.length} origin rows in current scope`
		},
		{
			label: 'Coverage signal',
			title: 'Supplier breadth is the trust layer for every recommendation.',
			body: `${displayStockedCount.toLocaleString()} active listings span ${stats.originsCount} origins. Supplier comparison and health modules stay gated because that is where buyer leverage compounds.`,
			evidence: `Evidence: ${stats.totalBeansTracked.toLocaleString()} total tracked catalog records`
		}
	]);
</script>

<section
	class="mb-6 rounded-2xl border border-background-tertiary-light/20 bg-gradient-to-br from-background-primary-light via-background-primary-light to-background-secondary-light p-5 shadow-sm sm:p-6"
	aria-labelledby="market-read-heading"
>
	<div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
		<div>
			<p class="text-xs font-semibold uppercase tracking-[0.2em] text-background-tertiary-light">
				Market read
			</p>
			<h1
				id="market-read-heading"
				class="mt-2 text-3xl font-bold text-text-primary-light sm:text-4xl"
			>
				Parchment Market Index
			</h1>
			<h2
				class="mt-3 max-w-3xl text-xl font-semibold leading-7 text-text-primary-light sm:text-2xl"
			>
				{marketReadHeadline}
			</h2>
			<p class="mt-3 max-w-3xl text-base leading-7 text-text-secondary-light sm:text-lg">
				{marketReadDetail}
			</p>
			<p class="mt-3 text-sm text-text-secondary-light">
				{#if stats.lastUpdated}
					Last updated {formatDate(stats.lastUpdated)}.
				{:else}
					Data collection started March 21, 2026.
				{/if}
				Daily-normalized pricing, arrivals, and supplier movement across {stats.totalSuppliers}
				US importers.
			</p>
		</div>

		<aside
			class="rounded-xl border border-border-light bg-background-primary-light/90 p-4 shadow-sm"
			aria-label="Scope controls"
		>
			<div class="flex items-center justify-between gap-3">
				<div>
					<p class="text-xs font-semibold uppercase tracking-wide text-text-secondary-light">
						Scope controls
					</p>
					<p class="mt-1 text-sm text-text-secondary-light">
						Set the investigation lens before reading charts.
					</p>
				</div>
				<span
					class="rounded-full bg-background-tertiary-light/10 px-3 py-1 text-xs font-semibold text-background-tertiary-light"
				>
					{viewMode}
				</span>
			</div>

			<div class="mt-4 space-y-4">
				<div>
					<p class="mb-2 text-xs font-medium uppercase tracking-wide text-text-secondary-light">
						Market scope
					</p>
					<div
						class="flex flex-wrap rounded-full border border-border-light bg-background-secondary-light p-1 shadow-sm"
					>
						{#each VIEW_OPTIONS as opt}
							<button
								type="button"
								onclick={() => (viewMode = opt.value)}
								class="flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-150
								{viewMode === opt.value
									? 'bg-background-tertiary-light text-white shadow-sm'
									: 'text-text-secondary-light hover:text-text-primary-light'}"
							>
								{opt.label}
							</button>
						{/each}
					</div>
				</div>

				<div>
					<p class="mb-2 text-xs font-medium uppercase tracking-wide text-text-secondary-light">
						Movement window
					</p>
					<div
						class="flex rounded-full border border-border-light bg-background-secondary-light p-1 shadow-sm"
					>
						{#each [{ value: '7d', label: '7d' }, { value: '30d', label: '30d' }] as opt}
							<button
								type="button"
								onclick={() => (windowMode = opt.value as WindowMode)}
								class="flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-150 {windowMode ===
								opt.value
									? 'bg-background-tertiary-light text-white shadow-sm'
									: 'text-text-secondary-light hover:text-text-primary-light'}"
							>
								{opt.label}
							</button>
						{/each}
					</div>
				</div>
			</div>
		</aside>
	</div>
</section>

<section class="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Market KPI strip">
	{#each kpiCards as card}
		<div class="rounded-xl border border-border-light bg-background-primary-light p-4 shadow-sm">
			<p class="text-xs font-semibold uppercase tracking-wide text-text-secondary-light">
				{card.label}
			</p>
			<div
				class="mt-2 text-2xl font-bold {card.tone === 'up'
					? 'text-emerald-700'
					: card.tone === 'down'
						? 'text-background-tertiary-light'
						: card.tone === 'alert'
							? 'text-red-700'
							: 'text-text-primary-light'}"
			>
				{card.value}
			</div>
			<p class="mt-1 text-xs text-text-secondary-light">{card.detail}</p>
		</div>
	{/each}
</section>

<section class="mb-6 grid gap-4 lg:grid-cols-3" aria-label="Market insight cards">
	{#each insightCards as insight}
		<article
			class="rounded-xl border border-border-light bg-background-primary-light p-5 shadow-sm"
		>
			<p class="text-xs font-semibold uppercase tracking-wide text-background-tertiary-light">
				{insight.label}
			</p>
			<h2 class="mt-2 text-lg font-semibold text-text-primary-light">{insight.title}</h2>
			<p class="mt-2 text-sm leading-6 text-text-secondary-light">{insight.body}</p>
			<p class="mt-4 text-xs font-medium text-text-secondary-light">{insight.evidence}</p>
		</article>
	{/each}
</section>

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

<section class="mb-8 space-y-6" aria-label="Evidence charts">
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
					{#if scopedOriginRangeData.length > 0}
						<div class="w-full">
							{#if OriginBarChartComponent}
								<OriginBarChartComponent
									data={scopedOriginRangeData}
									expanded={originChartExpanded}
								/>
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

<section
	class="mb-6 rounded-xl border border-background-tertiary-light/20 bg-background-secondary-light p-5"
	aria-label="Action rail"
>
	<div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
		<div>
			<p class="text-xs font-semibold uppercase tracking-wide text-background-tertiary-light">
				Next investigation
			</p>
			<h2 class="mt-1 text-lg font-semibold text-text-primary-light">
				Turn the read into a sourcing path.
			</h2>
			<p class="mt-1 text-sm text-text-secondary-light">
				This rail only links to existing surfaces. Watchlists, alerts, saved briefs, and persistent
				actions stay out of this PR.
			</p>
		</div>
		<div class="flex flex-col gap-2 sm:flex-row lg:flex-col">
			<button
				type="button"
				onclick={() => goto('/catalog')}
				class="rounded-md bg-background-tertiary-light px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-opacity-90"
			>
				Open catalog evidence
			</button>
			<button
				type="button"
				onclick={() => goto('/api')}
				class="rounded-md border border-background-tertiary-light px-4 py-2 text-sm font-semibold text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white"
			>
				Review API access
			</button>
		</div>
	</div>
</section>

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
					badge={`+${scopedArrivalCount}`}
					badgeColor="amber"
					totalItems={scopedArrivalCount}
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
					badge={`-${scopedDelistingCount}`}
					badgeColor="red"
					totalItems={scopedDelistingCount}
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
	{stats.totalSuppliers} US green coffee importers and roasters. The Parchment Market Index updates each
	morning, and origin plus processing details come directly from supplier listings.
</div>
