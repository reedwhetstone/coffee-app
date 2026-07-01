import type { RequestHandler } from './$types';
import { jsonResponse } from '$lib/server/http';
import { createParchmentServerClient } from '$lib/server/parchmentClient';
import { catalogProxyErrorResponse, forwardCatalogUpstreamHeaders } from '$lib/server/catalogProxy';
import { resolvePrincipal } from '$lib/server/principal';

// Thin proxy in front of the canonical Parchment proof-coverage surface
// (ADR-007). The caller's own credential is forwarded and the aggregate response
// is relayed verbatim.
//
// Coverage scope is owned by Parchment: the canonical endpoint computes an
// aggregate over the stocked public catalog and does NOT accept scope filters
// (verified live — ?stocked=/?country=/?ids= return byte-identical results, and
// scoped proof-coverage filtering is a separate, future upstream contract). Per
// ADR-007 coffee-app must not reintroduce local filtering, so no query is
// forwarded here.
//
// This lives under the stable /v1 surface, so — like /v1/catalog — it does NOT
// advertise Deprecation/Sunset headers; only the legacy aliases are deprecated.
export const GET: RequestHandler = async (event) => {
	// Reject a present-but-invalid Authorization header before proxying, matching
	// /v1/catalog and the pre-proxy handler. Without this, an invalid/expired bearer
	// is left anonymous by the auth hook and `session` mode forwards no credential,
	// silently downgrading the request to an anonymous aggregate instead of 401.
	const principal = await resolvePrincipal(event);
	if (event.request.headers.has('Authorization') && !principal.isAuthenticated) {
		return jsonResponse(
			{ error: 'Authentication required', message: 'Authentication required' },
			{ status: 401 }
		);
	}

	let proxied: { data?: unknown; error?: unknown; response: Response };
	try {
		const client = await createParchmentServerClient(event, { mode: 'session' });
		proxied = await client.catalog.proofCoverage();
	} catch (error) {
		const { status, body } = catalogProxyErrorResponse(error);
		return jsonResponse(body, { status, headers: new Headers() });
	}

	const { data, error, response } = proxied;
	const headers = new Headers();
	forwardCatalogUpstreamHeaders(response, headers);

	return jsonResponse(error ?? data, { status: response.status, headers });
};
