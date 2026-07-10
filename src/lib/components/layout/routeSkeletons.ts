import type { Component } from 'svelte';

export type RouteSkeletonKind =
	| 'analytics'
	| 'beans'
	| 'catalog'
	| 'chat'
	| 'dashboard'
	| 'profit'
	| 'roast'
	| 'subscription'
	| 'generic';

/**
 * How long a client navigation must stay pending before the destination
 * skeleton replaces the current page. Fast and prefetched navigations finish
 * inside this window, so their content is never torn down; the immediate
 * feedback for those is the thin NavigationProgress bar.
 */
export const ROUTE_SKELETON_DELAY_MS = 125;

export function getRouteSkeletonKind(pathname: string | null | undefined): RouteSkeletonKind {
	const path = pathname ?? '/';

	if (path === '/analytics' || path.startsWith('/analytics/')) return 'analytics';
	if (path === '/beans' || path.startsWith('/beans/')) return 'beans';
	if (path === '/catalog' || path.startsWith('/catalog/')) return 'catalog';
	if (path === '/chat' || path.startsWith('/chat/')) return 'chat';
	if (path === '/profit' || path.startsWith('/profit/')) return 'profit';
	if (path === '/roast' || path.startsWith('/roast/')) return 'roast';
	// /subscription/success is a checkout hand-off page, not the pricing grid;
	// the four-card pricing skeleton would misrepresent what resolves there.
	if (path === '/subscription') return 'subscription';
	if (path.startsWith('/subscription/') && path !== '/subscription/success') return 'subscription';
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

// Route-owned skeletons are the source of truth: each destination maps to the
// same component the route itself renders while loading, imported lazily so
// none of them land in the persistent root chunk. The chunks are warmed as
// soon as a cross-route navigation starts, before the display threshold hits.
const ROUTE_SKELETON_LOADERS: Record<RouteSkeletonKind, () => Promise<{ default: Component }>> = {
	analytics: () => import('$lib/components/analytics/AnalyticsPageSkeleton.svelte'),
	beans: () => import('$lib/components/BeansPageSkeleton.svelte'),
	catalog: () => import('$lib/components/CatalogPageSkeleton.svelte'),
	chat: () => import('$lib/components/layout/skeletons/ChatRouteSkeleton.svelte'),
	dashboard: () => import('$lib/components/layout/skeletons/DashboardRouteSkeleton.svelte'),
	profit: () => import('$lib/components/ProfitPageSkeleton.svelte'),
	roast: () => import('$lib/components/RoastPageSkeleton.svelte'),
	subscription: () => import('$lib/components/layout/skeletons/SubscriptionRouteSkeleton.svelte'),
	generic: () => import('$lib/components/layout/skeletons/GenericRouteSkeleton.svelte')
};

export function loadRouteSkeletonComponent(
	pathname: string | null | undefined
): Promise<Component | null> {
	return ROUTE_SKELETON_LOADERS[getRouteSkeletonKind(pathname)]()
		.then((module) => module.default)
		.catch(() => null);
}
