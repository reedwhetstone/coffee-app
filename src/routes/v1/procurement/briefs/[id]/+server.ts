import type { RequestHandler } from './$types';
import { proxyBriefGet, runProcurementProxyRoute } from '$lib/server/procurementProxy';

export const GET: RequestHandler = async (event) => {
	const successorUrl = `https://api.purveyors.io/v1/procurement/briefs/${event.params.id}`;
	return runProcurementProxyRoute(event, successorUrl, (e) => proxyBriefGet(e, event.params.id));
};
