import type { PageServerLoad } from './$types';
import { getUserRoles } from '$lib/server/auth';
import { createSchemaService } from '$lib/services/schemaService';

export interface ArrivalBean {
	name: string;
	country: string | null;
	processing: string | null;
	price_per_lb: number | null;
	source: string | null;
	stocked_date: string | null;
}

export interface DelistingBean {
	name: string;
	country: string | null;
	processing: string | null;
	price_per_lb: number | null;
	source: string | null;
	unstocked_date: string | null;
}

export interface ComparisonBean {
	name: string;
	country: string;
	processing: string | null;
	price_per_lb: number;
	source: string;
	wholesale: boolean;
	bag_size: string | null;
}

function getPerLbPrice(row: {
	price_per_lb?: number | null;
	cost_lb?: number | null;
}): number | null {
	return row.price_per_lb ?? row.cost_lb ?? null;
}

export interface SupplierHealthRow {
	source: string;
	stockedCount: number;
	origins: number;
	avgCostLb: number;
	minCostLb: number;
	maxCostLb: number;
	wholesaleCount: number;
	retailCount: number;
}

export interface PriceSnapshot {
	snapshot_date: string;
	origin: string;
	process: string | null;
	price_avg: number | null;
	price_median: number | null;
	price_min: number | null;
	price_max: number | null;
	price_p25: number | null;
	price_p75: number | null;
	price_stdev: number | null;
	supplier_count: number;
	sample_size: number;
	wholesale_only: boolean;
	aggregation_tier: number;
}

export interface ProcessBucket {
	name: string;
	count: number;
	wholesale: boolean;
}

export interface OriginRangeRow {
	origin: string;
	price_min: number;
	price_max: number;
	price_avg: number;
	price_median: number;
	price_q1: number;
	price_q3: number;
	sample_size: number;
}

function normalizeProcess(raw: string | null | undefined): string {
	if (!raw) return 'Unknown';
	const s = raw.toLowerCase().trim();
	if (s.includes('natural') || s.includes('dry')) return 'Natural';
	if (s.includes('honey') || s.includes('pulped')) return 'Honey';
	if (s.includes('anaerob')) return 'Anaerobic';
	if (s.includes('wet hull') || s.includes('giling')) return 'Wet Hulled';
	if (s.includes('washed') || s.includes('wet') || s.includes('fully')) return 'Washed';
	return 'Other';
}

