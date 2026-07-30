import {
	isCookieSessionPrincipal,
	principalHasRole,
	type RequestPrincipal
} from '$lib/server/principal';

export interface CatalogVisibilityInput {
	principal: RequestPrincipal;
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
	input: Pick<CatalogVisibilityInput, 'principal'>
): boolean {
	return isCookieSessionPrincipal(input.principal) && principalHasRole(input.principal, 'member');
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
