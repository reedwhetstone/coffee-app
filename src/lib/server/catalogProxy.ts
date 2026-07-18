import type { RequestEvent } from '@sveltejs/kit';
import type { CatalogListQuery, CatalogSimilarQuery } from '@purveyors/sdk';
import {
	createParchmentServerClient,
	type ParchmentCredentialMode,
	type ParchmentPreferHandling
} from '$lib/server/parchmentClient';
import { toParchmentCatalogQuery, type CatalogQueryValue } from '$lib/catalog/parchmentQuery';

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
 * Repeated params (e.g. `source`, `country`, `ids`) become arrays. Stable app
 * URL aliases are translated to the generated Parchment SDK names; values are
 * otherwise untouched. Parchment still owns validation, filtering, sorting,
 * and projection.
 */
export function toCatalogListQuery(url: URL): CatalogListQuery {
	const appQuery: Record<string, CatalogQueryValue> = {};

	for (const key of new Set(url.searchParams.keys())) {
		const values = url.searchParams.getAll(key);
		appQuery[key] = values.length > 1 ? values : values[0];
	}

	// The installed SDK's CatalogListQuery type only models the core paging params;
	// the full public catalog contract accepts many more filter keys that Parchment
	// parses server-side. openapi-fetch serializes the whole object regardless of
	// the compile-time type, so the cast keeps the passthrough faithful.
	return toParchmentCatalogQuery(appQuery) as CatalogListQuery;
}

const CATALOG_SIMILAR_QUERY_KEYS = ['threshold', 'limit', 'stocked_only', 'mode'] as const;
const POSTGRES_INT4_MAX = 2_147_483_647;
const POSTGRES_INT4_MAX_STRING = String(POSTGRES_INT4_MAX);

export const CATALOG_ID_EXPECTED_FORMAT = 'positive integer less than or equal to 2147483647';

export class CatalogProxyValidationError extends Error {
	constructor(
		public parameter: string,
		public value: string,
		public expected: string
	) {
		super(`Query parameter "${parameter}" must use ${expected}`);
		this.name = 'CatalogProxyValidationError';
	}
}

export function parseCatalogProxyId(rawId: string | undefined): string {
	if (!rawId || !/^\d+$/.test(rawId)) {
		throw new CatalogProxyValidationError('id', rawId ?? '', 'positive integer');
	}

	const normalizedId = rawId.replace(/^0+/, '') || '0';
	if (normalizedId === '0') {
		throw new CatalogProxyValidationError('id', rawId, 'positive integer');
	}

	if (
		normalizedId.length > POSTGRES_INT4_MAX_STRING.length ||
		(normalizedId.length === POSTGRES_INT4_MAX_STRING.length &&
			normalizedId > POSTGRES_INT4_MAX_STRING)
	) {
		throw new CatalogProxyValidationError('id', rawId, CATALOG_ID_EXPECTED_FORMAT);
	}

	return normalizedId;
}

export function toCatalogSimilarQuery(url: URL): CatalogSimilarQuery {
	const query: Record<string, string | number> = {};

	for (const key of CATALOG_SIMILAR_QUERY_KEYS) {
		const value = url.searchParams.get(key);
		if (value === null) continue;
		query[key] = key === 'limit' && /^\d+$/.test(value) ? Number.parseInt(value, 10) : value;
	}

	// Parchment owns query validation. The cast allows coffee-app to forward the
	// canonical snake_case query keys without re-creating the upstream parser here.
	return query as CatalogSimilarQuery;
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

export type CatalogSimilarProxyResult = CatalogListProxyResult;

export interface CatalogProxyErrorResponse {
	status: number;
	body: { error: string; message: string };
}

/**
 * Map a thrown proxy failure to the catalog API's JSON error shape.
 *
 * {@link proxyCatalogList} (and the proof-coverage proxy) throw only when
 * Parchment is unconfigured — {@link ParchmentConfigError}, before any request is
 * made — or when the upstream fetch genuinely rejects (openapi-fetch resolves
 * non-2xx *responses* as `{ error }` and relays them instead). Public catalog
 * routes should surface those as JSON 5xx bodies matching the removed catalog
 * builder, not fall through to SvelteKit's generic 500 HTML page. The status/shape
 * mirror the old `catalogResource` catch block: missing config maps to the
 * schema-unavailable 503, everything else to the generic 500.
 */
export function catalogProxyErrorResponse(error: unknown): CatalogProxyErrorResponse {
	if (error instanceof Error && error.name === 'ParchmentConfigError') {
		return {
			status: 503,
			body: { error: 'Catalog schema unavailable', message: error.message }
		};
	}

	const message = error instanceof Error ? error.message : String(error);
	console.error('Error proxying catalog request:', message);
	return {
		status: 500,
		body: { error: 'Failed to fetch catalog data', message: 'Internal server error' }
	};
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
	/**
	 * Credential mode to present to Parchment. Public API routes use `session`
	 * so they forward only the caller's own credential; first-party web/BFF
	 * routes can pass `public-demo` for anonymous website reads.
	 */
	mode?: ParchmentCredentialMode;
	/**
	 * Prefer handling policy to present upstream. Public API routes inherit the
	 * caller's preference so strict remains the machine default; first-party
	 * web/BFF routes use lenient handling for graceful UI degradation.
	 */
	preferHandling?: ParchmentPreferHandling;
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

	// Public API proxy: relay Parchment's status/body verbatim and preserve the
	// external caller's own `Prefer` (default strict), so gated failures are not
	// silently downgraded to a degraded 2xx by a first-party lenient default.
	const client = await createParchmentServerClient(event, {
		mode: options.mode ?? 'session',
		preferHandling: options.preferHandling ?? 'inherit'
	});
	const { data, error, response } = await client.catalog.list(query as CatalogListQuery);

	return {
		status: response.status,
		body: error ?? data,
		upstream: response
	};
}

export async function proxyCatalogSimilar(
	event: RequestEvent,
	id: string,
	query: CatalogSimilarQuery
): Promise<CatalogSimilarProxyResult> {
	// Public API proxy: preserve the external caller's `Prefer` (default strict)
	// so entitlement/validation failures surface instead of being downgraded.
	const client = await createParchmentServerClient(event, {
		mode: 'session',
		preferHandling: 'inherit'
	});
	const { data, error, response } = await client.catalog.similar(id, query);

	return {
		status: response.status,
		body: error ?? data,
		upstream: response
	};
}
