import type { PageServerLoad } from './$types';
import { buildPublicMeta, resolvePublicPageSocialImage } from '$lib/seo/meta';
import { resolvePrincipal } from '$lib/server/principal';
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

const SNAPSHOT_PAGE_SIZE = 1000;
const SNAPSHOT_SELECT =
	'snapshot_date, origin, process, price_avg, price_median, price_min, price_max, price_p25, price_p75, price_stdev, supplier_count, sample_size, wholesale_only, aggregation_tier';
// Keep synthetic backfill rows in the analytics history for now. Because real and
// synthetic rows can coexist for the same segment/date, pagination must use a
// total order that includes the schema differentiators plus a unique tiebreaker.
const SNAPSHOT_ORDER_COLUMNS = [
	'snapshot_date',
	'origin',
	'process',
	'grade',
	'wholesale_only',
	'synthetic',
	'id'
] as const;

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

export async function _loadPriceSnapshotsPaginated({
	supabase,
	fromDate
}: {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	supabase: any;
	fromDate: string;
}): Promise<PriceSnapshot[]> {
	const snapshots: PriceSnapshot[] = [];

	for (let start = 0; ; start += SNAPSHOT_PAGE_SIZE) {
		const end = start + SNAPSHOT_PAGE_SIZE - 1;
		let query = supabase
			.from('price_index_snapshots')
			.select(SNAPSHOT_SELECT)
			.gte('snapshot_date', fromDate)
			.eq('aggregation_tier', 1);

		for (const column of SNAPSHOT_ORDER_COLUMNS) {
			query = query.order(column, { ascending: true });
		}

		const { data, error } = await query.range(start, end);

		if (error) {
			const pageNumber = Math.floor(start / SNAPSHOT_PAGE_SIZE) + 1;
			throw new Error(
				`Failed to load analytics price snapshots page ${pageNumber}: ${error.message}`,
				{ cause: error }
			);
		}

		const page = (data ?? []) as PriceSnapshot[];

		if (page.length === 0) break;

		snapshots.push(...page);

		if (page.length < SNAPSHOT_PAGE_SIZE) break;
	}

	return snapshots;
}

