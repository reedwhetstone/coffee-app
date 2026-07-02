import { env } from '$env/dynamic/private';
import { createParchmentClient, type ParchmentClient } from '@purveyors/sdk';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * Server-only Backend-for-Frontend (BFF) helper for the Parchment API.
 *
 * This module is the single place coffee-app constructs a typed Parchment
 * client. It MUST stay server-only: it reads private configuration (including a
 * public-demo API key) and forwards the caller's Supabase session token as a
 * Bearer credential. Importing it into browser code would leak the access token
 * or the demo key and is unsupported.
 *
 * Auth model: the SDK only forwards a credential. Authorization is enforced
 * server-side by Parchment against the unified principal model. Public catalog
 * reads work without a token; gated calls require one and the API rejects
 * unauthorized requests.
 *
 * Credential modes ({@link ParchmentCredentialMode}) let callers state exactly
 * which credential a server route should present, instead of inferring it. This
 * keeps public, demo-backed pages from accidentally leaking a logged-in user's
 * session token and keeps gated, session-backed routes from silently falling
 * back to the shared demo key.
 */

/** Thrown when required Parchment configuration is missing. */
export class ParchmentConfigError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ParchmentConfigError';
	}
}

/**
 * Explicit credential strategy for a server-side Parchment client.
 *
 * - `public-demo`: present the shared, server-only demo API key
 *   (`PARCHMENT_PUBLIC_DEMO_API_KEY`). Never reads the caller's user session.
 *   Use for public, unauthenticated pages that should show live demo data.
 * - `session`: forward the caller's authenticated credential (Supabase session
 *   token or Authorization header credential). Never falls back to the demo key.
 *   Use for gated, per-user routes.
 * - `anonymous`: send no credential at all. Never reads the session or demo key.
 *   Use for strictly public reads that should hit Parchment as an anonymous
 *   principal.
 */
export type ParchmentCredentialMode = 'public-demo' | 'session' | 'anonymous';

/**
 * How to set the RFC 7240 `Prefer: handling=...` signal on upstream calls.
 *
 * - `lenient` (default): inject `handling=lenient` on any call that does not
 *   already carry a `Prefer` header. This is the first-party web signal for
 *   PADR-0013 §7 — graceful degradation for authenticated page/BFF loads
 *   (unentitled filters stripped with a notice, not an SSR 500).
 * - `inherit`: never inject a first-party default. Forward the incoming
 *   request's own `Prefer` header when present, otherwise send none so Parchment
 *   applies its documented machine/API-key default (strict). Use for public
 *   `/v1/*` API proxy routes that relay Parchment's status/body to external
 *   callers, so entitlement or validation failures surface as real 4xx instead
 *   of a silently downgraded, degraded 2xx.
 */
export type ParchmentPreferHandling = 'lenient' | 'inherit';

