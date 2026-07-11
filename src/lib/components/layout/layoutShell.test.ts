import { describe, expect, it } from 'vitest';
import { resolveLayoutRouteState, resolveLayoutShell, usesPublicShell } from './layoutShell';

describe('root layout route state contract', () => {
	it('keeps shell decisions committed while a delayed cross-shell destination selects the skeleton', () => {
		const route = resolveLayoutRouteState('/roast', '/blog/context-windows');

		expect(resolveLayoutShell(route.committedPathname, true)).toBe('app');
		expect(usesPublicShell(route.committedPathname)).toBe(false);
		expect(route.skeletonPathname).toBe('/blog/context-windows');
	});

	it('clears or replaces only the pending skeleton destination during cancellation and rapid redirects', () => {
		const firstDestination = resolveLayoutRouteState('/roast', '/blog/first');
		const redirectedDestination = resolveLayoutRouteState(
			firstDestination.committedPathname,
			'/subscription'
		);
		const cancelled = resolveLayoutRouteState(redirectedDestination.committedPathname, null);

		expect(firstDestination).toEqual({
			committedPathname: '/roast',
			skeletonPathname: '/blog/first'
		});
		expect(redirectedDestination).toEqual({
			committedPathname: '/roast',
			skeletonPathname: '/subscription'
		});
		expect(cancelled).toEqual({ committedPathname: '/roast', skeletonPathname: null });
		expect(resolveLayoutShell(cancelled.committedPathname, true)).toBe('app');
	});
});
