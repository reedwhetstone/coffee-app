export type LayoutShell = 'marketing' | 'app' | 'public';

export interface LayoutRouteState {
	/** The only pathname allowed to control shell, header, and chat chrome. */
	committedPathname: string;
	/** A pending destination used only to select destination skeleton content. */
	skeletonPathname: string | null;
}

export function resolveLayoutRouteState(
	committedPathname: string,
	pendingDestinationPathname: string | null
): LayoutRouteState {
	return {
		committedPathname,
		skeletonPathname: pendingDestinationPathname
	};
}

export function usesPublicShell(pathname: string): boolean {
	return (
		pathname === '/' ||
		pathname === '/api' ||
		pathname === '/subscription' ||
		pathname.startsWith('/docs') ||
		pathname.startsWith('/blog')
	);
}

/** Resolve chrome from the committed route only, never a pending destination. */
export function resolveLayoutShell(pathname: string, authenticated: boolean): LayoutShell {
	if (pathname === '/') return 'marketing';
	if (authenticated && !usesPublicShell(pathname)) return 'app';
	return 'public';
}
