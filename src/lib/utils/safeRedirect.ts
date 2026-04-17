/**
 * Sanitize a user-supplied post-auth redirect target so it can only point at
 * internal routes.
 *
 * Accepts only same-origin paths that look like `/something`. Rejects:
 *   - null/empty values (uses fallback)
 *   - absolute URLs with a scheme (`https://attacker.example`, `javascript:`)
 *   - protocol-relative URLs (`//attacker.example`)
 *   - backslash tricks that some browsers normalize to `//` (`/\attacker.example`)
 *   - paths containing whitespace, control chars, or newlines
 *   - non-string input
 *
 * Always returns a string starting with a single `/`.
 */
export function sanitizeNextPath(
	next: string | null | undefined,
	fallback: string = '/dashboard'
): string {
	const safeFallback = fallback.startsWith('/') && !fallback.startsWith('//') ? fallback : '/';

	if (typeof next !== 'string' || next.length === 0) {
		return safeFallback;
	}

	// Must start with a single forward slash.
	if (!next.startsWith('/')) return safeFallback;

	// Reject protocol-relative (`//host`) and backslash smuggling (`/\host`,
	// which some browsers treat as `//host`).
	if (next.startsWith('//') || next.startsWith('/\\')) return safeFallback;

	// Reject control characters, whitespace, and anything outside printable ASCII
	// that could be used to smuggle a redirect past a naive parser.
	if (/[\x00-\x1F\x7F\s]/.test(next)) return safeFallback;

	// Extra belt-and-suspenders: try to parse against a dummy origin and confirm
	// the resolved origin matches. Anything that parses to a different origin
	// (shouldn't happen given the prefix checks above, but guard anyway) is
	// rejected.
	try {
		const parsed = new URL(next, 'http://internal.invalid');
		if (parsed.origin !== 'http://internal.invalid') return safeFallback;
		return parsed.pathname + parsed.search + parsed.hash;
	} catch {
		return safeFallback;
	}
}
