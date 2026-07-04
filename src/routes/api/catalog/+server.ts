import type { RequestHandler } from './$types';
import { jsonResponse } from '$lib/server/http';
import {
	catalogProxyErrorResponse,
	forwardCatalogUpstreamHeaders,
	proxyCatalogList
} from '$lib/server/catalogProxy';
import { MAX_CATALOG_PAGE_LIMIT } from '$lib/constants/catalog';
import { isApiKeyPrincipal, resolvePrincipal } from '$lib/server/principal';
import { resolveCatalogCredentialMode } from '$lib/server/parchmentClient';

// First-party in-app catalog endpoint — proxies the canonical Parchment
// /v1/catalog surface for browser/SSR UI refreshes (ADR-007, PADR-0015). The
// only local logic is credential brokering plus a presentation-shaping transform
// that unwraps the canonical envelope into the `{ data, pagination }` shape
// historical app callers expect. Parchment always returns a pagination object,
// so the response is always the paginated envelope. To preserve the pre-proxy
// full-list contract for consumers that never page (e.g. the bean picker in
// src/routes/beans), an unparameterized request injects a high default limit.
export const GET: RequestHandler = async (event) => {
	const headers = new Headers();
	headers.set('X-Purveyors-Canonical-Resource', '/v1/catalog');

	// Reject a present-but-invalid Authorization header before proxying. The auth
	// hook leaves those requests anonymous, and session-mode proxying would
	// otherwise forward no credential and silently downgrade the caller.
	const principal = await resolvePrincipal(event);
	if (event.request.headers.has('Authorization') && !principal.isAuthenticated) {
		return jsonResponse(
			{ error: 'Authentication required', message: 'Authentication required' },
			{ status: 401, headers }
		);
	}

	let proxied: Awaited<ReturnType<typeof proxyCatalogList>>;
	try {
		proxied = await proxyCatalogList(event, {
			defaultLimit: MAX_CATALOG_PAGE_LIMIT,
			mode: resolveCatalogCredentialMode(event.locals),
			preferHandling: isApiKeyPrincipal(principal) ? 'inherit' : 'lenient'
		});
	} catch (error) {
		// When Parchment is unconfigured (e.g. CI/preview environments without
		// PARCHMENT_API_BASE_URL), the client factory throws ParchmentConfigError
		// before any request is made. Degrade to an empty catalog instead of a 500
		// so first-party consumers (the bean picker, dropdowns) still load — the
		// same graceful-degradation contract the catalog page applies for
		// ParchmentConfigError (see isCatalogSchemaUnavailableError in
		// src/routes/catalog/+page.server.ts). HTTP error responses from Parchment
		// are still relayed below; thrown network/proxy failures keep the catalog
		// JSON error envelope instead of falling through to SvelteKit's 500 page.
		if (error instanceof Error && error.name === 'ParchmentConfigError') {
			return jsonResponse({ data: [], pagination: null }, { status: 200, headers });
		}
		const { status, body } = catalogProxyErrorResponse(error);
		return jsonResponse(body, { status, headers });
	}

	const { status, body, upstream } = proxied;
	forwardCatalogUpstreamHeaders(upstream, headers);

	if (status >= 400) {
		return jsonResponse(body, { status, headers });
	}

	const canonical = body as { data?: unknown; pagination?: unknown; meta?: unknown };
	const legacyBody = {
		data: canonical.data,
		pagination: canonical.pagination,
		meta: canonical.meta
	};

	return jsonResponse(legacyBody, { status, headers });
};
