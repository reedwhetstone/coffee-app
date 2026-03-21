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

	// Catalog stats — stocked retail beans (always public)
	const { data: catalogRows } = await event.locals.supabase
		.from('coffee_catalog')
		.select('source, country, processing')
		.eq('stocked', true)
		.eq('wholesale', false);

	const totalBeans = catalogRows?.length ?? 0;
	const totalSuppliers = new Set((catalogRows ?? []).map((r) => r.source).filter(Boolean)).size;
	const originsCount = new Set((catalogRows ?? []).map((r) => r.country).filter(Boolean)).size;

	// Processing method distribution (from catalog — always has data)
	const rawDist: Record<string, number> = {};
	for (const row of catalogRows ?? []) {
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
		stats: { totalBeans, totalSuppliers, originsCount, lastUpdated },
		snapshots,
		processDistribution
	};
};
