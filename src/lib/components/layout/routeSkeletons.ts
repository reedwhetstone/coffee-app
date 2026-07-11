import type { UserRole } from '$lib/types/auth.types';

export type RouteSkeletonKind =
	| 'analytics'
	| 'access-gate'
	| 'beans'
	| 'catalog'
	| 'chat'
	| 'dashboard'
	| 'profit'
	| 'roast'
	| 'subscription'
	| 'subscription-success'
	| 'generic';

export type RouteSkeletonAccess = {
	authenticated?: boolean;
	role?: UserRole;
	ppiAccess?: boolean;
};

function canUseChat(access: RouteSkeletonAccess): boolean {
	return Boolean(
		access.authenticated &&
			(access.ppiAccess || access.role === 'member' || access.role === 'admin')
	);
}

export function getRouteSkeletonKind(
	pathname: string | null | undefined,
	access: RouteSkeletonAccess = {}
): RouteSkeletonKind {
	const path = pathname ?? '/';

	if (path === '/analytics' || path.startsWith('/analytics/')) return 'analytics';
	if (path === '/beans' || path.startsWith('/beans/')) return 'beans';
	if (path === '/catalog' || path.startsWith('/catalog/')) return 'catalog';
	if (path === '/chat' || path.startsWith('/chat/')) {
		return canUseChat(access) ? 'chat' : 'access-gate';
	}
	if (path === '/profit' || path.startsWith('/profit/')) return 'profit';
	if (path === '/roast' || path.startsWith('/roast/')) return 'roast';
	if (path === '/subscription/success') return 'subscription-success';
	if (path === '/subscription' || path.startsWith('/subscription/')) return 'subscription';
	if (path === '/dashboard' || path.startsWith('/dashboard/')) return 'dashboard';

	return 'generic';
}

function hasTrustedDestinationGeometry(pathname: string): boolean {
	if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) return false;
	if (pathname === '/api-dashboard' || pathname.startsWith('/api-dashboard/')) return false;
	if (pathname === '/subscription') return false;
	return true;
}

export function shouldShowClientRouteSkeleton(
	from: URL | null | undefined,
	to: URL | null | undefined
): boolean {
	if (!from || !to) return false;
	if (from.pathname === to.pathname) return false;
	if (!hasTrustedDestinationGeometry(to.pathname)) return false;

	return true;
}
