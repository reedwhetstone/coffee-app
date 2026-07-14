/** Routes that must render without the authenticated app chrome or public header. */
export function usesStandaloneShell(pathname: string): boolean {
	return pathname === '/auth/cli' || pathname.startsWith('/auth/cli/');
}
