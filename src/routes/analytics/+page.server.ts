import type { PageServerLoad } from './$types';
import { getUserRoles } from '$lib/server/auth';

export interface PriceSnapshot {
	snapshot_date: string;
	origin: string;
	process: string | null;
	price_avg: number | null;
	price_min: number | null;
	price_max: number | null;
	supplier_count: number;
	sample_size: number;
}

export interface ProcessBucket {
	name: string;
	count: number;
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

	// Currently stocked (retail only)
	const { count: stockedBeans } = await event.locals.supabase
		.from('coffee_catalog')
		.select('*', { count: 'exact', head: true })
		.eq('stocked', true)
		.eq('wholesale', false);

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

	// Processing method distribution (from stocked catalog)
	const { data: processingRows } = await event.locals.supabase
		.from('coffee_catalog')
		.select('processing')
		.eq('stocked', true)
		.eq('wholesale', false)
		.not('processing', 'is', null)
		.limit(5000);

	const rawDist: Record<string, number> = {};
	for (const row of processingRows ?? []) {
		const key = normalizeProcess(row.processing);
		rawDist[key] = (rawDist[key] ?? 0) + 1;
	}
	const processDistribution: ProcessBucket[] = Object.entries(rawDist)
		.sort((a, b) => b[1] - a[1])
		.map(([name, count]) => ({ name, count }));

	// Price index snapshots — table added 2026-03-21, not yet in generated DB types
	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
	const fromDate = thirtyDaysAgo.toISOString().split('T')[0];

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const { data: snapshotsRaw } = await (event.locals.supabase as any)
		.from('price_index_snapshots')
		.select(
			'snapshot_date, origin, process, price_avg, price_min, price_max, supplier_count, sample_size'
		)
		.eq('wholesale_only', false)
		.gte('snapshot_date', fromDate)
		.order('snapshot_date', { ascending: true })
		.limit(500);

	const snapshots: PriceSnapshot[] = snapshotsRaw ?? [];
	const lastUpdated = snapshots.length ? snapshots[snapshots.length - 1].snapshot_date : null;

	return {
		session,
		role,
		isPpiMember,
		stats: {
			totalBeansTracked: totalBeansTracked ?? 0,
			stockedBeans: stockedBeans ?? 0,
			totalSuppliers,
			originsCount,
			lastUpdated
		},
		snapshots,
		processDistribution
	};
};
