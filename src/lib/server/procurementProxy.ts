import type { RequestEvent } from '@sveltejs/kit';
import type { BriefMatchesQuery, SourcingBriefCreateRequest } from '@purveyors/sdk';
import { createParchmentServerClient } from '$lib/server/parchmentClient';
import { jsonResponse } from '$lib/server/http';
import { isTrustedMutationRequest, resolvePrincipal } from '$lib/server/principal';

/**
 * Thin proxy helpers for the legacy `/v1/procurement/briefs` routes.
 *
 * Per ADR-007, coffee-app is a reference client: sourcing-brief persistence,
 * criteria validation, per-user entitlement gating, and catalog matching all
 * live behind the private Parchment API. These helpers forward the caller's own
 * authenticated credential to Parchment (`mode: 'session'`) and relay the
 * response, so no brief storage or matching logic is reimplemented here.
 *
 * Procurement is a per-user authenticated resource: the caller credential is
 * forwarded so Parchment enforces the same member/plan entitlement the old
 * in-app handler did, and each principal only ever sees their own briefs.
 */

/** Upstream response headers relayed verbatim to the caller (rate limiting). */
const FORWARDED_UPSTREAM_HEADERS = [
	'X-RateLimit-Limit',
	'X-RateLimit-Remaining',
	'X-RateLimit-Reset',
	'Retry-After'
] as const;

/** Sunset date advertised on the deprecated legacy procurement routes. */
const PROCUREMENT_SUNSET = 'Thu, 31 Dec 2026 23:59:59 GMT';

/**
 * Build the migration headers for a deprecated legacy procurement route.
 *
 * Mirrors how Span B3 marked the legacy price-index route: a `Deprecation`
 * flag, a `Sunset` date, and a `Link` header whose `successor-version` points at
 * the canonical Parchment resource for this exact path.
 */
export function withLegacyProcurementHeaders(
	successorUrl: string,
	headers: HeadersInit = {}
): Headers {
	const merged = new Headers(headers);
	merged.set('Deprecation', 'true');
	merged.set('Sunset', PROCUREMENT_SUNSET);
	merged.set('Link', `<${successorUrl}>; rel="successor-version"`);
	return merged;
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
	body: { error: string; message: string };
}

/**
 * Thrown by {@link proxyBriefCreate} when the request body is not valid JSON.
 *
 * Parchment owns criteria/name validation, but coffee-app must parse the body
 * before it can forward it to the SDK. A malformed body can never reach
 * Parchment, so we surface the same 400 the pre-proxy handler returned for
 * `request body must be valid JSON` instead of a generic 500.
 */
export class ProcurementInvalidBodyError extends Error {
	constructor() {
		super('Request body must be valid JSON');
		this.name = 'ProcurementInvalidBodyError';
	}
}

/**
 * Map a thrown proxy failure to the procurement API's JSON error shape.
 *
 * The proxy helpers throw only when the body is unparseable
 * ({@link ProcurementInvalidBodyError} → 400), when Parchment is unconfigured
 * ({@link ParchmentConfigError} by name, before any request is made → 503), or
 * when the upstream fetch genuinely rejects (openapi-fetch resolves non-2xx
 * *responses* as `{ error }` and relays them instead → generic 500). These
 * routes should surface those as JSON bodies matching the removed handler rather
 * than SvelteKit's generic 500 HTML page.
 */
export function procurementProxyErrorResponse(error: unknown): ProcurementProxyErrorResponse {
	if (error instanceof ProcurementInvalidBodyError) {
		return {
			status: 400,
			body: { error: 'Invalid request', message: error.message }
		};
	}

	if (error instanceof Error && error.name === 'ParchmentConfigError') {
		return {
			status: 503,
			body: { error: 'Sourcing briefs unavailable', message: error.message }
		};
	}

	const message = error instanceof Error ? error.message : String(error);
	console.error('Error proxying procurement request:', message);
	return {
		status: 500,
		body: { error: 'Failed to serve sourcing brief request', message: 'Internal server error' }
	};
}

/**
 * Convert the incoming matches request's `page`/`limit` search params into an
 * SDK brief-matches query.
 *
 * This is a passthrough: numeric values forward as numbers (the SDK type models
 * them as numbers) and any non-numeric value forwards as-is so Parchment returns
 * its own 400 for garbage input. Parchment owns pagination validation, so
 * coffee-app deliberately does not re-implement the bounds checks here.
 */
export function toBriefMatchesQuery(url: URL): BriefMatchesQuery {
	const query: Record<string, string | number> = {};

	for (const key of ['page', 'limit'] as const) {
		const value = url.searchParams.get(key);
		if (value === null) continue;
		query[key] = /^\d+$/.test(value) ? Number.parseInt(value, 10) : value;
	}

	// Parchment owns query validation. The cast lets coffee-app forward the raw
	// pagination params without re-creating the upstream parser here.
	return query as BriefMatchesQuery;
}

/**
 * Proxy a "list saved briefs" request to Parchment, forwarding the caller
 * credential so Parchment scopes the result to the authenticated principal.
 *
 * openapi-fetch resolves non-2xx responses as `{ error }` rather than rejecting,
 * so the parsed error body (e.g. 401/403 entitlement) is relayed with the
 * upstream status just like a success body. Only genuine network failures reject.
 */
