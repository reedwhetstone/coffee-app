import type { Session } from '@supabase/supabase-js';
import { checkRole, type UserRole } from '$lib/types/auth.types';

export interface CatalogVisibilityInput {
	session: Session | null | undefined;
	role: UserRole | null | undefined;
	showWholesaleRequested?: boolean;
	wholesaleOnlyRequested?: boolean;
}

export interface CatalogVisibility {
	isPrivilegedSession: boolean;
	publicOnly: boolean;
	showWholesale: boolean;
	wholesaleOnly: boolean;
}

export function hasPrivilegedCatalogSession(
	input: Pick<CatalogVisibilityInput, 'session' | 'role'>
): boolean {
	return Boolean(input.session) && checkRole(input.role ?? undefined, 'member');
}

export function resolveCatalogVisibility(input: CatalogVisibilityInput): CatalogVisibility {
	const isPrivilegedSession = hasPrivilegedCatalogSession(input);
	const wholesaleOnly = isPrivilegedSession && Boolean(input.wholesaleOnlyRequested);

	return {
		isPrivilegedSession,
		publicOnly: !isPrivilegedSession,
		showWholesale: wholesaleOnly || input.showWholesaleRequested !== false,
		wholesaleOnly
	};
}
