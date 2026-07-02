import type { RequestHandler } from './$types';
import { jsonResponse } from '$lib/server/http';
import {
	forwardProcurementUpstreamHeaders,
	procurementProxyErrorResponse,
	proxyBriefCreate,
	proxyBriefsList
} from '$lib/server/procurementProxy';
import {
	isSessionPrincipal,
	isTrustedMutationRequest,
	resolvePrincipal
} from '$lib/server/principal';

// Thin proxy in front of the canonical Parchment /v1/procurement/briefs surface
// (PADR-0012). Parchment owns storage, criteria validation, matching, auth,
// entitlement, and rate limiting; these handlers forward the caller credential
// and relay the upstream response verbatim.

export const GET: RequestHandler = async (event) => {
	// Reject a present-but-invalid Authorization header before proxying. The auth
	// hook leaves such a request anonymous, and `session` mode forwards no
	// credential, so without this guard an invalid/expired bearer would silently be
	// served anonymously instead of the documented 401. Mirrors /v1/catalog.
	const principal = await resolvePrincipal(event);
	if (event.request.headers.has('Authorization') && !principal.isAuthenticated) {
		return jsonResponse(
			{ error: 'Authentication required', message: 'Authentication required' },
			{ status: 401 }
		);
	}

	let proxied: Awaited<ReturnType<typeof proxyBriefsList>>;
	try {
		proxied = await proxyBriefsList(event);
	} catch (error) {
		const { status, body } = procurementProxyErrorResponse(error);
		return jsonResponse(body, { status, headers: new Headers() });
	}

	const { status, body, upstream } = proxied;
	const headers = new Headers();
	forwardProcurementUpstreamHeaders(upstream, headers);
	return jsonResponse(body, { status, headers });
};

export const POST: RequestHandler = async (event) => {
	const principal = await resolvePrincipal(event);
	// Gated mutation: resolve access before the body is parsed. A create with no
	// authenticated principal can only ever get Parchment's auth-required 401, so
	// short-circuit here. Otherwise proxyBriefCreate parses the body first and a
	// malformed anonymous payload would surface as the local 400, leaking body
	// validation ahead of auth and breaking the documented auth-first contract.
	// Also covers a present-but-invalid Authorization header, which the auth hook
	// leaves anonymous.
	if (!principal.isAuthenticated) {
		return jsonResponse(
			{ error: 'Authentication required', message: 'Authentication required' },
			{ status: 401 }
		);
	}

	// CSRF guard on the first mutating proxy: `session` mode forwards the caller's
	// Supabase cookie token as Bearer when no Authorization header is present, so a
	// cross-site cookie POST could otherwise create briefs. Block untrusted-origin
	// session mutations BEFORE proxying. Requests carrying an Authorization header
	// are not cookie-CSRF-exposed and skip this check.
	if (isSessionPrincipal(principal) && !isTrustedMutationRequest(event, principal)) {
		return jsonResponse(
			{ error: 'Insufficient permissions', message: 'Cross-site session mutation blocked' },
			{ status: 403 }
		);
	}

	let proxied: Awaited<ReturnType<typeof proxyBriefCreate>>;
	try {
		proxied = await proxyBriefCreate(event);
	} catch (error) {
		const { status, body } = procurementProxyErrorResponse(error);
		return jsonResponse(body, { status, headers: new Headers() });
	}

	const { status, body, upstream } = proxied;
	const headers = new Headers();
	forwardProcurementUpstreamHeaders(upstream, headers);
	return jsonResponse(body, { status, headers });
};
