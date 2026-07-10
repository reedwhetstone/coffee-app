export type RouteSkeletonKind =
	| 'analytics'
	| 'beans'
	| 'catalog'
	| 'chat'
	| 'dashboard'
	| 'profit'
	| 'roast'
	| 'subscription'
	| 'subscription-success'
	| 'generic';

export function getRouteSkeletonKind(pathname: string | null | undefined): RouteSkeletonKind {
	const path = pathname ?? '/';

	if (path === '/analytics' || path.startsWith('/analytics/')) return 'analytics';
	if (path === '/beans' || path.startsWith('/beans/')) return 'beans';
	if (path === '/catalog' || path.startsWith('/catalog/')) return 'catalog';
	if (path === '/chat' || path.startsWith('/chat/')) return 'chat';
	if (path === '/profit' || path.startsWith('/profit/')) return 'profit';
	if (path === '/roast' || path.startsWith('/roast/')) return 'roast';
	if (path === '/subscription/success') return 'subscription-success';
	if (path === '/subscription' || path.startsWith('/subscription/')) return 'subscription';
	if (
		path === '/dashboard' ||
		path.startsWith('/dashboard/') ||
		path === '/api-dashboard' ||
		path.startsWith('/api-dashboard/')
	) {
		return 'dashboard';
	}

	return 'generic';
}

export function shouldShowClientRouteSkeleton(
	from: URL | null | undefined,
	to: URL | null | undefined
): boolean {
	if (!from || !to) return false;
	if (from.pathname === to.pathname) return false;

	return true;
}
