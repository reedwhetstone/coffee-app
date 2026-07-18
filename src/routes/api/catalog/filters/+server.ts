import { json } from '@sveltejs/kit';
import type { ParchmentClient } from '@purveyors/sdk';
import {
	createParchmentServerClient,
	resolveCatalogCredentialMode
} from '$lib/server/parchmentClient';
import { resolvePrincipal } from '$lib/server/principal';
import { applyBffCatalogCacheHeaders, applyBffCatalogNoStore } from '$lib/server/cacheHeaders';
import type { RequestHandler } from './$types';

type CatalogFacetsQuery = NonNullable<Parameters<ParchmentClient['catalog']['facets']>[0]>;

/**
 * Filter dropdown option lists for the catalog UI.
 *
 * Cut over to Parchment's canonical `/v1/catalog/facets` endpoint (PADR-0012):
 * the API owns catalog querying, visibility, and premium-metadata gating. The
 * facets `values` payload is the compatibility-friendly `Record<key, string[]>`
 * shape the filter store already consumes, so this endpoint just forwards the
 * caller's wholesale view params and returns `values`. Access gating (premium
 * process metadata for member/paid callers only) is enforced server-side by
 * Parchment, replacing the local capability/visibility logic that used to live
 * here.
 */
export const GET: RequestHandler = async (event) => {
	const { url } = event;
	try {
		const principal = await resolvePrincipal(event);
		if (event.request.headers.has('Authorization') && !principal.isAuthenticated) {
			return json(
				{ error: 'Authentication required', message: 'Authentication required' },
				{ status: 401, headers: applyBffCatalogNoStore(new Headers()) }
			);
		}

		const client = await createParchmentServerClient(event, {
			mode: resolveCatalogCredentialMode(event.locals),
			preferHandling: 'lenient'
		});

		const query: CatalogFacetsQuery = { stocked: 'true' };
		query.showWholesale = url.searchParams.get('showWholesale') === 'false' ? 'false' : 'true';
		if (url.searchParams.get('wholesaleOnly') === 'true') {
			query.wholesaleOnly = 'true';
		}

		const { data, error } = await client.catalog.facets(query);
		if (error) {
			console.error('Error fetching filter values from Parchment:', error);
			return json(
				{ error: 'Failed to fetch filter values' },
				{ status: 500, headers: applyBffCatalogNoStore(new Headers()) }
			);
		}

		return json(data?.values ?? {}, {
			headers: applyBffCatalogCacheHeaders(new Headers(), principal.isAuthenticated)
		});
	} catch (error) {
		console.error('Error fetching filter values:', error);
		return json(
			{ error: 'Failed to fetch filter values' },
			{ status: 500, headers: applyBffCatalogNoStore(new Headers()) }
		);
	}
};
