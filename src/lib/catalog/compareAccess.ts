import { checkRole, type UserRole } from '$lib/types/auth.types';

export interface CompareAuth {
	isSignedIn?: boolean;
	role?: UserRole | null;
	ppiAccess?: boolean;
}

/** Mirrors Parchment's limits: viewers 2, members and Intelligence 6, signed out 0. */
export const VIEWER_COMPARE_MAX = 2;
export const FULL_COMPARE_MAX = 6;

export function compareLimitFor(auth: CompareAuth | null | undefined): number {
	if (!auth?.isSignedIn) return 0;
	if (auth.ppiAccess === true || checkRole(auth.role ?? undefined, 'member'))
		return FULL_COMPARE_MAX;
	return VIEWER_COMPARE_MAX;
}

/**
 * A selection can open a comparison only when it has at least two coffees and
 * fits the current limit. A selection kept from an earlier session or account
 * can exceed it, or the visitor may now be signed out (limit 0).
 */
export function canOpenComparison(count: number, limit: number): boolean {
	return count >= 2 && limit > 0 && count <= limit;
}

export function compareHref(ids: number[], quantityLbs?: number): string {
	const params = new URLSearchParams({ ids: ids.join(',') });
	if (quantityLbs && quantityLbs !== 1) params.set('quantityLbs', String(quantityLbs));
	return `/catalog/compare?${params.toString()}`;
}

/** Sign-in link that returns to the current page, comparison query included. */
export function signInHref(url: URL): string {
	return `/auth?${new URLSearchParams({ next: url.pathname + url.search }).toString()}`;
}
