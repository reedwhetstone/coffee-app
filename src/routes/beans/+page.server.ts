import type { PageServerLoad } from './$types';
import { getPageAuthState } from '$lib/server/pageAuth';
import { getTrackedLotSummaries, type TrackedLotSummary } from '$lib/server/trackedLots';
import { createParchmentServerClient } from '$lib/server/parchmentClient';
import { fetchParchmentCatalogItemsByIds } from '$lib/server/parchmentCatalog';

export const load: PageServerLoad = async (event) => {
	const { locals } = event;
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
			const parchment = await createParchmentServerClient(event);
			trackedCatalog = (await fetchParchmentCatalogItemsByIds(
				parchment,
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
