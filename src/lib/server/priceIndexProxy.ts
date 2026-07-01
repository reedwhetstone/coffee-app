import type { RequestEvent } from '@sveltejs/kit';
import type { PriceIndexQuery } from '@purveyors/sdk';
import { createParchmentServerClient } from '$lib/server/parchmentClient';

/**
 * Thin proxy helpers for the legacy `/v1/price-index` route.
 *
 * Per ADR-007, coffee-app is a reference client: price-index filtering,
 * aggregation, and projection live behind the private Parchment API. These
 * helpers forward the caller's own credential to Parchment (`mode: 'session'`)
 * and relay the response, so no price-index query logic is reimplemented here.
 */

/** Upstream response headers relayed verbatim to the caller (rate limiting). */
const FORWARDED_UPSTREAM_HEADERS = [
	'X-RateLimit-Limit',
	'X-RateLimit-Remaining',
	'X-RateLimit-Reset',
	'Retry-After'
] as const;

/**
 * Convert the incoming request's search params into an SDK price-index query.
 *
 * This is a verbatim passthrough: everything forwards as-is (repeated params
 * become arrays). Parchment owns validation, filtering, and projection, so
 * coffee-app deliberately does not parse or reshape these values.
 */
export function toPriceIndexQuery(url: URL): PriceIndexQuery {
	const query: Record<string, string | string[]> = {};

	for (const key of new Set(url.searchParams.keys())) {
		const values = url.searchParams.getAll(key);
		query[key] = values.length > 1 ? values : values[0];
	}

	// The installed SDK's PriceIndexQuery type models the canonical filter keys as
	// scalars; openapi-fetch serializes the whole object regardless of the
	// compile-time type, so the cast keeps the passthrough faithful while Parchment
	// parses and validates server-side.
	return query as PriceIndexQuery;
}

/**
 * Relay the rate-limit headers from a Parchment response onto the outgoing
 * headers so proxied callers see the same throttling metadata they did before.
 */
export function forwardPriceIndexUpstreamHeaders(upstream: Response, into: Headers): Headers {
	for (const name of FORWARDED_UPSTREAM_HEADERS) {
		const value = upstream.headers.get(name);
		if (value !== null) {
			into.set(name, value);
		}
	}

	return into;
}

export interface PriceIndexProxyResult {
	status: number;
	body: unknown;
	upstream: Response;
}

export interface PriceIndexProxyErrorResponse {
	status: number;
	body: { error: string; message: string };
}

/**
 * Map a thrown proxy failure to the price-index API's JSON error shape.
 *
 * {@link proxyPriceIndexList} throws only when Parchment is unconfigured
 * (`ParchmentConfigError`, before any request is made) or when the upstream
 * fetch genuinely rejects (openapi-fetch resolves non-2xx *responses* as
 * `{ error }` and relays them instead). This route should surface those as JSON
 * 5xx bodies instead of SvelteKit's generic 500 HTML page: missing config maps
 * to a 503, everything else to the generic 500 that mirrors the removed builder.
 */
export function priceIndexProxyErrorResponse(error: unknown): PriceIndexProxyErrorResponse {
	if (error instanceof Error && error.name === 'ParchmentConfigError') {
		return {
			status: 503,
			body: { error: 'Price index unavailable', message: error.message }
		};
	}

	const message = error instanceof Error ? error.message : String(error);
	console.error('Error proxying price index request:', message);
	return {
		status: 500,
		body: { error: 'Failed to fetch price index data', message: 'Internal server error' }
	};
}

/**
 * Proxy a price-index list request to Parchment, forwarding the caller
 * credential.
 *
 * openapi-fetch resolves non-2xx responses as `{ error }` rather than rejecting,
 * so the parsed error body is relayed with the upstream status just like a
 * success body. Only genuine network failures reject.
 */
export async function proxyPriceIndexList(event: RequestEvent): Promise<PriceIndexProxyResult> {
	const query = toPriceIndexQuery(event.url);

	const client = await createParchmentServerClient(event, { mode: 'session' });
	const { data, error, response } = await client.priceIndex.list(query);

	return {
		status: response.status,
		body: error ?? data,
		upstream: response
	};
}
