import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { jsonResponse } from '$lib/server/http';
import {
	catalogProxyErrorResponse,
	forwardCatalogUpstreamHeaders,
	proxyCatalogMap
} from '$lib/server/catalogProxy';
import { resolvePrincipal } from '$lib/server/principal';
import { resolveCatalogCredentialMode } from '$lib/server/parchmentClient';
import { applyBffCatalogCacheHeaders, applyBffCatalogNoStore } from '$lib/server/cacheHeaders';
import { resolveCatalogMapPreviewEnabled } from '$lib/server/catalogMapPreview';

/**
 * First-party catalog map BFF.
 *
 * The browser never receives a Parchment credential and never calls the public
 * API directly. Anonymous website requests use the server-held public-demo key;
 * signed-in requests forward the canonical httpOnly session credential. The
 * response is relayed without local aggregation or authorization policy.
 */
export const GET: RequestHandler = async (event) => {
	const headers = new Headers({ 'X-Purveyors-Canonical-Resource': '/v1/catalog/map' });

	if (!resolveCatalogMapPreviewEnabled(env)) {
		applyBffCatalogNoStore(headers);
		return jsonResponse(
			{
				error: {
					code: 'catalog_map_preview_disabled',
					message: 'Catalog map preview is unavailable.'
				}
			},
			{ status: 404, headers }
		);
	}

	// This is a browser BFF, not a second public API surface. Reject bearer input
	// even when valid so browser credential custody remains cookie/demo-key only.
	if (event.request.headers.has('Authorization')) {
		applyBffCatalogNoStore(headers);
		return jsonResponse(
			{
				error: {
					code: 'session_required',
					message: 'Authorization headers are not accepted by the catalog map browser route.'
				}
			},
			{ status: 401, headers }
		);
	}

	const principal = await resolvePrincipal(event);

	try {
		const proxied = await proxyCatalogMap(event, {
			mode: resolveCatalogCredentialMode(event.locals),
			preferHandling: 'lenient'
		});
		forwardCatalogUpstreamHeaders(proxied.upstream, headers);

		if (proxied.status >= 400) {
			applyBffCatalogNoStore(headers);
			return jsonResponse(proxied.body, { status: proxied.status, headers });
		}

		applyBffCatalogCacheHeaders(headers, principal.isAuthenticated);
		return jsonResponse(proxied.body, { status: proxied.status, headers });
	} catch (error) {
		applyBffCatalogNoStore(headers);
		const { status, body } = catalogProxyErrorResponse(error);
		return jsonResponse(body, { status, headers });
	}
};
