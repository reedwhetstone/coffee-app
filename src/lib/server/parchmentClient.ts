import { env } from '$env/dynamic/private';
import { createParchmentClient, type ParchmentClient } from '@purveyors/sdk';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * Server-only Backend-for-Frontend (BFF) helper for the Parchment API.
 *
 * This module is the single place coffee-app constructs a typed Parchment
 * client. It MUST stay server-only: it reads private configuration and forwards
 * the caller's Supabase session token as a Bearer credential. Importing it into
 * browser code would leak the access token and is unsupported.
 *
 * Auth model: the SDK only forwards a credential. Authorization is enforced
 * server-side by Parchment against the unified principal model. Public catalog
 * reads work without a token; gated calls require one and the API rejects
 * unauthorized requests.
 */

/** Thrown when required Parchment configuration is missing. */
export class ParchmentConfigError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ParchmentConfigError';
	}
}

/**
 * Resolve the Parchment API base URL from private env.
 *
 * There is no conservative default yet (the variable is newly introduced), so a
 * missing value is a configuration error rather than a silent fallback.
 */
function resolveBaseUrl(): string {
	const baseUrl = env.PARCHMENT_API_BASE_URL?.trim();
	if (!baseUrl) {
		throw new ParchmentConfigError(
			'PARCHMENT_API_BASE_URL is not configured. Set it to the Parchment API base URL ' +
				'(e.g. https://api.purveyors.io) in the server environment.'
		);
	}
	return baseUrl;
}

/**
 * Extract a `Bearer` credential from the incoming request's Authorization
 * header. Covers both bearer session tokens and API keys, which the principal
 * resolver accepts in the same header form. Returns `undefined` when absent.
 */
function resolveAuthorizationHeaderToken(event: RequestEvent): string | undefined {
	const authHeader = event.request.headers.get('authorization');
	if (!authHeader?.startsWith('Bearer ')) {
		return undefined;
	}

	const token = authHeader.slice('Bearer '.length).trim();
	return token.length > 0 ? token : undefined;
}

/**
 * Resolve the credential to forward to Parchment for the current request.
 *
 * Precedence mirrors `resolvePrincipal` in the auth hook: when the request
 * carries an `Authorization` header, the hook authenticates against that header
 * alone and never consults the Supabase cookie. We honor the same authority
 * here. Otherwise a mixed-credential request (`Authorization` API key/bearer
 * *plus* a Supabase cookie) would forward the cookie user's access token instead
 * of the API key that was actually authorized, letting `safeGetSession()` win
 * over the authoritative header credential and presenting the wrong principal to
 * Parchment.
 *
 * - Authorization header present + principal authenticated: forward the header
 *   credential (bearer session token or API key).
 * - Authorization header present but not authenticated (invalid header): forward
 *   nothing — the hook treats this as anonymous and does not fall back to the
 *   cookie, so neither do we.
 * - No Authorization header: cookie-authenticated path. Prefer the already
 *   resolved `event.locals.session`, falling back to `safeGetSession()` for
 *   callers that run before/around hook resolution.
 *
 * Returns `undefined` for anonymous callers, which is intentional: public
 * endpoints are usable without a credential.
 */
async function resolveSessionToken(event: RequestEvent): Promise<string | undefined> {
	if (event.request.headers.get('authorization') !== null) {
		return event.locals.principal?.isAuthenticated
			? resolveAuthorizationHeaderToken(event)
			: undefined;
	}

	const directToken = event.locals.session?.access_token;
	if (directToken) {
		return directToken;
	}

	if (typeof event.locals.safeGetSession === 'function') {
		const { session } = await event.locals.safeGetSession();
		return session?.access_token ?? undefined;
	}

	return undefined;
}

/**
 * Create a server-side Parchment client bound to the current request.
 *
 * Forwards the caller's Supabase session token (when present) as a Bearer
 * credential and routes requests through SvelteKit's `event.fetch`. Safe to call
 * for anonymous requests; the resulting client simply omits the Authorization
 * header.
 */
export async function createParchmentServerClient(event: RequestEvent): Promise<ParchmentClient> {
	const baseUrl = resolveBaseUrl();
	const token = await resolveSessionToken(event);

	return createParchmentClient({
		baseUrl,
		token,
		fetch: event.fetch
	});
}
