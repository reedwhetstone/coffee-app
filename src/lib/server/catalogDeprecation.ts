import { env } from '$env/dynamic/private';

/**
 * Shared deprecation metadata for coffee-app's catalog proxy surfaces.
 *
 * The catalog listing routes in this repo are thin proxies in front of the
 * canonical Parchment API (ADR-007). External consumers should cut over to the
 * Parchment surface directly; these headers advertise the successor URL and the
 * date after which the local proxy may be removed.
 */

/** Date after which the deprecated local catalog proxy routes may be removed. */
export const CATALOG_PROXY_SUNSET = 'Thu, 31 Dec 2026 23:59:59 GMT';

/**
 * Build an absolute `successor-version` link to the canonical Parchment surface.
 *
 * Falls back to the relative path when `PARCHMENT_API_BASE_URL` is not configured
 * so the deprecation header is still emitted instead of throwing on a public read.
 */
function resolveSuccessorLink(path: string): string {
	const baseUrl = env.PARCHMENT_API_BASE_URL?.trim();
	const target = baseUrl ? `${baseUrl.replace(/\/+$/, '')}${path}` : path;
	return `<${target}>; rel="successor-version"`;
}

/**
 * Merge Deprecation, successor-version Link, and Sunset headers onto the provided
 * headers, pointing external consumers at the canonical Parchment surface.
 */
export function withCatalogDeprecationHeaders(
	successorPath: string,
	headers: HeadersInit = {}
): Headers {
	const merged = new Headers(headers);
	merged.set('Deprecation', 'true');
	merged.set('Link', resolveSuccessorLink(successorPath));
	merged.set('Sunset', CATALOG_PROXY_SUNSET);
	return merged;
}
