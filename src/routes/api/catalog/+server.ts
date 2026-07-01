import type { RequestHandler } from './$types';
import { jsonResponse } from '$lib/server/http';
import { forwardCatalogUpstreamHeaders, proxyCatalogList } from '$lib/server/catalogProxy';

// Legacy in-app catalog endpoint — proxies the canonical Parchment /v1/catalog
// surface (ADR-007). The only local logic is a presentation-shaping transform
// that unwraps the canonical envelope into the shape historical app callers
// expect: `{ data, pagination }` when paginated, or a bare `data[]` otherwise.
export const GET: RequestHandler = async (event) => {
	const { status, body, upstream } = await proxyCatalogList(event);
	const headers = new Headers();
	headers.set('X-Purveyors-Canonical-Resource', '/v1/catalog');
	forwardCatalogUpstreamHeaders(upstream, headers);

	if (status >= 400) {
		return jsonResponse(body, { status, headers });
	}

	const canonical = body as { data?: unknown; pagination?: unknown };
	const legacyBody =
		canonical.pagination != null
			? { data: canonical.data, pagination: canonical.pagination }
			: (canonical.data ?? []);

	return jsonResponse(legacyBody, { status, headers });
};
