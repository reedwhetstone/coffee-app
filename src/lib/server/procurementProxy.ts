import type { RequestEvent } from '@sveltejs/kit';
import type { BriefMatchesQuery, SourcingBriefCreateRequest } from '@purveyors/sdk';
import { createParchmentServerClient } from '$lib/server/parchmentClient';

/**
 * Thin proxy helpers for the `/v1/procurement/briefs` routes.
 *
 * Per PADR-0012, Parchment owns procurement: sourcing-brief storage, criteria
 * validation, matching (`computeMatchReasons` + projection), auth, entitlement,
 * and rate limiting all live behind the private Parchment API. These helpers
 * forward the caller's own credential to Parchment (`mode: 'session'`) and relay
 * the response verbatim, so coffee-app no longer reimplements any procurement
 * logic locally.
 */

/** Upstream response headers relayed verbatim to the caller (rate limiting). */
const FORWARDED_UPSTREAM_HEADERS = [
	'X-RateLimit-Limit',
	'X-RateLimit-Remaining',
	'X-RateLimit-Reset',
	'Retry-After'
] as const;

const BRIEF_MATCHES_QUERY_KEYS = ['page', 'limit'] as const;

/**
 * Raised when the create route receives a body that is not valid JSON. This is a
 * pre-flight parse failure (nothing can be forwarded to Parchment), so it maps to
 * the route's historical 400 contract rather than a generic 5xx.
 */
export class ProcurementInvalidBodyError extends Error {
	constructor() {
		super('request body must be valid JSON');
		this.name = 'ProcurementInvalidBodyError';
	}
}

/**
 * Convert the incoming request's `page`/`limit` search params into the SDK brief
 * matches query. Passthrough like {@link toCatalogSimilarQuery}: numeric values
 * coerce to numbers and everything else forwards as-is for Parchment to validate.
 */
export function toBriefMatchesQuery(url: URL): BriefMatchesQuery {
	const query: Record<string, number | string> = {};

	for (const key of BRIEF_MATCHES_QUERY_KEYS) {
		const value = url.searchParams.get(key);
		if (value === null) continue;
		query[key] = /^\d+$/.test(value) ? Number.parseInt(value, 10) : value;
	}

	// Parchment owns query validation; the cast keeps the passthrough faithful
	// without re-creating the upstream parser here.
	return query as BriefMatchesQuery;
}

/**
 * Relay the rate-limit headers from a Parchment response onto the outgoing
 * headers so proxied callers see the same throttling metadata they did before.
 */
export function forwardProcurementUpstreamHeaders(upstream: Response, into: Headers): Headers {
	for (const name of FORWARDED_UPSTREAM_HEADERS) {
		const value = upstream.headers.get(name);
		if (value !== null) {
			into.set(name, value);
		}
	}

	return into;
}

export interface ProcurementProxyResult {
	status: number;
	body: unknown;
	upstream: Response;
}

export interface ProcurementProxyErrorResponse {
	status: number;
	body: { error: string; message: string; details?: { field: string } };
}

/**
 * Map a thrown proxy failure to the procurement API's JSON error shape.
 *
 * The proxy functions throw only when the body cannot be parsed
 * ({@link ProcurementInvalidBodyError} -> 400), when Parchment is unconfigured
 * ({@link ParchmentConfigError} -> 503, before any request is made), or when the
 * upstream fetch genuinely rejects (openapi-fetch resolves non-2xx *responses* as
 * `{ error }` and relays them instead). These surface as JSON bodies rather than
 * SvelteKit's generic 500 HTML page.
 */
export function procurementProxyErrorResponse(error: unknown): ProcurementProxyErrorResponse {
	if (error instanceof ProcurementInvalidBodyError) {
		// Preserve the historical 400 contract: the deleted local implementation
		// routed a malformed body through createValidationBody, which attached
		// details.field = 'body'. Clients that inspect validation details still
		// rely on that structured field for a pre-flight parse failure.
		return {
			status: 400,
			body: {
				error: 'Invalid request',
				message: 'request body must be valid JSON',
				details: { field: 'body' }
			}
		};
	}

	if (error instanceof Error && error.name === 'ParchmentConfigError') {
		return {
			status: 503,
			body: { error: 'Procurement unavailable', message: error.message }
		};
	}

	const message = error instanceof Error ? error.message : String(error);
	console.error('Error proxying procurement request:', message);
	return {
		status: 500,
		body: { error: 'Failed to serve procurement request', message: 'Internal server error' }
	};
}

/**
 * openapi-fetch resolves non-2xx responses as `{ error }` rather than rejecting,
 * so the parsed error body is relayed with the upstream status just like a
 * success body. Only genuine network failures reject.
 */
export async function proxyBriefsList(event: RequestEvent): Promise<ProcurementProxyResult> {
	const client = await createParchmentServerClient(event, {
		mode: 'session',
		preferHandling: 'inherit'
	});
	const { data, error, response } = await client.procurement.briefs.list();

	return {
		status: response.status,
		body: error ?? data,
		upstream: response
	};
}

export async function proxyBriefCreate(event: RequestEvent): Promise<ProcurementProxyResult> {
	// Parse locally only so an unparseable body maps to the historical 400 shape;
	// Parchment owns all structural/criteria validation of the parsed body.
	let body: SourcingBriefCreateRequest;
	try {
		body = (await event.request.json()) as SourcingBriefCreateRequest;
	} catch {
		throw new ProcurementInvalidBodyError();
	}

	const client = await createParchmentServerClient(event, {
		mode: 'session',
		preferHandling: 'inherit'
	});
	const { data, error, response } = await client.procurement.briefs.create(body);

	return {
		status: response.status,
		body: error ?? data,
		upstream: response
	};
}

export async function proxyBriefGet(
	event: RequestEvent,
	id: string
): Promise<ProcurementProxyResult> {
	const client = await createParchmentServerClient(event, {
		mode: 'session',
		preferHandling: 'inherit'
	});
	const { data, error, response } = await client.procurement.briefs.get(id);

	return {
		status: response.status,
		body: error ?? data,
		upstream: response
	};
}

export async function proxyBriefMatches(
	event: RequestEvent,
	id: string,
	url: URL
): Promise<ProcurementProxyResult> {
	const query = toBriefMatchesQuery(url);
	const client = await createParchmentServerClient(event, {
		mode: 'session',
		preferHandling: 'inherit'
	});
	const { data, error, response } = await client.procurement.briefs.matches(id, query);

	return {
		status: response.status,
		body: error ?? data,
		upstream: response
	};
}
