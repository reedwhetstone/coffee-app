import { json } from '@sveltejs/kit';
import type { ParchmentClient } from '@purveyors/sdk';
import { createParchmentServerClient } from '$lib/server/parchmentClient';
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
		const client = await createParchmentServerClient(event);

		const query: CatalogFacetsQuery = { stocked: 'true' };
		if (url.searchParams.get('showWholesale') === 'true') {
			query.showWholesale = 'true';
		}
		if (url.searchParams.get('wholesaleOnly') === 'true') {
			query.wholesaleOnly = 'true';
		}

		const { data, error } = await client.catalog.facets(query);
		if (error) {
			console.error('Error fetching filter values from Parchment:', error);
			return json({ error: 'Failed to fetch filter values' }, { status: 500 });
		}

		return json(data?.values ?? {});
	} catch (error) {
		console.error('Error fetching filter values:', error);
		return json({ error: 'Failed to fetch filter values' }, { status: 500 });
	}
};
