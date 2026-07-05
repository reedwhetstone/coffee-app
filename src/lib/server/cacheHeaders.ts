/**
 * Session-aware catalog cache headers for the thin BFF.
 *
 * Parchment (PR5 Lane A) emits the authoritative cache policy, but the browser
 * hop into this BFF authenticates via COOKIES, so the upstream `Vary:
 * Authorization` is meaningless here. If the BFF relayed `public, s-maxage`
 * verbatim (PADR-0015's default relay rule), a shared cache in front of
 * coffee-app (Vercel) could serve a cached anonymous projection to a logged-in
 * member. This module re-derives the cache header from the BFF's own session
 * view instead: only anonymous callers get the public, short-TTL policy; every
 * authenticated caller (cookie session or API key) is forced to `private,
 * no-store`. Error responses are never shared-cacheable.
 *
 * This is the one sanctioned exception to PADR-0015 verbatim header relay: the
 * BFF rewrites Cache-Control session-aware rather than relaying it.
 */

/** Public, short-TTL + SWR policy — mirrors the Parchment Lane A contract exactly. */
export const BFF_PUBLIC_CATALOG_CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=300';

/** Private / uncacheable policy for any authenticated caller or error. */
export const BFF_PRIVATE_CATALOG_CACHE_CONTROL = 'private, no-store';

/**
 * The cache-control string for a catalog read, given whether the caller is
 * authenticated. Fail-closed: anything other than an explicit anonymous caller
 * is private.
 */
export function resolveBffCatalogCacheControl(isAuthenticated: boolean): string {
	return isAuthenticated ? BFF_PRIVATE_CATALOG_CACHE_CONTROL : BFF_PUBLIC_CATALOG_CACHE_CONTROL;
}

/** Merge a token into an existing `Vary` header without duplicating it. */
function appendVary(into: Headers, token: string): void {
	const existing = into.get('Vary');
	if (!existing) {
		into.set('Vary', token);
		return;
	}
	const tokens = existing.split(',').map((entry) => entry.trim().toLowerCase());
	if (!tokens.includes(token.toLowerCase())) {
		into.set('Vary', `${existing}, ${token}`);
	}
}

/**
 * Apply the session-aware catalog cache policy to `into`. Anonymous callers get
 * the public short-TTL policy plus `Vary: Cookie` (so a shared cache keys on the
 * session cookie and cannot serve a public entry to a logged-in member);
 * authenticated callers get `private, no-store`.
 */
export function applyBffCatalogCacheHeaders(into: Headers, isAuthenticated: boolean): Headers {
	into.set('Cache-Control', resolveBffCatalogCacheControl(isAuthenticated));
	if (!isAuthenticated) {
		appendVary(into, 'Cookie');
	}
	return into;
}

/** Force `no-store`. Error responses must never be shared-cacheable. */
export function applyBffCatalogNoStore(into: Headers): Headers {
	into.set('Cache-Control', BFF_PRIVATE_CATALOG_CACHE_CONTROL);
	return into;
}
