import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { AuthError, requireApiKeyAccess } from '$lib/server/auth';
import { jsonResponse } from '$lib/server/http';
import {
	catalogProxyErrorResponse,
	forwardCatalogUpstreamHeaders,
	proxyCatalogList
} from '$lib/server/catalogProxy';
import { applyBffCatalogNoStore } from '$lib/server/cacheHeaders';

const LEGACY_CATALOG_API_HEADERS = {
	Deprecation: 'true',
	Link: '</v1/catalog>; rel="successor-version"',
	Sunset: 'Thu, 31 Dec 2026 23:59:59 GMT'
} as const;

// This alias is API-key gated (metered), so every response is private/no-store —
// metered API-key catalog reads must never sit behind a shared cache.
function withLegacyCatalogHeaders(headers: HeadersInit = {}): Headers {
	const merged = new Headers(headers);

	for (const [name, value] of Object.entries(LEGACY_CATALOG_API_HEADERS)) {
		merged.set(name, value);
	}
	applyBffCatalogNoStore(merged);

	return merged;
}

// Legacy endpoint — proxies the canonical Parchment /v1/catalog surface (ADR-007).
// The local API-key gate is retained so anonymous and session-only callers keep
// getting 401/403 here; ADR-004 narrows this alias to API-key callers only.
// A 308 redirect was attempted here previously but does not work under
// adapter-vercel: the framework converts it to HTTP 200 with an empty body,
// silently breaking callers who followed the redirect. Proxying directly is the
// only reliable option under this adapter.
export const GET: RequestHandler = async (event) => {
	try {
		await requireApiKeyAccess(event, {
			requiredPlan: 'viewer',
			requiredScope: 'catalog:read'
		});
	} catch (error) {
		if (error instanceof AuthError) {
			return json(
				{
					error: error.status === 403 ? 'Insufficient permissions' : 'Authentication required',
					message: error.message
				},
				{
					status: error.status,
					headers: withLegacyCatalogHeaders()
				}
			);
		}

		throw error;
	}

	// Surface config/network failures as the catalog JSON 5xx contract (with the
	// legacy deprecation headers) instead of SvelteKit's generic 500 HTML page.
	let proxied: Awaited<ReturnType<typeof proxyCatalogList>>;
	try {
		proxied = await proxyCatalogList(event);
	} catch (error) {
		const { status, body } = catalogProxyErrorResponse(error);
		return json(body, { status, headers: withLegacyCatalogHeaders() });
	}

	const { status, body, upstream } = proxied;
	const headers = withLegacyCatalogHeaders();
	forwardCatalogUpstreamHeaders(upstream, headers);

	return jsonResponse(body, { status, headers });
};
