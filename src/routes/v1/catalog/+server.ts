import type { RequestHandler } from './$types';
import { jsonResponse } from '$lib/server/http';
import {
	catalogProxyErrorResponse,
	forwardCatalogUpstreamHeaders,
	proxyCatalogList
} from '$lib/server/catalogProxy';
import { resolvePrincipal } from '$lib/server/principal';

// Thin proxy in front of the canonical Parchment /v1/catalog surface (ADR-007).
// The caller's own credential is forwarded and the response is relayed verbatim.
//
// This is the stable, canonical public catalog contract, so it deliberately does
// NOT advertise Deprecation/Sunset headers — only the legacy aliases (e.g.
// /api/catalog-api) are deprecated in favor of this route.
export const GET: RequestHandler = async (event) => {
	// Reject a present-but-invalid Authorization header before proxying. The auth
	// hook leaves such a request anonymous, and `session` mode forwards no
	// credential, so without this guard an invalid/expired bearer would silently be
	// served as an anonymous catalog read instead of the documented 401 (see
	// scripts/verify-catalog-http-contract.ts). Mirrors the pre-proxy route and the
	// /v1/catalog/{id}/similar handler.
	const principal = await resolvePrincipal(event);
	if (event.request.headers.has('Authorization') && !principal.isAuthenticated) {
		return jsonResponse(
			{ error: 'Authentication required', message: 'Authentication required' },
			{ status: 401 }
		);
	}

	// Convert config/network failures into the catalog JSON 5xx contract instead of
	// letting the throw fall through to SvelteKit's generic 500 HTML page.
	let proxied: Awaited<ReturnType<typeof proxyCatalogList>>;
	try {
		proxied = await proxyCatalogList(event);
	} catch (error) {
		const { status, body } = catalogProxyErrorResponse(error);
		return jsonResponse(body, { status, headers: new Headers() });
	}

	const { status, body, upstream } = proxied;
	const headers = new Headers();
	forwardCatalogUpstreamHeaders(upstream, headers);

	return jsonResponse(body, { status, headers });
};
