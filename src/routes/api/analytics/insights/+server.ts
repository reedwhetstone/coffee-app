import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadMarketIndexInsights } from '$lib/server/marketIndex';

export const GET: RequestHandler = async (event) => {
	const market = event.url.searchParams.get('market') ?? 'retail';
	const window = event.url.searchParams.get('window') ?? '7d';
	if (!['retail', 'wholesale', 'all'].includes(market) || !['7d', '30d'].includes(window))
		error(400, 'Invalid market scope');
	const principal = event.locals.principal;
	const isParchmentIntelligence = principal.isAuthenticated && principal.ppiAccess;
	if (market !== 'retail' && !isParchmentIntelligence)
		error(403, 'Parchment Intelligence access required');
	const insights = await loadMarketIndexInsights(event, {
		isParchmentIntelligence,
		scope: { market: market as 'retail' | 'wholesale' | 'all', window: window as '7d' | '30d' },
		includeMetadata: false
	});
	return json(insights, { headers: { 'Cache-Control': 'private, no-store' } });
};
