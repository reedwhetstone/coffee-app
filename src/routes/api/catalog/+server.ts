import type { RequestHandler } from './$types';
import { jsonResponse } from '$lib/server/http';
import { forwardCatalogUpstreamHeaders, proxyCatalogList } from '$lib/server/catalogProxy';
import { MAX_CATALOG_PAGE_LIMIT } from '$lib/constants/catalog';

// Legacy in-app catalog endpoint — proxies the canonical Parchment /v1/catalog
// surface (ADR-007). The only local logic is a presentation-shaping transform
// that unwraps the canonical envelope into the `{ data, pagination }` shape
// historical app callers expect. Parchment always returns a pagination object,
// so the response is always the paginated envelope. To preserve the pre-proxy
// full-list contract for consumers that never page (e.g. the bean picker in
// src/routes/beans), an unparameterized request injects a high default limit.
export const GET: RequestHandler = async (event) => {
	const { status, body, upstream } = await proxyCatalogList(event, {
		defaultLimit: MAX_CATALOG_PAGE_LIMIT
	});
	const headers = new Headers();
	headers.set('X-Purveyors-Canonical-Resource', '/v1/catalog');
	forwardCatalogUpstreamHeaders(upstream, headers);

	if (status >= 400) {
		return jsonResponse(body, { status, headers });
	}

	const canonical = body as { data?: unknown; pagination?: unknown };
	const legacyBody = { data: canonical.data, pagination: canonical.pagination };

	return jsonResponse(legacyBody, { status, headers });
};
