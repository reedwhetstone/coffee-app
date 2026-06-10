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
		SupplierHealthRow,
		TrackedLotSummary
	} from './+page.server';
	import { goto } from '$app/navigation';
	import ExpandablePanel from '$lib/components/analytics/ExpandablePanel.svelte';
	import AnalyticsActionCta from '$lib/components/analytics/AnalyticsActionCta.svelte';
	import AnalyticsLoadingPanel from '$lib/components/analytics/AnalyticsLoadingPanel.svelte';
	import {
		buildAnalyticsChatHref,
		buildAnalyticsPageContextSummary,
		canUseAnalyticsChat,
		resolveAnalyticsEntitlement,
		type AnalyticsChatContext
	} from '$lib/analytics/actionContext';
	import { pageChatContext } from '$lib/stores/pageContextStore.svelte';
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
	const TREND_RANGE_OPTIONS: { value: TrendRange; label: string }[] = [
		{ value: '90d', label: '90 days' },
		{ value: '6m', label: '6 months' },
		{ value: '1y', label: '1 year' }
	];
	let windowMode = $state<WindowMode>('7d');

	let {
		session,
		role,
		isParchmentIntelligence,
		stats,
		snapshots,
		processDistribution,
		originRangeData,
		movementCounts,
		recentArrivals,
		recentDelistings,
		comparisonBeans,
		supplierHealth,
		trackedLots
	} = $derived(
		data as {
			session: PageData['session'];
			role: PageData['role'];
			isParchmentIntelligence: boolean;
			stats: {
				totalBeansTracked: number;
				stockedRetailBeans: number;
				stockedWholesaleBeans: number;
				stockedRetailOrigins: number;
				stockedWholesaleOrigins: number;
				stockedOrigins: number;
				stockedRetailSuppliers: number;
				stockedWholesaleSuppliers: number;
				stockedSuppliers: number;
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
			trackedLots: TrackedLotSummary[];
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
		// Follows the page-level market scope so the master controls flip this view too.
		return filteredSnapshots.filter((s) => s.snapshot_date >= cutoffStr);
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

	let displayOriginsCount = $derived.by(() => {
		if (viewMode === 'retail') return stats.stockedRetailOrigins;
		if (viewMode === 'wholesale') return stats.stockedWholesaleOrigins;
		return stats.stockedOrigins || stats.originsCount;
	});

	let displaySuppliersCount = $derived.by(() => {
		if (viewMode === 'retail') return stats.stockedRetailSuppliers;
		if (viewMode === 'wholesale') return stats.stockedWholesaleSuppliers;
		return stats.stockedSuppliers || stats.totalSuppliers;
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
			{
				sum: number;
				count: number;
				suppliers: number;
				sample_size: number;
				min: number | null;
				max: number | null;
			}
		>();
		for (const s of filteredSnapshots) {
			if (s.snapshot_date !== latestDate || s.price_avg == null) continue;
			const cur = byOrigin.get(s.origin) ?? {
				sum: 0,
				count: 0,
				suppliers: 0,
				sample_size: 0,
				min: null,
				max: null
			};
			cur.sum += s.price_avg;
			cur.count += 1;
			cur.suppliers = Math.max(cur.suppliers, s.supplier_count);
			cur.sample_size += s.sample_size ?? 0;
			// Snapshots are per origin+process; the table reports the origin-wide range.
			if (s.price_min != null)
				cur.min = cur.min == null ? s.price_min : Math.min(cur.min, s.price_min);
			if (s.price_max != null)
				cur.max = cur.max == null ? s.price_max : Math.max(cur.max, s.price_max);
			byOrigin.set(s.origin, cur);
		}
		return Array.from(byOrigin.entries()).map(([origin, v]) => ({
			origin,
			price_avg: Math.round((v.sum / v.count) * 100) / 100,
			supplier_count: v.suppliers,
			sample_size: v.sample_size,
			price_min: v.min,
			price_max: v.max
		}));
	});

	let lineSnapshots = $derived(trendSnapshots.filter((s) => s.price_avg != null));
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

	let isMovementDataAvailable = $derived.by(() => {
		if (!movementCounts.available || !stats.lastUpdated) return false;
		const updatedAt = new Date(`${stats.lastUpdated}T00:00:00.000Z`).getTime();
		const staleAfterMs = 90 * 24 * 60 * 60 * 1000;
		return Number.isFinite(updatedAt) && Date.now() - updatedAt <= staleAfterMs;
	});

	// Gated modules follow the page-level market scope so the top controls act as a master lens.
	let scopedComparisonBeans = $derived.by(() => {
		if (viewMode === 'retail') return comparisonBeans.filter((bean) => !bean.wholesale);
		if (viewMode === 'wholesale') return comparisonBeans.filter((bean) => bean.wholesale);
		return comparisonBeans;
	});

	let scopedSupplierHealth = $derived.by(() => {
		if (viewMode === 'retail') return supplierHealth.filter((row) => row.retailCount > 0);
		if (viewMode === 'wholesale') return supplierHealth.filter((row) => row.wholesaleCount > 0);
		return supplierHealth;
	});

	// Watchlist context scoped to the active market lens.
	let scopedTrackedLots = $derived.by(() => {
		const lots = trackedLots ?? [];
		if (viewMode === 'retail') return lots.filter((lot) => lot.wholesale !== true);
		if (viewMode === 'wholesale') return lots.filter((lot) => lot.wholesale === true);
		return lots;
	});
	let trackedDelistedCount = $derived(
		scopedTrackedLots.filter((lot) => lot.stocked === false).length
	);
	let trackedPriceMovers = $derived.by(() =>
		scopedTrackedLots
			.filter((lot) => lot.priceDelta !== null && Math.abs(lot.priceDelta) >= 0.05)
			.sort((a, b) => Math.abs(b.priceDelta ?? 0) - Math.abs(a.priceDelta ?? 0))
	);

	// Week-over-week per-origin price movement from the scoped index snapshots. Compares the
	// latest snapshot against the closest snapshot at least six days earlier.
	type OriginMover = { origin: string; latest: number; delta: number };
	let weeklyOriginMovement = $derived.by(
		(): { movers: OriginMover[]; baselineDate: string | null } => {
			const dates = Array.from(new Set(filteredSnapshots.map((s) => s.snapshot_date))).sort();
			if (dates.length < 2) return { movers: [], baselineDate: null };
			const latestDate = dates[dates.length - 1];
			const latestTime = new Date(`${latestDate}T00:00:00Z`).getTime();
			const weekAgoCandidates = dates.filter(
				(date) => latestTime - new Date(`${date}T00:00:00Z`).getTime() >= 6 * 24 * 60 * 60 * 1000
			);
			const baselineDate = weekAgoCandidates.length
				? weekAgoCandidates[weekAgoCandidates.length - 1]
				: dates[0];

			const latestAcc = new Map<string, { sum: number; count: number }>();
			const baselineAcc = new Map<string, { sum: number; count: number }>();
			for (const s of filteredSnapshots) {
				if (s.price_avg == null) continue;
				const acc =
					s.snapshot_date === latestDate
						? latestAcc
						: s.snapshot_date === baselineDate
							? baselineAcc
							: null;
				if (!acc) continue;
				const cur = acc.get(s.origin) ?? { sum: 0, count: 0 };
				cur.sum += s.price_avg;
				cur.count += 1;
				acc.set(s.origin, cur);
			}
			const toAverages = (acc: Map<string, { sum: number; count: number }>) =>
				new Map(Array.from(acc.entries()).map(([origin, v]) => [origin, v.sum / v.count]));

			const latestByOrigin = toAverages(latestAcc);
			const baselineByOrigin = toAverages(baselineAcc);
			const movers: OriginMover[] = [];
			for (const [origin, latest] of latestByOrigin) {
				const baseline = baselineByOrigin.get(origin);
				if (baseline == null) continue;
				const delta = latest - baseline;
				if (Math.abs(delta) >= 0.05) movers.push({ origin, latest, delta });
			}
			movers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
			return { movers, baselineDate };
		}
	);

	function topOriginCounts(beans: Array<{ country: string | null }>, max = 2): string {
		const counts = new Map<string, number>();
		for (const bean of beans) {
			if (!bean.country) continue;
			counts.set(bean.country, (counts.get(bean.country) ?? 0) + 1);
		}
		return Array.from(counts.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, max)
			.map(([country, count]) => `${country} (${count})`)
			.join(', ');
	}

	function loadedRowsLabel(count: number): string {
		return `Open ${count.toLocaleString()} loaded ${count === 1 ? 'row' : 'rows'} ↗`;
	}

	let arrivalPanelBadge = $derived(isMovementDataAvailable ? `+${scopedArrivalCount}` : undefined);
	let delistingPanelBadge = $derived(
		isMovementDataAvailable ? `-${scopedDelistingCount}` : undefined
	);
	let arrivalPanelTotalItems = $derived(
		isMovementDataAvailable ? scopedArrivalCount : filteredArrivals.length
	);
	let delistingPanelTotalItems = $derived(
		isMovementDataAvailable ? scopedDelistingCount : filteredDelistings.length
	);
	let arrivalExpandLabel = $derived(
		isMovementDataAvailable
			? filteredArrivals.length < scopedArrivalCount
				? `Open latest ${filteredArrivals.length} shown (${scopedArrivalCount} total in window) ↗`
				: undefined
			: loadedRowsLabel(filteredArrivals.length)
	);
	let delistingExpandLabel = $derived(
		isMovementDataAvailable
			? filteredDelistings.length < scopedDelistingCount
				? `Open latest ${filteredDelistings.length} shown (${scopedDelistingCount} total in window) ↗`
				: undefined
			: loadedRowsLabel(filteredDelistings.length)
	);

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

	let movementWindowLabel = $derived(windowMode === '7d' ? '7-day' : '30-day');
	let viewModeLabel = $derived(viewMode === 'all' ? 'combined retail + wholesale' : viewMode);

	let marketReadHeadline = $derived.by(() => {
		if (!isMovementDataAvailable) {
			return `${movementWindowLabel} movement data is unavailable; use price and coverage evidence until the index refreshes.`;
		}
		if (scopedArrivalCount > scopedDelistingCount) {
			return `Supply is expanding faster than it is leaving the visible market in the ${movementWindowLabel} window.`;
		}
		if (scopedDelistingCount > scopedArrivalCount) {
			return `Availability is tightening in the ${movementWindowLabel} movement window.`;
		}
		if (marketPriceDelta != null && Math.abs(marketPriceDelta) >= 0.05) {
			return marketPriceDelta > 0
				? 'Average visible prices are firming in the latest indexed snapshot.'
				: 'Average visible prices are easing in the latest indexed snapshot.';
		}
		return 'The current market read is stable, with breadth still visible across origins and suppliers.';
	});

	let marketReadDetail = $derived.by(() => {
		const pricePhrase =
			marketPriceDelta == null
				? 'price movement needs another comparable snapshot'
				: `${formatSigned(marketPriceDelta, 2)}/lb (${formatSigned(marketPriceDeltaPercent, 1)}%) versus the prior comparable snapshot`;
		if (!isMovementDataAvailable) {
			return `${displayStockedCount.toLocaleString()} active ${viewModeLabel} listings are in scope; ${pricePhrase}. Movement counts are withheld because the latest movement query is unavailable or stale.`;
		}
		return `${movementWindowLabel} movement: ${scopedArrivalCount} arrivals and ${scopedDelistingCount} delistings. ${displayStockedCount.toLocaleString()} active ${viewModeLabel} listings are in scope; ${pricePhrase}.`;
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
			value: isMovementDataAvailable ? scopedArrivalCount.toLocaleString() : 'N/A',
			detail: isMovementDataAvailable
				? `${movementWindowLabel} stocked movement`
				: 'Movement data unavailable',
			tone: 'up'
		},
		{
			label: 'Delistings',
			value: isMovementDataAvailable ? scopedDelistingCount.toLocaleString() : 'N/A',
			detail: isMovementDataAvailable
				? `${movementWindowLabel} catalog removals`
				: 'Movement data unavailable',
			tone:
				isMovementDataAvailable && scopedDelistingCount > scopedArrivalCount ? 'alert' : 'neutral'
		},
		{
			label: 'Supplier coverage',
			value: displaySuppliersCount.toLocaleString(),
			detail:
				supplierCoverageDelta == null
					? `${displayOriginsCount} ${viewModeLabel} origins indexed`
					: `${formatSigned(supplierCoverageDelta)} supplier-origin positions`,
			tone: supplierCoverageDelta != null && supplierCoverageDelta < 0 ? 'alert' : 'neutral'
		}
	]);

	// Origins whose latest snapshot rests on fewer than three suppliers — their medians
	// are thin evidence and the coverage card calls that out.
	let thinCoverageOrigins = $derived.by(() => {
		const byOrigin = new Map<string, number>();
		for (const s of latestSnapshotRows) {
			byOrigin.set(s.origin, Math.max(byOrigin.get(s.origin) ?? 0, s.supplier_count ?? 0));
		}
		const origins = Array.from(byOrigin.entries());
		return {
			total: origins.length,
			thin: origins.filter(([, suppliers]) => suppliers < 3).map(([origin]) => origin)
		};
	});

	function formatMoverPhrase(mover: { origin: string; delta: number }): string {
		return `${mover.origin} ${formatSigned(mover.delta, 2)}/lb`;
	}

	let availabilityInsight = $derived.by(() => {
		if (!isMovementDataAvailable) {
			return {
				label: 'Availability read',
				title: 'Movement counts need a fresh index read.',
				body: `The selected ${movementWindowLabel} ${viewModeLabel} movement counts are unavailable or stale, so the read does not treat zeros as market stability.`,
				evidence: `Evidence: latest index ${formatDate(stats.lastUpdated)}`
			};
		}
		const net = scopedArrivalCount - scopedDelistingCount;
		const title =
			net === 0
				? `Arrivals and delistings are balanced in the ${movementWindowLabel} ${viewModeLabel} window.`
				: net > 0
					? `Net +${net} ${viewModeLabel} lots in the ${movementWindowLabel} window.`
					: `Net ${net} ${viewModeLabel} lots — exits are outpacing arrivals in the ${movementWindowLabel} window.`;
		const arrivalOrigins = topOriginCounts(filteredArrivals);
		const delistingOrigins = topOriginCounts(filteredDelistings);
		const detailParts = [`${scopedArrivalCount} arrivals vs ${scopedDelistingCount} delistings.`];
		if (arrivalOrigins) detailParts.push(`Arrivals led by ${arrivalOrigins}.`);
		if (delistingOrigins) detailParts.push(`Exits led by ${delistingOrigins}.`);
		if (!arrivalOrigins && !delistingOrigins && isParchmentIntelligence === false) {
			detailParts.push('Named lots and origin-level movement are in the gated movement tables.');
		}
		return {
			label: 'Availability read',
			title,
			body: detailParts.join(' '),
			evidence: `Evidence: ${movementWindowLabel} window ending ${formatDate(stats.lastUpdated)}, ${displaySuppliersCount} ${viewModeLabel} suppliers`
		};
	});

	let pricePostureInsight = $derived.by(() => {
		const movers = weeklyOriginMovement.movers;
		const baselineDate = weeklyOriginMovement.baselineDate;
		if (!movers.length || !baselineDate) {
			return {
				label: 'Price posture',
				title:
					baselineDate === null
						? 'Week-over-week price movement needs a second comparable snapshot.'
						: `Origin averages are flat week-over-week (within ±$0.05/lb) in the ${viewModeLabel} scope.`,
				body: `The latest ${viewModeLabel} average is ${formatMoney(latestMarketAverage)}/lb across ${latestSnapshotRows.length} origin rows. Origin ranges below show how that average distributes.`,
				evidence:
					baselineDate === null
						? `Evidence: single snapshot ${formatDate(latestSnapshotDate || stats.lastUpdated)}`
						: `Evidence: ${formatDate(baselineDate)} vs ${formatDate(latestSnapshotDate)}`
			};
		}
		const lead = movers[0];
		const up = movers.filter((m) => m.delta > 0);
		const down = movers.filter((m) => m.delta < 0);
		const title = `${lead.origin} leads ${viewModeLabel} movement, ${formatSigned(lead.delta, 2)}/lb week-over-week.`;
		const bodyParts: string[] = [];
		if (up.length) {
			bodyParts.push(`Rising: ${up.slice(0, 3).map(formatMoverPhrase).join(', ')}.`);
		}
		if (down.length) {
			bodyParts.push(`Easing: ${down.slice(0, 3).map(formatMoverPhrase).join(', ')}.`);
		}
		bodyParts.push(`Scope average is ${formatMoney(latestMarketAverage)}/lb.`);
		return {
			label: 'Price posture',
			title,
			body: bodyParts.join(' '),
			evidence: `Evidence: per-origin averages, ${formatDate(baselineDate)} vs ${formatDate(latestSnapshotDate)}`
		};
	});

	let coverageInsight = $derived.by(() => {
		const { total, thin } = thinCoverageOrigins;
		if (total === 0) {
			return {
				label: 'Coverage signal',
				title: 'No indexed origins in this scope yet.',
				body: `No ${viewModeLabel} origin rows are present in the latest snapshot, so price reads in this scope have no supplier evidence behind them.`,
				evidence: `Evidence: latest index ${formatDate(stats.lastUpdated)}`
			};
		}
		const broad = total - thin.length;
		const title =
			thin.length === 0
				? `All ${total} ${viewModeLabel} origins have 3+ supplier coverage.`
				: `${thin.length} of ${total} ${viewModeLabel} origins rest on fewer than 3 suppliers.`;
		const thinList = thin.slice(0, 4).join(', ');
		const body =
			thin.length === 0
				? `Every origin median in this scope is backed by at least three suppliers, so range evidence is comparison-grade across the board.`
				: `Treat medians for ${thinList}${thin.length > 4 ? ` and ${thin.length - 4} more` : ''} as thin evidence — fewer than three suppliers price them. The remaining ${broad} origins have comparison-grade coverage.`;
		return {
			label: 'Coverage signal',
			title,
			body,
			evidence: `Evidence: supplier counts per origin, snapshot ${formatDate(latestSnapshotDate || stats.lastUpdated)}`
		};
	});

	let insightCards = $derived.by(() => [availabilityInsight, pricePostureInsight, coverageInsight]);

	let analyticsEntitlement = $derived(
		resolveAnalyticsEntitlement({
			session,
			role,
			ppiAccess: isParchmentIntelligence
		})
	);
	let canAskWithAnalyticsContext = $derived(canUseAnalyticsChat(analyticsEntitlement));
	let analyticsChatContext = $derived.by(
		(): AnalyticsChatContext => ({
			origin: null,
			process: null,
			supplier: null,
			viewMode,
			timeWindow: windowMode,
			activeFilters: {
				marketScope: viewMode,
				movementWindow: windowMode,
				latestIndexDate: stats.lastUpdated,
				stockedListings: displayStockedCount,
				suppliers: displaySuppliersCount,
				origins: displayOriginsCount,
				trackedLots: scopedTrackedLots.length
			},
			visibleModules: [
				'market-read',
				'scope-controls',
				'kpi-strip',
				'insight-cards',
				...(scopedTrackedLots.length > 0 ? ['watchlist-signals'] : []),
				'origin-price-trends',
				'processing-mix',
				'origin-price-ranges',
				...(isParchmentIntelligence
					? ['supplier-comparison', 'supplier-health', 'arrivals-delistings']
					: ['premium-preview'])
			],
			entitlement: analyticsEntitlement
		})
	);
	let analyticsChatHref = $derived.by(() =>
		canAskWithAnalyticsContext
			? buildAnalyticsChatHref(analyticsChatContext, marketReadHeadline)
			: undefined
	);

	// Publish the live market view so chat can ground answers in it.
	$effect(() => {
		pageChatContext.set({
			surface: 'analytics',
			summary: buildAnalyticsPageContextSummary(analyticsChatContext, marketReadHeadline)
		});
		return () => pageChatContext.clear();
	});

	let askActionHref = $derived.by(() => {
		if (analyticsChatHref) return analyticsChatHref;
		if (!session) return '/auth';
		return '/subscription?plan=intelligence-monthly&intent=checkout';
	});
	let askActionLabel = $derived.by(() => {
		if (canAskWithAnalyticsContext) return 'Ask with this context';
		if (!session) return 'Sign in to ask';
		return 'Upgrade to ask';
	});
	let askActionStatus = $derived.by(() => {
		if (canAskWithAnalyticsContext) return 'Available';
		if (!session) return 'Login required';
		return 'Parchment Intelligence';
	});
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
						A master lens: every module on this page follows the selected scope.
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
				<div class="rounded-lg border border-border-light bg-background-secondary-light p-3">
					<p class="truncate text-sm font-semibold text-text-primary-light">{lot.name}</p>
					<p class="mt-0.5 text-xs text-text-secondary-light">
						{[lot.source, lot.country].filter(Boolean).join(' · ') || 'Supplier unknown'}
					</p>
					<div class="mt-2 flex items-center gap-2 text-xs">
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
			onRetry={retryPublicCharts}
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

<section
	class="mb-6 rounded-xl border border-background-tertiary-light/20 bg-background-secondary-light p-5"
	aria-label="Action rail"
>
	<div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-center">
		<div>
			<p class="text-xs font-semibold uppercase tracking-wide text-background-tertiary-light">
				Next investigation
			</p>
			<h2 class="mt-1 text-lg font-semibold text-text-primary-light">
				Ask the chat agent with this market context.
			</h2>
			<p class="mt-1 text-sm text-text-secondary-light">
				This is the only live handoff here that preserves the current market read, scope, movement
				window, and visible evidence. Catalog, supplier comparison, API access, and watch actions
				stay out of this rail until they create real investigation leverage instead of another click
				target.
			</p>
		</div>
		<AnalyticsActionCta
			eyebrow="Ask"
			title="Ask about this market read"
			description="Open chat with the current scope, movement window, and market evidence already framed in the prompt."
			ctaLabel={askActionLabel}
			href={askActionHref}
			statusLabel={askActionStatus}
			tone={canAskWithAnalyticsContext ? 'primary' : 'secondary'}
		/>
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
					onRetry={retryMemberVisuals}
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
					onRetry={retryMemberVisuals}
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

<div class="mt-4 rounded-lg bg-background-secondary-light p-4 text-xs text-text-secondary-light">
	<strong class="text-text-primary-light">Data source:</strong> Daily prices aggregated from
	{stats.totalSuppliers} US green coffee importers and roasters. The Parchment Market Index updates each
	morning, and origin plus processing details come directly from supplier listings.
</div>
