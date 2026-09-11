import type { PageServerLoad } from './$types';
import { requireParchmentAccess } from '$lib/server/auth';
import { createParchmentServerClient } from '$lib/server/parchmentClient';
import { fetchPortfolioPage, parsePortfolioQuery } from '$lib/server/portfolioPage';
import { redeemParchmentInventoryShareGrant } from '$lib/server/parchmentShares';

export const load: PageServerLoad = async (event) => {
	// Start the purchased portfolio before hydration. Watchlist reads are owned
	// by its tab and cannot hold up the default view or the first response.
	const purchases = (async () => {
		try {
			const share = event.url.searchParams.get('share');
			if (share) {
				event.setHeaders({ 'cache-control': 'no-store' });
				const client = await createParchmentServerClient(event, { mode: 'anonymous' });
				return { data: await redeemParchmentInventoryShareGrant(client, share), error: null };
			}
			const { memberAccess } = await requireParchmentAccess(event);
			const client = await createParchmentServerClient(event, { mode: 'session' });
			return {
				...(await fetchPortfolioPage(
					client,
					parsePortfolioQuery(new URLSearchParams()),
					memberAccess
				)),
				error: null
			};
		} catch (error) {
			console.error('Error loading purchased portfolio:', error);
			return { data: [], error: 'Unable to load your coffee portfolio. Please try again.' };
		}
	})();
	return { purchases };
};