export async function proxyBriefsList(event: RequestEvent): Promise<ProcurementProxyResult> {
	const client = await createParchmentServerClient(event, { mode: 'session' });
	const { data, error, response } = await client.procurement.briefs.list();

	return {
		status: response.status,
		body: error ?? data,
		upstream: response
	};
}

/**
 * Proxy a "create brief" request to Parchment, forwarding the caller credential
 * and the JSON request body verbatim.
 *
 * The body is parsed only so it can be handed to the SDK; Parchment owns name and
 * criteria validation and returns 400 for invalid input, 402/403 for entitlement
 * failures, and 201 with the created resource on success — all relayed verbatim.
 * A body that is not valid JSON can never reach Parchment, so it throws
 * {@link ProcurementInvalidBodyError} (mapped to 400).
 */
export async function proxyBriefCreate(event: RequestEvent): Promise<ProcurementProxyResult> {
	let body: SourcingBriefCreateRequest;
	try {
		body = (await event.request.json()) as SourcingBriefCreateRequest;
	} catch {
		throw new ProcurementInvalidBodyError();
	}

	const client = await createParchmentServerClient(event, { mode: 'session' });
	const { data, error, response } = await client.procurement.briefs.create(body);

	return {
		status: response.status,
		body: error ?? data,
		upstream: response
	};
}

/**
 * Proxy a "get one brief" request to Parchment, forwarding the caller credential
 * so Parchment enforces per-principal ownership (and returns 404 for briefs that
 * do not belong to the caller).
 */
export async function proxyBriefGet(
	event: RequestEvent,
	id: string
): Promise<ProcurementProxyResult> {
	const client = await createParchmentServerClient(event, { mode: 'session' });
	const { data, error, response } = await client.procurement.briefs.get(id);

	return {
		status: response.status,
		body: error ?? data,
		upstream: response
	};
}

/**
 * Proxy a "run brief matches" request to Parchment, forwarding the caller
 * credential and the `page`/`limit` pagination query.
 */
export async function proxyBriefMatches(
	event: RequestEvent,
	id: string
): Promise<ProcurementProxyResult> {
	const query = toBriefMatchesQuery(event.url);

	const client = await createParchmentServerClient(event, { mode: 'session' });
	const { data, error, response } = await client.procurement.briefs.matches(id, query);

	return {
		status: response.status,
		body: error ?? data,
		upstream: response
	};
}

/**
 * Shared runner for the four legacy procurement route handlers.
 *
 * Every handler shares the same shape, so the logic lives here once (rather than
 * being copied per route):
 *
 * 1. Reject a present-but-invalid `Authorization` header with a 401 before
 *    proxying. The auth hook leaves such a request anonymous and `session` mode
 *    forwards no credential, so without this guard an invalid/expired bearer
 *    would silently downgrade to an anonymous Parchment call. This mirrors the
 *    pre-proxy handler's `Authentication required` guard and the `/v1/catalog`
 *    route.
 * 2. Block cross-site cookie-session mutations (CSRF) before proxying. Parchment
 *    authenticates a forwarded Bearer token and has no visibility into the
 *    browser origin, so the Origin check must stay at this cookie→Bearer edge.
 *    Without it, a cross-site POST that rides the victim's Supabase cookie would
 *    be converted into a valid Bearer create call. This mirrors the pre-proxy
 *    handler's `isTrustedMutationRequest` guard; it is a no-op for safe methods
 *    and for API-key/bearer principals.
 * 3. Proxy to Parchment, converting config/network throws into the JSON error
 *    contract instead of SvelteKit's generic 500 HTML page.
 * 4. Relay the upstream status/body plus rate-limit headers, always stamping the
 *    legacy Deprecation/Sunset/Link migration headers.
 */
export async function runProcurementProxyRoute(
	event: RequestEvent,
	successorUrl: string,
	proxy: (event: RequestEvent) => Promise<ProcurementProxyResult>
): Promise<Response> {
	const principal = await resolvePrincipal(event);
	if (event.request.headers.has('Authorization') && !principal.isAuthenticated) {
		return jsonResponse(
			{ error: 'Authentication required', message: 'Authentication required' },
			{ status: 401, headers: withLegacyProcurementHeaders(successorUrl) }
		);
	}

	if (!isTrustedMutationRequest(event, principal)) {
		return jsonResponse(
			{ error: 'Insufficient permissions', message: 'Cross-site session mutation blocked' },
			{ status: 403, headers: withLegacyProcurementHeaders(successorUrl) }
		);
	}

	let proxied: ProcurementProxyResult;
	try {
		proxied = await proxy(event);
	} catch (error) {
		const { status, body } = procurementProxyErrorResponse(error);
		return jsonResponse(body, { status, headers: withLegacyProcurementHeaders(successorUrl) });
	}

	const { status, body, upstream } = proxied;
	const headers = withLegacyProcurementHeaders(successorUrl);
	forwardProcurementUpstreamHeaders(upstream, headers);

	return jsonResponse(body, { status, headers });
}
