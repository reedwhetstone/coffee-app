import type { ParchmentClient, components } from '@purveyors/sdk';

/**
 * Server-only helpers for reading catalog rows through the Parchment API.
 *
 * These replace direct `coffee_catalog` Supabase reads (the legacy
 * `getCatalogItemsByIds`) so catalog access flows through the canonical
 * `/v1/catalog` contract with its entitlement-aware projection and visibility.
 */

type SdkCatalogItem = components['schemas']['CatalogItem'];

/** Maximum page size accepted by the `/v1/catalog` contract. */
const MAX_CATALOG_PAGE_LIMIT = 1000;

type CatalogListResult = {
	data?: { data?: unknown } | unknown[];
	error?: unknown;
};

/**
 * Pull the catalog rows out of a `catalog.list()` response.
 *
 * The SDK returns the parsed body under `data`; the API wraps rows in an
 * envelope (`{ data: [...] }`), but older/proxy shapes returned a bare array,
 * so both are tolerated. A transport/HTTP error surfaces on `error` and is
 * rethrown for the caller's own fallback handling.
 */
export function extractParchmentCatalogRows(result: CatalogListResult): SdkCatalogItem[] {
	if (result.error) {
		throw result.error;
	}

	const rows = Array.isArray(result.data) ? result.data : result.data?.data;
	return Array.isArray(rows) ? (rows as SdkCatalogItem[]) : [];
}

/**
 * Fetch a batch of catalog items by id through Parchment's `/v1/catalog`
 * `coffeeIds` (IN) filter, ordered as the API returns them.
 *
 * Consumers join the result to their own records by `id`, so ordering is not
 * significant. Requests are split at the contract's page-size ceiling so every
 * requested row is hydrated, including when the id set exceeds 1,000 rows.
 * First-party session callers are exempt from per-plan row caps, but the
 * per-request contract ceiling still applies.
 *
 * Visibility is widened to `stocked: 'all'` and `showWholesale: 'true'` to
 * match the legacy direct `coffee_catalog` id lookup this replaces. Tracked
 * lots are looked up by explicit id for dashboard/beans/chat hydration, so an
 * unstocked or wholesale-only saved lot must still resolve; the contract
 * otherwise defaults to stocked-only, wholesale-excluded public visibility and
 * would silently drop those rows.
 */
export async function fetchParchmentCatalogItemsByIds(
	client: ParchmentClient,
	ids: number[]
): Promise<SdkCatalogItem[]> {
	if (ids.length === 0) {
		return [];
	}

	const rows: SdkCatalogItem[] = [];
	for (let offset = 0; offset < ids.length; offset += MAX_CATALOG_PAGE_LIMIT) {
		const batch = ids.slice(offset, offset + MAX_CATALOG_PAGE_LIMIT);
		const result = await client.catalog.list({
			coffeeIds: batch.join(','),
			stocked: 'all',
			showWholesale: 'true',
			limit: batch.length
		});
		rows.push(...extractParchmentCatalogRows(result as CatalogListResult));
	}

	return rows;
}