/** Options for {@link createParchmentServerClient}. */
export interface CreateParchmentServerClientOptions {
	/**
	 * Which credential to present to Parchment. Defaults to `session`, preserving
	 * the historical behavior of forwarding the caller's session token (and
	 * acting anonymously when there is no session). Public, demo-backed routes
	 * should pass `public-demo` explicitly.
	 */
	mode?: ParchmentCredentialMode;
	/**
	 * How to set the RFC 7240 `Prefer: handling=...` signal. Defaults to
	 * `lenient` for first-party page/BFF loads. Public `/v1/*` API proxy routes
	 * should pass `inherit` so the external caller's preference (or Parchment's
	 * strict default) is preserved. See {@link ParchmentPreferHandling}.
	 */
	preferHandling?: ParchmentPreferHandling;
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
 * Resolve the shared public-demo API key from private env.
 *
 * This key is server-only and deliberately has no `PUBLIC_` prefix: it must
 * never be inlined into client bundles. A missing or blank value is a
 * configuration error so that a misconfigured deploy fails loudly instead of
 * silently serving unauthenticated (and likely empty) demo data.
 */
function resolvePublicDemoToken(): string {
	const demoKey = env.PARCHMENT_PUBLIC_DEMO_API_KEY?.trim();
	if (!demoKey) {
		throw new ParchmentConfigError(
			'PARCHMENT_PUBLIC_DEMO_API_KEY is not configured. Set it to the server-only ' +
				'Parchment demo API key used for public, unauthenticated pages. Do not add a ' +
				'PUBLIC_ prefix — this credential must never reach the browser.'
		);
	}
	return demoKey;
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
 * Resolve the credential to forward to Parchment for the current request in
 * `session` mode.
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
 * endpoints are usable without a credential. This path deliberately never reads
 * the public-demo key — `session` mode must not silently borrow shared demo
 * credentials for a user who is simply unauthenticated.
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
 * Resolve the credential for a given {@link ParchmentCredentialMode}.
 *
 * Each mode is isolated on purpose:
 * - `public-demo` reads only the demo key and never touches the user session.
 * - `session` reads only the user session and never touches the demo key.
 * - `anonymous` reads neither.
 */
async function resolveTokenForMode(
	event: RequestEvent,
	mode: ParchmentCredentialMode
): Promise<string | undefined> {
	switch (mode) {
		case 'public-demo':
			return resolvePublicDemoToken();
		case 'session':
			return resolveSessionToken(event);
		case 'anonymous':
			return undefined;
	}
}

/**
 * Create a server-side Parchment client bound to the current request.
 *
 * The credential presented to Parchment is selected by `options.mode`
 * ({@link ParchmentCredentialMode}), defaulting to `session` to preserve the
 * historical behavior of forwarding the caller's session token. Requests are
 * always routed through SvelteKit's `event.fetch`.
 *
 * - `session` (default): forwards the caller's session/header credential, or
 *   acts anonymously when none is present. Never uses the demo key.
 * - `public-demo`: presents the shared server-only demo key and never reads the
 *   user session. Throws {@link ParchmentConfigError} if the key is unset.
 * - `anonymous`: presents no credential and reads neither session nor demo key.
 */
/**
 * Wrap SvelteKit's `event.fetch` to set the RFC 7240 `Prefer: handling=...`
 * signal for PADR-0013 §7 strict-vs-lenient handling.
 *
 * - `lenient`: inject `handling=lenient` on any call that does not already carry
 *   a `Prefer` header. This is the first-party web signal — authenticated web
 *   users reach the API as a bearer-session JWT (which defaults to `strict`, the
 *   machine-caller behavior), but the website wants graceful degradation
 *   (unentitled filters stripped with a notice, not an SSR 500), so it opts in.
 * - `inherit`: inject nothing of its own. Forward `inheritedPrefer` (the
 *   external caller's incoming `Prefer` header) when present, otherwise leave the
 *   call header-less so Parchment applies its documented strict default. Public
 *   `/v1/*` API proxy routes use this so relayed entitlement/validation failures
 *   are not silently downgraded to a degraded 2xx.
 *
 * A caller can always override per request by setting its own `Prefer` header.
 */
function withPreferHandling(
	baseFetch: typeof fetch,
	preferHandling: ParchmentPreferHandling,
	inheritedPrefer: string | undefined
): typeof fetch {
	return (input, init) => {
		// openapi-fetch builds a `Request` carrying credential/content-type headers
		// and invokes this as `fetch(request)` with no `init`. Seed the header set
		// from that `Request` first so the `headers` we pass below augments rather
		// than replaces it — otherwise `baseFetch(request, { ...init, headers })`
		// would rebuild the request with only our headers and drop `Authorization`
		// (and a POST's `Content-Type`), making gated calls arrive unauthenticated.
		// `init.headers` layers on top for the rare direct `fetch(url, init)` caller.
		const headers = new Headers(input instanceof Request ? input.headers : undefined);
		if (init?.headers) {
			new Headers(init.headers).forEach((value, key) => headers.set(key, value));
		}
		if (!headers.has('prefer')) {
			if (preferHandling === 'lenient') {
				headers.set('Prefer', 'handling=lenient');
			} else if (inheritedPrefer) {
				headers.set('Prefer', inheritedPrefer);
			}
		}
		return baseFetch(input, { ...init, headers });
	};
}

export async function createParchmentServerClient(
	event: RequestEvent,
	options?: CreateParchmentServerClientOptions
): Promise<ParchmentClient> {
	const baseUrl = resolveBaseUrl();
	const mode = options?.mode ?? 'session';
	const preferHandling = options?.preferHandling ?? 'lenient';
	const token = await resolveTokenForMode(event, mode);

	// In `inherit` mode, carry the external caller's own preference forward rather
	// than imposing a first-party default. Ignored in `lenient` mode.
	const inheritedPrefer =
		preferHandling === 'inherit'
			? (event.request.headers.get('prefer') ?? undefined)
			: undefined;

	return createParchmentClient({
		baseUrl,
		token,
		fetch: withPreferHandling(event.fetch, preferHandling, inheritedPrefer)
	});
}
