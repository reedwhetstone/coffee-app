import type { RequestHandler } from './$types';
import { jsonResponse } from '$lib/server/http';
import {
	forwardProcurementUpstreamHeaders,
	procurementProxyErrorResponse,
	proxyBriefMatches
} from '$lib/server/procurementProxy';
import { resolvePrincipal } from '$lib/server/principal';

// Thin proxy for the canonical Parchment /v1/procurement/briefs/{id}/matches
// surface (PADR-0012). Parchment's M3 matches port reproduces the deterministic
// computeMatchReasons + catalog projection; coffee-app only forwards page/limit.
export const GET: RequestHandler = async (event) => {
	const principal = await resolvePrincipal(event);
	if (event.request.headers.has('Authorization') && !principal.isAuthenticated) {
		return jsonResponse(
			{ error: 'Authentication required', message: 'Authentication required' },
			{ status: 401 }
		);
	}

	let proxied: Awaited<ReturnType<typeof proxyBriefMatches>>;
	try {
		proxied = await proxyBriefMatches(event, event.params.id, event.url);
	} catch (error) {
		const { status, body } = procurementProxyErrorResponse(error);
		return jsonResponse(body, { status, headers: new Headers() });
	}

	const { status, body, upstream } = proxied;
	const headers = new Headers();
	forwardProcurementUpstreamHeaders(upstream, headers);
	return jsonResponse(body, { status, headers });
};
