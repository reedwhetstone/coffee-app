export type LayoutShell = 'marketing' | 'app' | 'public';

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
