import { checkRole, type UserRole } from '$lib/types/auth.types';

/** Root-layout auth fields used for client-side entitlement display. */
export interface PriceHistoryAuth {
	role?: UserRole | null;
	ppiAccess?: boolean;
}

/**
 * Per-coffee price history is member leverage (ADR-005): member and admin
 * accounts and Parchment Intelligence subscribers. Parchment enforces the same
 * rule server-side; this only decides whether to render the chart or a teaser.
 */
export function canViewPriceHistoryFor(auth: PriceHistoryAuth | null | undefined): boolean {
	return auth?.ppiAccess === true || checkRole(auth?.role ?? undefined, 'member');
}
