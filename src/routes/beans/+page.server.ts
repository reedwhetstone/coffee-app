import type { PageServerLoad } from './$types';
import { getPageAuthState } from '$lib/server/pageAuth';
import { getCatalogItemsByIds } from '$lib/data/catalog';
import { getTrackedLotSummaries, type TrackedLotSummary } from '$lib/server/trackedLots';

export const load: PageServerLoad = async ({ locals }) => {
	const { user, role } = getPageAuthState(locals);
	const ppiAccess =
		locals.principal?.isAuthenticated === true ? locals.principal.ppiAccess === true : false;
	const isMember = role === 'member' || role === 'admin';
	const hasSourcingAccess = isMember || ppiAccess;

	// Bookmarked (watchlist) lots get their own portfolio tab, distinct from purchases.
	let trackedLots: TrackedLotSummary[] = [];
	let trackedCatalog: Record<string, unknown>[] = [];
	if (user && hasSourcingAccess) {
		try {
			trackedLots = await getTrackedLotSummaries(locals.supabase, user.id, 100);
			trackedCatalog = (await getCatalogItemsByIds(
				locals.supabase,
				trackedLots.map((lot) => lot.catalogId)
			)) as unknown as Record<string, unknown>[];
		} catch (error) {
			console.error('Error loading portfolio watchlist:', error);
		}
	}

	return {
		role,
		ppiAccess,
		user: user ? { id: user.id } : null,
		trackedLots,
		trackedCatalog
	};
};