export const load: PageServerLoad = async (event) => {
	const { session, user, role } = event.locals;

	// Check for ppi-member role (new role, checked via full role array)
	let isPpiMember = role === 'admin';
	if (user && !isPpiMember) {
		try {
			const roles = await getUserRoles(event.locals.supabase, user.id);
			isPpiMember = (roles as string[]).includes('ppi-member');
		} catch {
			// Non-blocking — default to false
		}
	}

	const today = new Date().toISOString().split('T')[0];

	// --- Market summary (pre-computed by compute_market_summary RPC) ---
	// Fetch most recent row up to today; falls back gracefully if the RPC hasn't run yet.
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const { data: marketSummaryRaw } = await (event.locals.supabase as any)
		.from('market_daily_summary')
		.select('*')
		.lte('snapshot_date', today)
		.order('snapshot_date', { ascending: false })
		.limit(1)
		.maybeSingle();

	const marketSummary = marketSummaryRaw as {
		snapshot_date: string;
		total_stocked: number;
		total_suppliers: number;
		total_origins: number;
		retail_median: number | null;
		retail_median_7d_change: number | null;
		retail_median_30d_change: number | null;
		supply_7d_change?: number | null;
		supply_30d_change?: number | null;
	} | null;

	// --- Counts still requiring live queries (not yet in market_daily_summary) ---

	// Total beans tracked (all catalog entries, stocked or not)
	const { count: totalBeansTracked } = await event.locals.supabase
		.from('coffee_catalog')
		.select('*', { count: 'exact', head: true });

	// Currently stocked retail only
	const { count: stockedRetailBeans } = await event.locals.supabase
		.from('coffee_catalog')
		.select('*', { count: 'exact', head: true })
		.eq('stocked', true)
		.eq('wholesale', false);

	// Currently stocked wholesale only
	const { count: stockedWholesaleBeans } = await event.locals.supabase
		.from('coffee_catalog')
		.select('*', { count: 'exact', head: true })
		.eq('stocked', true)
		.eq('wholesale', true);

	// Processing method distribution — load ALL stocked beans with wholesale flag
	const { data: processingRows } = await event.locals.supabase
		.from('coffee_catalog')
		.select('processing, wholesale')
		.eq('stocked', true)
		.not('processing', 'is', null)
		.limit(5000);

	const processDistribution: ProcessBucket[] = (() => {
		const retailDist: Record<string, number> = {};
		const wholesaleDist: Record<string, number> = {};
		for (const row of processingRows ?? []) {
			const key = normalizeProcess(row.processing);
			if (row.wholesale) {
				wholesaleDist[key] = (wholesaleDist[key] ?? 0) + 1;
			} else {
				retailDist[key] = (retailDist[key] ?? 0) + 1;
			}
		}
		// Return both retail and wholesale entries with a wholesale flag
		const entries: ProcessBucket[] = [];
		const allKeys = new Set([...Object.keys(retailDist), ...Object.keys(wholesaleDist)]);
		for (const name of allKeys) {
			if (retailDist[name]) entries.push({ name, count: retailDist[name], wholesale: false });
			if (wholesaleDist[name]) entries.push({ name, count: wholesaleDist[name], wholesale: true });
		}
		return entries.sort((a, b) => b.count - a.count);
	})();

	// Price index snapshots — load BOTH retail and wholesale rows.
	// Use 26-week window to capture synthetic backfill data (weekly Saturdays).
	// 30 days only covers ~4 weekly snapshots, not enough to render the line chart.
	const sixMonthsAgo = new Date();
	sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 182); // 26 weeks
	const fromDate = sixMonthsAgo.toISOString().split('T')[0];

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const { data: snapshotsRaw } = await (event.locals.supabase as any)
		.from('price_index_snapshots')
		.select(
			'snapshot_date, origin, process, price_avg, price_median, price_min, price_max, price_p25, price_p75, price_stdev, supplier_count, sample_size, wholesale_only, aggregation_tier'
		)
		.gte('snapshot_date', fromDate)
		.eq('aggregation_tier', 1) // origin-level rollups only
		.order('snapshot_date', { ascending: true })
		.limit(1000);

	const snapshots: PriceSnapshot[] = snapshotsRaw ?? [];
	const lastUpdated = snapshots.length ? snapshots[snapshots.length - 1].snapshot_date : null;

	// Origin range data — live cross-section from coffee_catalog, percentiles computed in JS
	const { data: catalogPriceRows } = await event.locals.supabase
		.from('coffee_catalog')
		.select('country, price_per_lb')
		.eq('stocked', true)
		.not('country', 'is', null)
		.not('price_per_lb', 'is', null)
		.gt('price_per_lb', 0)
		.limit(5000);

	const originRangeData: OriginRangeRow[] = (() => {
		if (!catalogPriceRows || catalogPriceRows.length === 0) return [];

		// Group by country
		const byCountry = new Map<string, number[]>();
		for (const row of catalogPriceRows) {
			const price = getPerLbPrice(row);
			if (!row.country || price == null) continue;
			const prices = byCountry.get(row.country) ?? [];
			prices.push(price);
			byCountry.set(row.country, prices);
		}

		// Compute percentile from sorted array
		function percentile(sorted: number[], p: number): number {
			if (sorted.length === 0) return 0;
			if (sorted.length === 1) return sorted[0];
			const idx = p * (sorted.length - 1);
			const lo = Math.floor(idx);
			const hi = Math.ceil(idx);
			return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
		}

		const result: OriginRangeRow[] = [];
		for (const [origin, prices] of byCountry) {
			if (prices.length < 3) continue;
			const sorted = [...prices].sort((a, b) => a - b);
			const avg = sorted.reduce((s, v) => s + v, 0) / sorted.length;
			result.push({
				origin,
				price_min: sorted[0],
				price_max: sorted[sorted.length - 1],
				price_avg: avg,
				price_median: percentile(sorted, 0.5),
				price_q1: percentile(sorted, 0.25),
				price_q3: percentile(sorted, 0.75),
				sample_size: sorted.length
			});
		}

		// Sort by sample_size descending, top 15
		return result.sort((a, b) => b.sample_size - a.sample_size).slice(0, 15);
	})();

	// Supplier comparison data — all stocked beans with price, filtered client-side by origin
	const { data: comparisonBeans } = await event.locals.supabase
		.from('coffee_catalog')
		.select('name, country, processing, price_per_lb, source, wholesale, bag_size')
		.eq('stocked', true)
		.not('price_per_lb', 'is', null)
		.not('country', 'is', null)
		.order('price_per_lb', { ascending: true })
		.limit(2000);

	// --- Supplier health (pre-computed by compute_supplier_stats RPC) ---
	// Read from supplier_daily_stats for the most recent date up to today.
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const { data: supplierStatsRaw } = await (event.locals.supabase as any)
		.from('supplier_daily_stats')
		.select('*')
		.lte('snapshot_date', today)
		.order('snapshot_date', { ascending: false })
		.order('stocked_count', { ascending: false })
		.limit(200);

	interface SupplierStatRow {
		snapshot_date: string;
		source: string;
		stocked_count: number;
		origins_count: number;
		retail_avg: number | null;
		retail_min: number | null;
		retail_max: number | null;
		wholesale_count: number;
		retail_count: number;
	}

	const typedSupplierStats: SupplierStatRow[] = supplierStatsRaw ?? [];

	// Keep only the most recent snapshot date's rows (all suppliers for that date)
	const mostRecentSupplierDate =
		typedSupplierStats.length > 0 ? typedSupplierStats[0].snapshot_date : null;

	const supplierHealth: SupplierHealthRow[] = typedSupplierStats
		.filter((row) => row.snapshot_date === mostRecentSupplierDate)
		.map((row) => ({
			source: row.source,
			stockedCount: row.stocked_count ?? 0,
			origins: row.origins_count ?? 0,
			avgCostLb: row.retail_avg ?? 0,
			minCostLb: row.retail_min ?? 0,
			maxCostLb: row.retail_max ?? 0,
			wholesaleCount: row.wholesale_count ?? 0,
			retailCount: row.retail_count ?? 0
		}));

	// New arrivals — stocked beans with stocked_date in last 30 days (supports 7-day/30-day toggle)
	const thirtyDaysAgoArrivals = new Date();
	thirtyDaysAgoArrivals.setDate(thirtyDaysAgoArrivals.getDate() - 30);

	const { data: recentArrivals30 } = await event.locals.supabase
		.from('coffee_catalog')
		.select('name, country, processing, price_per_lb, source, stocked_date')
		.eq('stocked', true)
		.gte('stocked_date', thirtyDaysAgoArrivals.toISOString().split('T')[0])
		.order('stocked_date', { ascending: false })
		.limit(50);

	// Recent delistings — unstocked beans with unstocked_date in last 30 days
	const thirtyDaysAgoDelistings = new Date();
	thirtyDaysAgoDelistings.setDate(thirtyDaysAgoDelistings.getDate() - 30);

	const { data: recentDelistings30 } = await event.locals.supabase
		.from('coffee_catalog')
		.select('name, country, processing, price_per_lb, source, unstocked_date')
		.eq('stocked', false)
		.gte('unstocked_date', thirtyDaysAgoDelistings.toISOString().split('T')[0])
		.order('unstocked_date', { ascending: false })
		.limit(50);

	const baseUrl = `${event.url.protocol}//${event.url.host}`;
	const schemaService = createSchemaService(baseUrl);
	const schemaData = schemaService.generateSchemaGraph([
		schemaService.generateOrganizationSchema(),
		schemaService.generateDatasetSchema({
			name: 'Purveyors Price Index — Green Coffee Market Data',
			description:
				'Daily green coffee price snapshots from 39+ US importers and roasters. Includes origin pricing, processing method distribution, and supplier comparison data.',
			url: `${baseUrl}/analytics`,
			keywords: [
				'green coffee prices',
				'coffee market data',
				'coffee price index',
				'specialty coffee analytics',
				'coffee origin prices',
				'coffee supplier comparison'
			],
			dateModified: lastUpdated ?? new Date().toISOString().split('T')[0],
			variableMeasured: [
				'Price per pound (USD)',
				'Origin country',
				'Processing method',
				'Supplier count',
				'Sample size'
			]
		})
	]);

	return {
		session,
		role,
		isPpiMember,
		stats: {
			totalBeansTracked: totalBeansTracked ?? 0,
			stockedRetailBeans: stockedRetailBeans ?? 0,
			stockedWholesaleBeans: stockedWholesaleBeans ?? 0,
			totalSuppliers: marketSummary?.total_suppliers ?? 0,
			originsCount: marketSummary?.total_origins ?? 0,
			lastUpdated
		},
		marketSummary: {
			retail_median_7d_change: marketSummary?.retail_median_7d_change ?? null,
			retail_median_30d_change: marketSummary?.retail_median_30d_change ?? null,
			supply_7d_change: marketSummary?.supply_7d_change ?? null,
			supply_30d_change: marketSummary?.supply_30d_change ?? null
		},
		snapshots,
		processDistribution,
		originRangeData,
		recentArrivals: (recentArrivals30 ?? []) as ArrivalBean[],
		recentDelistings: (recentDelistings30 ?? []) as DelistingBean[],
		comparisonBeans: (comparisonBeans ?? []) as ComparisonBean[],
		supplierHealth,
		meta: {
			title: 'Green Coffee Market Analytics | Purveyors Price Index',
			description:
				'Live green coffee price trends, origin analysis, and supplier data from 39+ US importers. Updated daily. Free market intelligence for coffee professionals.',
			keywords:
				'green coffee prices, coffee market data, coffee price index, specialty coffee analytics, coffee origin prices, coffee supplier comparison',
			canonical: `${baseUrl}/analytics`,
			ogTitle: 'Green Coffee Market Analytics — Purveyors Price Index',
			ogDescription:
				'Real-time green coffee price trends by origin, processing methods, and supplier comparison. Data from 39+ US green coffee importers, updated daily.',
			ogImage: `${baseUrl}/purveyors_orange.svg`,
			ogUrl: `${baseUrl}/analytics`,
			ogType: 'website' as const,
			twitterCard: 'summary_large_image' as const,
			twitterTitle: 'Green Coffee Market Analytics — Purveyors',
			twitterDescription:
				'Live green coffee price trends from 39+ US importers. Free market intelligence.',
			schemaData
		}
	};
};
