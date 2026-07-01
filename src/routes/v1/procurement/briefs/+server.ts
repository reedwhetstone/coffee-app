import type { RequestHandler } from './$types';
import {
	proxyBriefCreate,
	proxyBriefsList,
	runProcurementProxyRoute
} from '$lib/server/procurementProxy';

const SUCCESSOR_URL = 'https://api.purveyors.io/v1/procurement/briefs';

// Legacy coffee-app proxy for the canonical Parchment procurement/briefs route
// (ADR-007). Parchment owns auth, member/plan entitlement, criteria validation,
// persistence, and matching; these handlers only keep the old coffee-app URL
// alive while relaying the upstream response and migration headers.
export const GET: RequestHandler = async (event) => {
	return runProcurementProxyRoute(event, SUCCESSOR_URL, proxyBriefsList);
};

export const POST: RequestHandler = async (event) => {
	return runProcurementProxyRoute(event, SUCCESSOR_URL, proxyBriefCreate);
};
