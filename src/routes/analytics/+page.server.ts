import type { PageServerLoad } from './$types';
import { getUserRoles } from '$lib/server/auth';

export interface ArrivalBean {
	name: string;
	country: string | null;
	processing: string | null;
	cost_lb: number | null;
	source: string | null;
	stocked_date: string | null;
}

export interface DelistingBean {
	name: string;
	country: string | null;
	processing: string | null;
	cost_lb: number | null;
	source: string | null;
	unstocked_date: string | null;
}
export interface PriceSnapshot {
	snapshot_date: string;
	origin: string;
	process: string | null;
	price_avg: number | null;
	price_min: number | null;
	price_max: number | null;
	supplier_count: number;
	sample_size: number;
	wholesale_only: boolean;
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

	// Catalog stats — use count queries to avoid Supabase 1000-row default limit

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

	// Distinct suppliers and origins — need to fetch columns for uniqueness
	// Use a larger limit to capture all sources
	const { data: supplierRows } = await event.locals.supabase
		.from('coffee_catalog')
		.select('source')
		.eq('stocked', true)
		.not('source', 'is', null)
		.limit(5000);
	const totalSuppliers = new Set((supplierRows ?? []).map((r) => r.source)).size;

	const { data: originRows } = await event.locals.supabase
		.from('coffee_catalog')
		.select('country')
		.eq('stocked', true)
		.not('country', 'is', null)
		.limit(5000);
	const originsCount = new Set((originRows ?? []).map((r) => r.country)).size;

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

	// Price index snapshots — load BOTH retail and wholesale rows
	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
	const fromDate = thirtyDaysAgo.toISOString().split('T')[0];

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const { data: snapshotsRaw } = await (event.locals.supabase as any)
		.from('price_index_snapshots')
		.select(
			'snapshot_date, origin, process, price_avg, price_min, price_max, supplier_count, sample_size, wholesale_only'
		)
		.gte('snapshot_date', fromDate)
		.order('snapshot_date', { ascending: true })
		.limit(1000);

	const snapshots: PriceSnapshot[] = snapshotsRaw ?? [];
	const lastUpdated = snapshots.length ? snapshots[snapshots.length - 1].snapshot_date : null;

	// Origin range data — live cross-section from coffee_catalog, percentiles computed in JS
	const { data: catalogPriceRows } = await event.locals.supabase
		.from('coffee_catalog')
		.select('country, cost_lb')
		.eq('stocked', true)
		.not('country', 'is', null)
		.not('cost_lb', 'is', null)
		.gt('cost_lb', 0)
		.limit(5000);

	const originRangeData: OriginRangeRow[] = (() => {
		if (!catalogPriceRows || catalogPriceRows.length === 0) return [];

		// Group by country
		const byCountry = new Map<string, number[]>();
		for (const row of catalogPriceRows) {
			if (!row.country || row.cost_lb == null) continue;
			const prices = byCountry.get(row.country) ?? [];
			prices.push(row.cost_lb as number);
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

	// New arrivals — stocked beans with stocked_date in last 30 days (7d/30d client toggle)
	const thirtyDaysAgoArrivals = new Date();
	thirtyDaysAgoArrivals.setDate(thirtyDaysAgoArrivals.getDate() - 30);

	const { data: recentArrivals30 } = await event.locals.supabase
		.from('coffee_catalog')
		.select('name, country, processing, cost_lb, source, stocked_date')
		.eq('stocked', true)
		.gte('stocked_date', thirtyDaysAgoArrivals.toISOString().split('T')[0])
		.order('stocked_date', { ascending: false })
		.limit(50);

	// Recent delistings — unstocked beans with unstocked_date in last 30 days
	const thirtyDaysAgoDelistings = new Date();
	thirtyDaysAgoDelistings.setDate(thirtyDaysAgoDelistings.getDate() - 30);

	const { data: recentDelistings30 } = await event.locals.supabase
		.from('coffee_catalog')
		.select('name, country, processing, cost_lb, source, unstocked_date')
		.eq('stocked', false)
		.gte('unstocked_date', thirtyDaysAgoDelistings.toISOString().split('T')[0])
		.order('unstocked_date', { ascending: false })
		.limit(50);

	return {
		session,
		role,
		isPpiMember,
		stats: {
			totalBeansTracked: totalBeansTracked ?? 0,
			stockedRetailBeans: stockedRetailBeans ?? 0,
			stockedWholesaleBeans: stockedWholesaleBeans ?? 0,
			totalSuppliers,
			originsCount,
			lastUpdated
		},
		snapshots,
		processDistribution,
		originRangeData,
		recentArrivals: (recentArrivals30 ?? []) as ArrivalBean[],
		recentDelistings: (recentDelistings30 ?? []) as DelistingBean[]
	};
};
