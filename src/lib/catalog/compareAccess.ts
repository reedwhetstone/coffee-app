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

export function compareHref(ids: number[], quantityLbs?: number): string {
	const params = new URLSearchParams({ ids: ids.join(',') });
	if (quantityLbs && quantityLbs !== 1) params.set('quantityLbs', String(quantityLbs));
	return `/catalog/compare?${params.toString()}`;
}
