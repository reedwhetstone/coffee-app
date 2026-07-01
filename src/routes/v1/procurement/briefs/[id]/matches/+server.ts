import type { RequestHandler } from './$types';
import { proxyBriefMatches, runProcurementProxyRoute } from '$lib/server/procurementProxy';

export const GET: RequestHandler = async (event) => {
	const successorUrl = `https://api.purveyors.io/v1/procurement/briefs/${event.params.id}/matches`;
	return runProcurementProxyRoute(event, successorUrl, (e) =>
		proxyBriefMatches(e, event.params.id)
	);
};
