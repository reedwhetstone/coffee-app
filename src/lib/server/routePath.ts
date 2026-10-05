/**
 * The path SvelteKit matches routes against. It decodes the pathname before matching, so
 * `/%72oast` reaches the `/roast` route. Anything that decides by path prefix compares against
 * this form, never the raw pathname. Returns null when the pathname cannot be decoded.
 */
export function decodeRoutePath(pathname: string): string | null {
	try {
		return pathname.split('%25').map(decodeURI).join('%25');
	} catch {
		return null;
	}
}
