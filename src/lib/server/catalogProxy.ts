import type { RequestEvent } from '@sveltejs/kit';
import type { CatalogListQuery } from '@purveyors/sdk';
import { createParchmentServerClient } from '$lib/server/parchmentClient';

/**
 * Thin proxy helpers for the legacy catalog listing routes.
 *
 * Per ADR-007, coffee-app is a reference client: catalog filtering, sorting, and
 * projection live behind the private Parchment API. These helpers forward the
 * caller's own credential to Parchment (`mode: 'session'`) and relay the
 * response, so no catalog query logic is reimplemented here.
 */

/** Upstream response headers relayed verbatim to the caller (rate limiting). */
const FORWARDED_UPSTREAM_HEADERS = [
	'X-RateLimit-Limit',
	'X-RateLimit-Remaining',
	'X-RateLimit-Reset',
	'Retry-After'
] as const;

/**
 * Convert the incoming request's search params into an SDK catalog list query.
 *
 * This is a verbatim passthrough: repeated params (e.g. `source`, `country`,
 * `ids`) become arrays and everything else forwards as-is. Parchment owns
 * validation, filtering, sorting, and projection, so coffee-app deliberately does
 * not parse or reshape these values.
 */
export function toCatalogListQuery(url: URL): CatalogListQuery {
	const query: Record<string, string | string[]> = {};

	for (const key of new Set(url.searchParams.keys())) {
		const values = url.searchParams.getAll(key);
		query[key] = values.length > 1 ? values : values[0];
	}

	// The installed SDK's CatalogListQuery type only models the core paging params;
	// the full public catalog contract accepts many more filter keys that Parchment
	// parses server-side. openapi-fetch serializes the whole object regardless of
	// the compile-time type, so the cast keeps the passthrough faithful.
	return query as CatalogListQuery;
}

/**
 * Relay the rate-limit headers from a Parchment response onto the outgoing
 * headers so proxied callers see the same throttling metadata they did before.
 */
export function forwardCatalogUpstreamHeaders(upstream: Response, into: Headers): Headers {
	for (const name of FORWARDED_UPSTREAM_HEADERS) {
		const value = upstream.headers.get(name);
		if (value !== null) {
			into.set(name, value);
		}
	}

	return into;
}

export interface CatalogListProxyResult {
	status: number;
	body: unknown;
	upstream: Response;
}

export interface ProxyCatalogListOptions {
	/**
	 * When the caller omits both `page` and `limit`, request up to this many rows
	 * so the endpoint approximates its historical unbounded full-list contract
	 * instead of falling back to Parchment's small default page size. Used by the
	 * legacy in-app `/api/catalog` endpoint, whose consumers (e.g. the bean picker)
	 * expect the whole catalog in one unparameterized request.
	 */
	defaultLimit?: number;
}

/**
 * Proxy a catalog list request to Parchment, forwarding the caller credential.
 *
 * openapi-fetch resolves non-2xx responses as `{ error }` rather than rejecting,
 * so the parsed error body is relayed with the upstream status just like a
 * success body. Only genuine network failures reject.
 */
export async function proxyCatalogList(
	event: RequestEvent,
	options: ProxyCatalogListOptions = {}
): Promise<CatalogListProxyResult> {
	const query = toCatalogListQuery(event.url) as Record<string, string | string[]>;

	// Restore the legacy full-list contract: an unparameterized request injects a
	// high default limit so callers that never paged (and relied on the old
	// unbounded array) still receive the full catalog rather than one small page.
	const hasPaging = event.url.searchParams.has('page') || event.url.searchParams.has('limit');
	if (options.defaultLimit != null && !hasPaging) {
		query.limit = String(options.defaultLimit);
	}

	const client = await createParchmentServerClient(event, { mode: 'session' });
	const { data, error, response } = await client.catalog.list(query as CatalogListQuery);

	return {
		status: response.status,
		body: error ?? data,
		upstream: response
	};
}
