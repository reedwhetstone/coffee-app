import type { RequestHandler } from './$types';
import { jsonResponse } from '$lib/server/http';
import {
	forwardProcurementUpstreamHeaders,
	procurementProxyErrorResponse,
	proxyBriefGet
} from '$lib/server/procurementProxy';
import { resolvePrincipal } from '$lib/server/principal';

// Thin proxy for the canonical Parchment /v1/procurement/briefs/{id} surface
// (PADR-0012). Parchment owns lookup, ownership scoping, and the 404 contract.
export const GET: RequestHandler = async (event) => {
	const principal = await resolvePrincipal(event);
	if (event.request.headers.has('Authorization') && !principal.isAuthenticated) {
		return jsonResponse(
			{ error: 'Authentication required', message: 'Authentication required' },
			{ status: 401 }
		);
	}

	let proxied: Awaited<ReturnType<typeof proxyBriefGet>>;
	try {
		proxied = await proxyBriefGet(event, event.params.id);
	} catch (error) {
		const { status, body } = procurementProxyErrorResponse(error);
		return jsonResponse(body, { status, headers: new Headers() });
	}

	const { status, body, upstream } = proxied;
	const headers = new Headers();
	forwardProcurementUpstreamHeaders(upstream, headers);
	return jsonResponse(body, { status, headers });
};