export const load: PageServerLoad = async (event) => {
	// Resolve principal to get explicit ppiAccess entitlement.
	// Falls back to ppi-member pseudo-role detection during the migration period.
	const principal = await resolvePrincipal(event);
	const isPpiMember = principal.isAuthenticated ? principal.ppiAccess : false;

	const today = new Date().toISOString().split('T')[0];
	const supabase = event.locals.supabase;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const sb = supabase as any;

	// ─── PUBLIC QUERIES (run for all visitors, in parallel) ─────────────────────
	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
	const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

	const ninetyDaysAgo = new Date();
	ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
	const fromDate = ninetyDaysAgo.toISOString().split('T')[0];

	// PPI members get up to 365 days of snapshot data for extended trend views.
	const snapshotFromDate = isPpiMember
		? (() => {
				const d = new Date();
				d.setDate(d.getDate() - 365);
				return d.toISOString().split('T')[0];
			})()
		: fromDate;

	const [
		{ data: marketSummaryRaw },
		{ count: totalBeansTracked },
		{ count: stockedRetailBeans },
		{ count: stockedWholesaleBeans },
		{ data: processingRows },
		{ data: catalogPriceRows },
		{ data: recentArrivals30 },
		{ data: recentDelistings30 },
		snapshotsRaw
	] = await Promise.all([
		// Market summary (pre-computed)
		sb
			.from('market_daily_summary')
			.select('*')
			.lte('snapshot_date', today)
			.order('snapshot_date', { ascending: false })
			.limit(1)
			.maybeSingle(),
		// Total beans tracked
		supabase.from('coffee_catalog').select('*', { count: 'exact', head: true }),
		// Stocked retail count
		supabase
			.from('coffee_catalog')
			.select('*', { count: 'exact', head: true })
			.eq('stocked', true)
			.eq('wholesale', false),
		// Stocked wholesale count
		supabase
			.from('coffee_catalog')
			.select('*', { count: 'exact', head: true })
			.eq('stocked', true)
			.eq('wholesale', true),
		// Processing method distribution
		supabase
			.from('coffee_catalog')
			.select('processing, wholesale')
			.eq('stocked', true)
			.not('processing', 'is', null)
			.limit(5000),
		// Origin range data (live cross-section)
		supabase
			.from('coffee_catalog')
			.select('country, price_per_lb')
			.eq('stocked', true)
			.not('country', 'is', null)
			.not('price_per_lb', 'is', null)
			.gt('price_per_lb', 0)
			.limit(5000),
		// Recent arrivals (30 days)
		supabase
			.from('coffee_catalog')
			.select('name, country, processing, price_per_lb, source, stocked_date')
			.eq('stocked', true)
			.gte('stocked_date', thirtyDaysAgoStr)
			.order('stocked_date', { ascending: false })
			.limit(50),
		// Recent delistings (30 days)
		supabase
			.from('coffee_catalog')
			.select('name, country, processing, price_per_lb, source, unstocked_date')
			.eq('stocked', false)
			.gte('unstocked_date', thirtyDaysAgoStr)
			.order('unstocked_date', { ascending: false })
			.limit(50),
		// Price index snapshots — 90 days public, 365 days for PPI members
		_loadPriceSnapshotsPaginated({
			supabase: sb,
			fromDate: snapshotFromDate
		})
	]);

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

	const lastUpdated = marketSummary?.snapshot_date ?? null;

	// Process distribution
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
		const entries: ProcessBucket[] = [];
		const allKeys = new Set([...Object.keys(retailDist), ...Object.keys(wholesaleDist)]);
		for (const name of allKeys) {
			if (retailDist[name]) entries.push({ name, count: retailDist[name], wholesale: false });
			if (wholesaleDist[name]) entries.push({ name, count: wholesaleDist[name], wholesale: true });
		}
		return entries.sort((a, b) => b.count - a.count);
	})();

	// Origin range data
	const originRangeData: OriginRangeRow[] = (() => {
		if (!catalogPriceRows || catalogPriceRows.length === 0) return [];

		const byCountry = new Map<string, number[]>();
		for (const row of catalogPriceRows) {
			const price = getPerLbPrice(row);
			if (!row.country || price == null) continue;
			const prices = byCountry.get(row.country) ?? [];
			prices.push(price);
			byCountry.set(row.country, prices);
		}

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

		return result.sort((a, b) => b.sample_size - a.sample_size).slice(0, 50);
	})();

	// ─── PPI MEMBER QUERIES (only run for authenticated members) ────────────────
	const snapshots: PriceSnapshot[] = snapshotsRaw ?? [];
	let comparisonBeans: ComparisonBean[] = [];
	let supplierHealth: SupplierHealthRow[] = [];

	if (isPpiMember) {
		const [{ data: comparisonBeansRaw }, { data: supplierStatsRaw }] = await Promise.all([
			// Supplier comparison beans
			supabase
				.from('coffee_catalog')
				.select('name, country, processing, price_per_lb, source, wholesale, bag_size')
				.eq('stocked', true)
				.not('price_per_lb', 'is', null)
				.not('country', 'is', null)
				.order('price_per_lb', { ascending: true })
				.limit(2000),
			// Supplier health (pre-computed)
			sb
				.from('supplier_daily_stats')
				.select('*')
				.lte('snapshot_date', today)
				.order('snapshot_date', { ascending: false })
				.order('stocked_count', { ascending: false })
				.limit(200)
		]);

		comparisonBeans = (comparisonBeansRaw ?? []) as ComparisonBean[];

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
		const mostRecentSupplierDate =
			typedSupplierStats.length > 0 ? typedSupplierStats[0].snapshot_date : null;

		supplierHealth = typedSupplierStats
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
	}

	const baseUrl = `${event.url.protocol}//${event.url.host}`;
	const schemaService = createSchemaService(baseUrl);
	const schemaData = schemaService.generateSchemaGraph([
		schemaService.generateOrganizationSchema(),
		schemaService.generateDatasetSchema({
			name: 'Parchment Intelligence — Green Coffee Market Data',
			description:
				'Daily green coffee market snapshots from 39+ US importers and roasters. Includes origin pricing, processing method distribution, and supplier comparison data.',
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

	const session = event.locals.session ?? null;
	const role = event.locals.role ?? 'viewer';

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
		comparisonBeans,
		supplierHealth,
		meta: buildPublicMeta({
			baseUrl,
			path: '/analytics',
			title: 'Green Coffee Market Intelligence | Parchment Intelligence',
			description:
				'Live green coffee price trends, origin analysis, and supplier data from 39+ US importers. Explore the free market snapshot, then unlock Parchment Intelligence for the full analytics layer.',
			keywords: [
				'green coffee prices',
				'coffee market data',
				'coffee price index',
				'specialty coffee analytics',
				'coffee origin prices',
				'coffee supplier comparison'
			],
			ogTitle: 'Green Coffee Market Intelligence — Parchment Intelligence',
			ogDescription:
				'Real-time green coffee price trends by origin, processing methods, and supplier comparison. Explore the free market snapshot, then unlock Parchment Intelligence for full access.',
			twitterTitle: 'Green Coffee Market Analytics — Purveyors',
			twitterDescription:
				'Live green coffee price trends from 39+ US importers. Free market snapshot plus a deeper intelligence tier.',
			image: resolvePublicPageSocialImage({
				baseUrl,
				preferredPath: '/og/analytics.jpg',
				alt: 'Purveyors analytics social preview card'
			}),
			schemaData
		})
	};
};
