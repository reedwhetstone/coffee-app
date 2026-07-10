<script lang="ts">
	import type { PageData } from './$types';
	import type {
		PriceSnapshot,
		ProcessBucket,
		MovementCounts,
		MovementWindowCounts,
		AnalyticsPreview,
		AnalyticsCoverage,
		AnalyticsCharts,
		AnalyticsMemberData
	} from './+page.server';
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
		loadPublicTrendAnalyticsModule,
		loadSupplierAnalyticsModules
	} from './deferredModules';
	import MarketReadSection from '$lib/components/analytics/sections/MarketReadSection.svelte';
	import KpiStripSection from '$lib/components/analytics/sections/KpiStripSection.svelte';
	import WatchlistSignalsSection from '$lib/components/analytics/sections/WatchlistSignalsSection.svelte';
	import EvidenceChartsSection from '$lib/components/analytics/sections/EvidenceChartsSection.svelte';
	import ParchmentIntelligenceSection from '$lib/components/analytics/sections/ParchmentIntelligenceSection.svelte';
	import AnalyticsSectionHeader from '$lib/components/analytics/sections/AnalyticsSectionHeader.svelte';
	import ValueSignalsSection from '$lib/components/analytics/sections/ValueSignalsSection.svelte';
	import MetadataTrendsSection from '$lib/components/analytics/sections/MetadataTrendsSection.svelte';
	import AnalyticsPageSkeleton from '$lib/components/analytics/AnalyticsPageSkeleton.svelte';
	import { getAnalyticsSectionLinks } from '$lib/components/layout/appNavigation';
	import type { MarketIndexInsights } from '$lib/types/marketIndex.types';

	let { data } = $props<{ data: PageData }>();

	// ── Streamed dataset subscriptions ────────────────────────────────────────
	// The server awaits only the precomputed market summary before first byte;
	// coverage counts, chart evidence, and member datasets stream independently.
	// Each stream settles into 'ready' or 'error' so a rejected payload swaps
	// its skeleton for an error notice instead of pulsing forever.

	type StreamState = 'pending' | 'ready' | 'error';

	const EMPTY_MOVEMENT_COUNTS: MovementCounts = {
		available: false,
		arrivals: {
			sevenDay: { retail: 0, wholesale: 0 },
			thirtyDay: { retail: 0, wholesale: 0 }
		},
		delistings: {
			sevenDay: { retail: 0, wholesale: 0 },
			thirtyDay: { retail: 0, wholesale: 0 }
		}
	};

	const EMPTY_MARKET_INSIGHTS: MarketIndexInsights = {
		valueSignals: null,
		signalsSummary: null,
		signalsAsOf: null,
		moveStats: null,
		metadataProcessSeries: null,
		metadataDisclosureSeries: null,
		metadataPurveyorScoreSeries: null,
		metadataPurveyorScoreConfidenceSeries: null,
		metadataPurveyorScoreTierSeries: null
	};

	let coverageState = $state<StreamState>('pending');
	let coverageData = $state<AnalyticsCoverage | null>(null);
	let chartsState = $state<StreamState>('pending');
	let chartsData = $state<AnalyticsCharts | null>(null);
	let memberState = $state<StreamState>('pending');
	let memberData = $state<AnalyticsMemberData | null>(null);

	$effect(() => {
		const promise = data.analyticsCoverage as Promise<AnalyticsCoverage>;
		let cancelled = false;
		coverageState = 'pending';
		coverageData = null;
		void Promise.resolve(promise)
			.then((value) => {
				if (cancelled) return;
				coverageData = value;
				coverageState = 'ready';
			})
			.catch((error: unknown) => {
				if (cancelled) return;
				console.error('Failed to load analytics coverage:', error);
				coverageState = 'error';
			});
		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		const promise = data.analyticsCharts as Promise<AnalyticsCharts>;
		let cancelled = false;
		chartsState = 'pending';
		chartsData = null;
		void Promise.resolve(promise)
			.then((value) => {
				if (cancelled) return;
				chartsData = value;
				chartsState = 'ready';
			})
			.catch((error: unknown) => {
				if (cancelled) return;
				console.error('Failed to load analytics charts:', error);
				chartsState = 'error';
			});
		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		const promise = data.analyticsMember as Promise<AnalyticsMemberData>;
		let cancelled = false;
		memberState = 'pending';
		memberData = null;
		void Promise.resolve(promise)
			.then((value) => {
				if (cancelled) return;
				memberData = value;
				memberState = 'ready';
			})
			.catch((error: unknown) => {
				if (cancelled) return;
				console.error('Failed to load analytics member data:', error);
				memberState = 'error';
			});
		return () => {
			cancelled = true;
		};
	});

	let coverageSettled = $derived(coverageState !== 'pending');
	let chartsSettled = $derived(chartsState !== 'pending');
	let memberSettled = $derived(memberState !== 'pending');
	// Signals need movement counts plus snapshot deltas. Body sections need
	// only chart evidence — a slow member stream must not hold back the public
	// chart sections, so member-backed panels gate on memberSettled separately.
	let signalsReady = $derived(coverageSettled && chartsSettled);
	let bodyReady = $derived(chartsSettled);
	let allResolved = $derived(
		coverageState === 'ready' && chartsState === 'ready' && memberState === 'ready'
	);
	let streamedSectionErrors = $derived.by(() => {
		const failed: string[] = [];
		if (coverageState === 'error') failed.push('coverage and movement counts');
		if (chartsState === 'error') failed.push('price history and chart evidence');
		if (memberState === 'error') failed.push('member market evidence');
		return failed;
	});

	// Deferred chart module state
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

	// Global scope controls shared across all sections
	type ViewMode = 'retail' | 'wholesale' | 'all';
	type WindowMode = '7d' | '30d';
	let viewMode = $state<ViewMode>('retail');
	let windowMode = $state<WindowMode>('7d');

	let session = $derived(data.session as PageData['session']);
	let role = $derived(data.role as PageData['role']);
	let isParchmentIntelligence = $derived(Boolean(data.isParchmentIntelligence));
	let analyticsPreview = $derived(data.analyticsPreview as AnalyticsPreview);

	// Preview values render immediately from the SSR payload; each streamed
	// dataset swaps in as it resolves.
	let stats = $derived(coverageData?.stats ?? analyticsPreview.stats);
	let movementCounts = $derived(coverageData?.movementCounts ?? EMPTY_MOVEMENT_COUNTS);
	let snapshots = $derived(chartsData?.snapshots ?? []);
	let processDistribution = $derived(chartsData?.processDistribution ?? []);
	let originRangeData = $derived(chartsData?.originRangeData ?? []);
	let marketInsights = $derived(chartsData?.marketInsights ?? EMPTY_MARKET_INSIGHTS);
	let recentArrivals = $derived(memberData?.recentArrivals ?? []);
	let recentDelistings = $derived(memberData?.recentDelistings ?? []);
	let comparisonBeans = $derived(memberData?.comparisonBeans ?? []);
	let supplierPriceRanges = $derived(memberData?.supplierPriceRanges ?? []);
	let supplierHealth = $derived(memberData?.supplierHealth ?? []);
	let trackedLots = $derived(memberData?.trackedLots ?? []);
	let isAnonymous = $derived(!session);
	let visibleAnalyticsSectionLinks = $derived(
		getAnalyticsSectionLinks({ includeDisclosureIndex: !isAnonymous })
	);

	// ── Snapshot filtering (scope lens) ──────────────────────────────────────

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

	let scopedOriginRangeData = $derived.by(() =>
		originRangeData.filter((row) => row.market_scope === viewMode)
	);

	// ── Display counts (scope-scoped) ─────────────────────────────────────────

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

	// ── Movement counts (scope + window scoped) ───────────────────────────────

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

	let isMovementDataAvailable = $derived.by(() => {
		if (!movementCounts.available || !stats.lastUpdated) return false;
		const updatedAt = new Date(`${stats.lastUpdated}T00:00:00.000Z`).getTime();
		const staleAfterMs = 90 * 24 * 60 * 60 * 1000;
		return Number.isFinite(updatedAt) && Date.now() - updatedAt <= staleAfterMs;
	});

	// ── Arrival / delisting list filtering ───────────────────────────────────

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

	// ── Member-gated data (scope-scoped) ──────────────────────────────────────

	let scopedComparisonBeans = $derived.by(() => {
		if (viewMode === 'retail') return comparisonBeans.filter((bean) => !bean.wholesale);
		if (viewMode === 'wholesale') return comparisonBeans.filter((bean) => bean.wholesale);
		return comparisonBeans;
	});

	let scopedSupplierPriceRanges = $derived.by(() =>
		(supplierPriceRanges ?? []).filter((row) => row.market === viewMode)
	);

	let scopedSupplierHealth = $derived.by(() => {
		if (viewMode === 'retail') return supplierHealth.filter((row) => row.retailCount > 0);
		if (viewMode === 'wholesale') return supplierHealth.filter((row) => row.wholesaleCount > 0);
		return supplierHealth;
	});

	// ── Watchlist (scope-scoped) ──────────────────────────────────────────────

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

	// ── Snapshot summary metrics ───────────────────────────────────────────────

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

	// ── Origin benchmark table data ───────────────────────────────────────────

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

	let hasSnapshots = $derived(filteredSnapshots.length > 0);

	// ── Movement panel labels ─────────────────────────────────────────────────

	// ── Formatting helpers ────────────────────────────────────────────────────

	function formatDate(dateStr: string | null) {
		if (!dateStr) return 'N/A';
		return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function formatMoney(value: number | null): string {
		return value == null ? 'N/A' : `$${value.toFixed(2)}`;
	}

	function formatSigned(value: number | null, precision = 0): string {
		if (value == null) return 'Baseline';
		if (Math.abs(value) < 0.01) return 'Flat';
		const sign = value > 0 ? '+' : '−';
		return `${sign}${Math.abs(value).toFixed(precision)}`;
	}

	// ── Movement significance (ADR-008: signal vs noise) ─────────────────────

	let currentMoveStat = $derived.by(() => {
		const stats = marketInsights?.moveStats;
		if (!stats) return null;
		return (
			stats.find(
				(item) =>
					item.window === windowMode &&
					item.segment.market === viewMode &&
					item.segment.origin == null &&
					item.segment.process == null
			) ?? null
		);
	});

	let significanceNote = $derived.by(() => {
		const stat = currentMoveStat;
		if (!stat || stat.latestMovePct == null) return null;
		const windowLabel = stat.window === '7d' ? 'weekly' : '30-day';
		const marketLabel = stat.segment.market === 'all' ? 'combined' : stat.segment.market;
		const movePhrase = `${stat.latestMovePct > 0 ? '+' : ''}${stat.latestMovePct.toFixed(1)}% ${windowLabel} ${marketLabel} move`;
		const driverPhrase =
			stat.moveDriver === 'repricing'
				? 'driven by suppliers repricing continuing lots'
				: stat.moveDriver === 'mix_shift'
					? 'driven by catalog turnover (arrivals and delistings), not repricing'
					: stat.moveDriver === 'mixed'
						? 'a mix of repricing and catalog turnover'
						: null;
		if (stat.classification == null) {
			return driverPhrase ? `${movePhrase} — ${driverPhrase}.` : null;
		}
		const sizePhrase =
			stat.classification === 'quiet'
				? 'smaller than most recent moves'
				: stat.classification === 'normal'
					? 'within normal variance'
					: stat.weeksSinceLargerMove != null && stat.weeksSinceLargerMove > 0
						? `the largest ${windowLabel} move in ${stat.weeksSinceLargerMove} weeks`
						: `${stat.classification} against recent variance`;
		return `${movePhrase}: ${sizePhrase}${driverPhrase ? `, ${driverPhrase}` : ''}.`;
	});

	// ── Labels derived from scope ─────────────────────────────────────────────

	let movementWindowLabel = $derived(windowMode === '7d' ? '7-day' : '30-day');
	let viewModeLabel = $derived(viewMode === 'all' ? 'combined retail + wholesale' : viewMode);

	// ── Market read headline + detail ─────────────────────────────────────────

	let marketReadHeadline = $derived.by(() => {
		// A stability call needs price evidence, so the headline waits for the
		// charts stream too — not just coverage.
		if (!coverageSettled || chartsState === 'pending') {
			return 'The latest index snapshot is in; movement and coverage signals are streaming next.';
		}
		if (!isMovementDataAvailable) {
			return `${movementWindowLabel} movement data is unavailable; use price and coverage evidence until the index refreshes.`;
		}
		if (scopedArrivalCount > scopedDelistingCount) {
			return `Supply is expanding faster than it is leaving the visible market in the ${movementWindowLabel} window.`;
		}
		if (scopedDelistingCount > scopedArrivalCount) {
			return `Availability is tightening in the ${movementWindowLabel} movement window.`;
		}
		if (chartsState === 'error') {
			return `Movement is balanced in the ${movementWindowLabel} window, but the price history layer did not load, so this read makes no stability call.`;
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
			chartsState === 'pending'
				? 'price movement is loading with the comparable snapshot layer'
				: chartsState === 'error'
					? 'price movement is unavailable because the price history layer did not load'
					: marketPriceDelta == null
						? 'price movement needs another comparable snapshot'
						: `${formatSigned(marketPriceDelta, 2)}/lb (${formatSigned(marketPriceDeltaPercent, 1)}%) versus the prior comparable snapshot`;
		if (!coverageSettled) {
			return `The ${stats.totalSuppliers.toLocaleString()}-supplier index is loaded; movement and coverage counts are streaming in, and ${pricePhrase}.`;
		}
		if (!isMovementDataAvailable) {
			return `${displayStockedCount.toLocaleString()} active ${viewModeLabel} listings are in scope; ${pricePhrase}. Movement counts are withheld because the latest movement query is unavailable or stale.`;
		}
		return `${movementWindowLabel} movement: ${scopedArrivalCount} arrivals and ${scopedDelistingCount} delistings. ${displayStockedCount.toLocaleString()} active ${viewModeLabel} listings are in scope; ${pricePhrase}.`;
	});

	// ── KPI strip ─────────────────────────────────────────────────────────────

	let priceMovementKpi = $derived.by(() => {
		const stat = currentMoveStat;
		if (stat?.latestMovePct != null) {
			const tone =
				stat.classification === 'exceptional'
					? 'alert'
					: stat.classification === 'quiet' || Math.abs(stat.latestMovePct) < 0.01
						? 'neutral'
						: stat.latestMovePct > 0
							? 'up'
							: 'down';
			return {
				value: `${formatSigned(stat.latestMovePct, 1)}%`,
				detail: `${movementWindowLabel} ${viewModeLabel} move`,
				tone
			};
		}

		return {
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
		};
	});

	let kpiCards = $derived.by(() => [
		{
			label: 'Price movement',
			...priceMovementKpi
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

	// ── Insight cards ─────────────────────────────────────────────────────────

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

	// Origins whose latest snapshot rests on fewer than three suppliers
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

	// Week-over-week per-origin price movement
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

	// ── Analytics chat context ────────────────────────────────────────────────

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
		canAskWithAnalyticsContext && allResolved
			? buildAnalyticsChatHref(analyticsChatContext, marketReadHeadline)
			: undefined
	);

	// Publish only the fully resolved market view so chat never grounds
	// answers in preview placeholders or partially failed data.
	$effect(() => {
		if (!allResolved) {
			pageChatContext.clear();
			return;
		}
		pageChatContext.set({
			surface: 'analytics',
			summary: buildAnalyticsPageContextSummary(analyticsChatContext, marketReadHeadline)
		});
		return () => pageChatContext.clear();
	});

	let askActionHref = $derived.by(() => {
		if (analyticsChatHref) return analyticsChatHref;
		if (canAskWithAnalyticsContext && !allResolved) return undefined;
		if (!session) return '/auth';
		return '/subscription?plan=intelligence-monthly&intent=checkout';
	});
	let askActionLabel = $derived.by(() => {
		if (canAskWithAnalyticsContext) return 'Ask with this context';
		if (!session) return 'Sign in to ask';
		return 'Upgrade to ask';
	});

	// ── Deferred module loading ───────────────────────────────────────────────

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
		const mainOnly = isAnonymous;
		void retryKey;

		if (
			OriginLineChartComponent &&
			(mainOnly || (OriginBarChartComponent && ProcessDonutChartComponent))
		) {
			publicChartsLoading = false;
			publicChartsError = null;
			return;
		}

		let cancelled = false;
		publicChartsLoading = true;
		publicChartsError = null;

		const moduleLoad = mainOnly ? loadPublicTrendAnalyticsModule() : loadPublicAnalyticsModules();

		void moduleLoad
			.then(
				({
					OriginLineChartComponent: originLine,
					OriginBarChartComponent: originBar,
					ProcessDonutChartComponent: processDonut
				}: {
					OriginLineChartComponent: DeferredAnalyticsComponent;
					OriginBarChartComponent?: DeferredAnalyticsComponent;
					ProcessDonutChartComponent?: DeferredAnalyticsComponent;
				}) => {
					if (cancelled) return;
					OriginLineChartComponent = originLine;
					if (originBar) OriginBarChartComponent = originBar;
					if (processDonut) ProcessDonutChartComponent = processDonut;
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

{#if streamedSectionErrors.length > 0}
	<section class="mb-6 rounded-lg bg-danger-subtle p-5 text-sm ring-1 ring-danger/30" role="alert">
		<p class="font-semibold text-danger-strong">Some market data did not load.</p>
		<p class="mt-1 text-danger">
			Failed to load: {streamedSectionErrors.join(', ')}. Refresh the page to retry — the sections
			below reflect the data that did resolve.
		</p>
	</section>
{/if}

<MarketReadSection
	{marketReadHeadline}
	{marketReadDetail}
	{significanceNote}
	lastUpdated={stats.lastUpdated}
	totalSuppliers={stats.totalSuppliers}
	{viewMode}
	{windowMode}
	onViewModeChange={(v) => (viewMode = v)}
	onWindowModeChange={(v) => (windowMode = v)}
/>

<nav
	class="sticky top-16 z-20 mb-6 hidden overflow-x-auto border-y border-line bg-surface-canvas/95 py-2 backdrop-blur md:block"
	aria-label="Market Index sections"
>
	<div class="flex min-w-max items-center gap-2">
		{#each visibleAnalyticsSectionLinks as link}
			<a
				href={link.href}
				class="rounded-full border border-line bg-surface-panel px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-ink"
			>
				{link.label}
			</a>
		{/each}
		{#if askActionHref}
			<a
				href={askActionHref}
				class="rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:bg-accent/85"
			>
				{askActionLabel}
			</a>
		{/if}
	</div>
</nav>

{#if askActionHref}
	<div class="mb-6 md:hidden">
		<a
			href={askActionHref}
			aria-label={`${askActionLabel} from Market Index summary`}
			class="flex w-full items-center justify-center rounded-md bg-accent px-4 py-3 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-accent/85"
		>
			{askActionLabel}
		</a>
	</div>
{/if}

<section id="today-signals" class="scroll-mt-28">
	<AnalyticsSectionHeader
		title="Today's signals"
		description="The numbers behind this morning's read — availability, movement, and what changed overnight."
	/>

	{#if coverageState === 'error'}
		<!-- A failed coverage stream must not present preview zeros as measured
		     KPI values; settle into a static error notice instead. -->
		<section
			class="mb-6 rounded-lg bg-danger-subtle p-5 text-sm ring-1 ring-danger/30"
			role="alert"
			aria-label="Market signals unavailable"
		>
			<p class="font-semibold text-danger-strong">Today's signals are unavailable.</p>
			<p class="mt-1 text-danger">
				Coverage and movement counts did not load. Refresh the page to retry.
			</p>
		</section>
	{:else if signalsReady}
		<KpiStripSection {kpiCards} {insightCards} />
	{:else}
		<!-- Mirrors the KpiStripSection strip geometry so the resolve swap is shift-free. -->
		<section
			class="mb-6 grid grid-cols-2 divide-line overflow-hidden rounded-lg border border-line bg-surface-raised shadow-sm max-lg:divide-y lg:grid-cols-4 lg:divide-x"
			aria-busy="true"
			aria-label="Loading market signals"
		>
			{#each Array.from({ length: 4 }) as _, index (index)}
				<div class="p-4 sm:p-5">
					<div class="h-3 w-24 animate-pulse rounded bg-surface-canvas"></div>
					<div class="mt-3 h-8 w-20 animate-pulse rounded bg-surface-canvas"></div>
					<div class="mt-3 h-3 w-full animate-pulse rounded bg-surface-canvas"></div>
				</div>
			{/each}
		</section>
	{/if}
</section>

{#if !bodyReady}
	<!-- Same skeleton contract the root-layout route skeleton renders, minus the
	     hero, which is already resolved above. -->
	<AnalyticsPageSkeleton showHero={false} isSignedIn={Boolean(session)} {isParchmentIntelligence} />
{:else}
	<ValueSignalsSection
		valueSignals={marketInsights?.valueSignals ?? null}
		signalsSummary={marketInsights?.signalsSummary ?? null}
		signalsAsOf={marketInsights?.signalsAsOf ?? null}
		{isParchmentIntelligence}
		isSignedIn={Boolean(session)}
		{viewMode}
	/>

	{#if !isAnonymous}
		<WatchlistSignalsSection
			{scopedTrackedLots}
			{trackedDelistedCount}
			{trackedPriceMovers}
			{viewModeLabel}
			{viewMode}
		/>
	{/if}

	{#if analyticsShellMessage}
		<div
			class="mb-6 rounded-lg border border-accent/20 bg-surface-canvas px-5 py-3 shadow-sm"
			aria-live="polite"
		>
			<div class="flex items-start gap-3">
				<span class="mt-1 h-2.5 w-2.5 animate-pulse rounded-full bg-accent"></span>
				<div>
					<p class="text-sm font-semibold text-ink">Loading market visuals</p>
					<p class="mt-1 text-xs text-muted">
						The overview is ready first. {analyticsShellMessage} are loading next.
					</p>
				</div>
			</div>
		</div>
	{/if}

	<section id="market-index" class="scroll-mt-28">
		<AnalyticsSectionHeader
			title="Market Index"
			description={isAnonymous
				? 'The main price trend behind the current market read.'
				: 'Pricing, supplier coverage, arrivals, delistings, and the movement behind the current market read.'}
		/>

		<EvidenceChartsSection
			{OriginLineChartComponent}
			{OriginBarChartComponent}
			{ProcessDonutChartComponent}
			{publicChartsError}
			{filteredSnapshots}
			{filteredProcessDist}
			{scopedOriginRangeData}
			{displayStockedCount}
			{viewMode}
			{isParchmentIntelligence}
			mainOnly={isAnonymous}
			onRetry={retryPublicCharts}
		/>

		{#if isAnonymous}
			<section
				class="mb-8 rounded-lg border border-accent/20 bg-accent-subtle/10 p-5 shadow-sm"
				aria-label="Market Index upgrade summary"
			>
				<div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
					<div>
						<h2 class="font-serif text-xl font-medium text-ink">Unlock the full market map.</h2>
						<ul class="mt-3 grid gap-x-6 gap-y-1 text-sm text-muted sm:grid-cols-2">
							<li>Supplier price ranges and lot-level previews</li>
							<li>Arrivals, delistings, and movement by origin</li>
							<li>Processing and disclosure trends over time</li>
							<li>Scoped buy signals with evidence per lot</li>
						</ul>
					</div>
					<div class="flex shrink-0 gap-2">
						<a
							href="/subscription"
							class="rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-accent/85"
						>
							See plans
						</a>
						<a
							href="/auth"
							class="rounded-md border border-accent px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-accent"
						>
							Sign in
						</a>
					</div>
				</div>
			</section>
		{:else if isParchmentIntelligence && memberState === 'error'}
			<!-- A failed member stream must not render the evidence panels with
			     empty fallback arrays as if suppliers had no lots; settle into a
			     static error notice. A coverage-only failure still renders the
			     section: it degrades honestly via its movement-unavailable mode. -->
			<section
				class="mb-8 rounded-lg bg-danger-subtle p-5 text-sm ring-1 ring-danger/30"
				role="alert"
				aria-label="Member market evidence unavailable"
			>
				<p class="font-semibold text-danger-strong">Member market evidence is unavailable.</p>
				<p class="mt-1 text-danger">
					Supplier, comparison, and movement evidence did not load. Refresh the page to retry.
				</p>
			</section>
		{:else if isParchmentIntelligence && (!memberSettled || !coverageSettled)}
			<!-- Intelligence users' evidence panels wait for the member stream
			     (supplier and lot-level evidence) AND the coverage stream (the
			     movement counts the arrivals/delistings panel reports), so they
			     never see misleading empty or "unavailable" states for data that
			     is merely still loading. Non-Intelligence users get only the
			     static upgrade teaser below, which consumes neither stream, so
			     it renders as soon as the charts stream settles. -->
			<section
				class="mb-8 grid gap-5 lg:grid-cols-2"
				aria-busy="true"
				aria-label="Loading member market evidence"
			>
				{#each Array.from({ length: 2 }) as _, index (index)}
					<div class="rounded-lg border border-line bg-surface-panel p-5 shadow-sm">
						<div class="h-5 w-44 animate-pulse rounded bg-surface-canvas"></div>
						<div class="mt-4 h-56 animate-pulse rounded-md bg-surface-canvas"></div>
					</div>
				{/each}
			</section>
		{:else}
			<ParchmentIntelligenceSection
				{isParchmentIntelligence}
				{session}
				{PriceTierChartComponent}
				{SupplierComparisonTableComponent}
				{SupplierHealthTableComponent}
				{memberVisualsError}
				{snapshots}
				{scopedComparisonBeans}
				{scopedSupplierPriceRanges}
				{scopedSupplierHealth}
				{filteredArrivals}
				{filteredDelistings}
				arrivalTotal={scopedArrivalCount}
				delistingTotal={scopedDelistingCount}
				{isMovementDataAvailable}
				{originBarData}
				{hasSnapshots}
				{windowMode}
				{viewModeLabel}
				onRetry={retryMemberVisuals}
				onWindowModeChange={(v) => (windowMode = v)}
			/>
		{/if}
	</section>

	{#if !isAnonymous}
		<section id="disclosure-index" class="scroll-mt-28">
			<AnalyticsSectionHeader
				title="Disclosure Index"
				description="Metadata and transparency trends over time: what suppliers are revealing beyond price."
			/>

			<MetadataTrendsSection
				processSeries={marketInsights?.metadataProcessSeries ?? null}
				disclosureSeries={marketInsights?.metadataDisclosureSeries ?? null}
				purveyorScoreSeries={marketInsights?.metadataPurveyorScoreSeries ?? null}
				purveyorScoreConfidenceSeries={marketInsights?.metadataPurveyorScoreConfidenceSeries ??
					null}
				purveyorScoreTierSeries={marketInsights?.metadataPurveyorScoreTierSeries ?? null}
				{viewMode}
				{isParchmentIntelligence}
			/>
		</section>
	{/if}
{/if}

<div class="mt-4 rounded-lg bg-surface-panel p-4 text-xs text-muted">
	<strong class="text-ink">Data source:</strong> Daily prices aggregated from
	{stats.totalSuppliers} US green coffee importers and roasters. The Parchment Market Index updates each
	morning, and origin plus processing details come directly from supplier listings.
</div>
