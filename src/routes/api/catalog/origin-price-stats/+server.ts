import { json, type RequestHandler } from '@sveltejs/kit';
import type { ParchmentClient } from '@purveyors/sdk';
import { resolveCatalogVisibility } from '$lib/server/catalogVisibility';
import {
	createParchmentServerClient,
	resolveCatalogCredentialMode
} from '$lib/server/parchmentClient';
import { catalogProxyErrorResponse } from '$lib/server/catalogProxy';
import { applyBffCatalogCacheHeaders, applyBffCatalogNoStore } from '$lib/server/cacheHeaders';

// The origin-price-stats query only models the wholesale view params; Parchment
// derives publicOnly (and the rest of the visibility scope) from the forwarded
// credential server-side (PADR-0012 / ADR-007).
type CatalogOriginPriceStatsQuery = NonNullable<
	Parameters<ParchmentClient['catalog']['originPriceStats']>[0]
>;

/**
 * Per-origin catalog price context for the catalog UI.
 *
 * Repointed off the local Supabase aggregation onto Parchment's canonical
 * `/v1/catalog/origin-price-stats` endpoint: the API owns catalog visibility and
 * the percentile aggregation. This BFF route forwards the same credential mode
 * the SSR catalog loader resolves via {@link resolveCatalogCredentialMode} (so an
 * anonymous `/catalog` visitor's stats refresh reads through the public-demo key
 * instead of a token-less `session` call that Parchment can reject with 401) plus
 * the resolved wholesale view params, then relays the upstream `originPriceStats`
 * data unchanged. `meta.access` is still derived locally from the request via
 * {@link resolveCatalogVisibility} so the outward JSON shape the catalog page
 * consumes is preserved exactly.
 */
export const GET: RequestHandler = async (event) => {
	const { locals, url } = event;
	const visibility = resolveCatalogVisibility({
		session: locals.session,
		role: locals.role,
		showWholesaleRequested: url.searchParams.has('showWholesale')
			? url.searchParams.get('showWholesale') === 'true'
			: undefined,
		wholesaleOnlyRequested: url.searchParams.get('wholesaleOnly') === 'true'
	});

	// Session-aware cache signal, derived the same way as the credential mode
	// (authenticated principal or a session cookie ⇒ private/no-store). Avoids an
	// extra admin-client round-trip on this UI stats-refresh route.
	const isAuthenticated = locals.principal?.isAuthenticated === true || Boolean(locals.session);

	try {
		const client = await createParchmentServerClient(event, {
			mode: resolveCatalogCredentialMode(locals)
		});

		// Forward the resolved (privilege-gated) view params so the data scope
		// Parchment computes stays consistent with the meta.access we report below.
		const query: CatalogOriginPriceStatsQuery = {
			showWholesale: visibility.showWholesale ? 'true' : 'false'
		};
		if (visibility.wholesaleOnly) query.wholesaleOnly = 'true';

		// openapi-fetch resolves non-2xx responses as `{ error, response }` rather
		// than throwing, so relay the upstream status/body verbatim (matching the
		// catalog proxy pattern). Routing these through `catalogProxyErrorResponse`
		// would flatten actionable upstream statuses (e.g. 401/403 auth/entitlement
		// denials) into a generic 500. Only genuine throws (config/network) fall
		// through to the catch below.
		const { data, error, response } = await client.catalog.originPriceStats(query);
		if (error) {
			return json(error, {
				status: response.status,
				headers: applyBffCatalogNoStore(new Headers())
			});
		}

		return json(
			{
				originPriceStats: data?.originPriceStats ?? [],
				meta: {
					access: {
						publicOnly: visibility.publicOnly,
						showWholesale: visibility.showWholesale,
						wholesaleOnly: visibility.wholesaleOnly
					}
				}
			},
			{ headers: applyBffCatalogCacheHeaders(new Headers(), isAuthenticated) }
		);
	} catch (error) {
		const { status, body } = catalogProxyErrorResponse(error);
		return json(body, { status, headers: applyBffCatalogNoStore(new Headers()) });
	}
};
