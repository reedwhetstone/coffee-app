import type { RequestHandler } from './$types';
import { jsonResponse } from '$lib/server/http';
import { forwardCatalogUpstreamHeaders, proxyCatalogList } from '$lib/server/catalogProxy';
import { withCatalogDeprecationHeaders } from '$lib/server/catalogDeprecation';

// Thin proxy in front of the canonical Parchment /v1/catalog surface (ADR-007).
// The caller's own credential is forwarded and the response is relayed verbatim.
export const GET: RequestHandler = async (event) => {
	const { status, body, upstream } = await proxyCatalogList(event);
	const headers = withCatalogDeprecationHeaders('/v1/catalog');
	forwardCatalogUpstreamHeaders(upstream, headers);

	return jsonResponse(body, { status, headers });
};
