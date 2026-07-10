import { describe, expect, it } from 'vitest';
import {
	ROUTE_SKELETON_DELAY_MS,
	getRouteSkeletonKind,
	loadRouteSkeletonComponent,
	shouldShowClientRouteSkeleton
} from './routeSkeletons';

describe('route skeleton registry', () => {
	it('maps primary product routes to their canonical skeletons', () => {
		expect(getRouteSkeletonKind('/catalog')).toBe('catalog');
		expect(getRouteSkeletonKind('/catalog/origins')).toBe('catalog');
		expect(getRouteSkeletonKind('/analytics')).toBe('analytics');
		expect(getRouteSkeletonKind('/beans')).toBe('beans');
		expect(getRouteSkeletonKind('/chat')).toBe('chat');
		expect(getRouteSkeletonKind('/profit')).toBe('profit');
		expect(getRouteSkeletonKind('/roast')).toBe('roast');
		expect(getRouteSkeletonKind('/subscription')).toBe('subscription');
		expect(getRouteSkeletonKind('/api-dashboard/usage')).toBe('dashboard');
	});

	it('does not show the pricing-grid skeleton for the checkout success page', () => {
		expect(getRouteSkeletonKind('/subscription/success')).toBe('generic');
	});

	it('falls back to a generic shell for routes without a dedicated skeleton', () => {
		expect(getRouteSkeletonKind('/docs')).toBe('generic');
		expect(getRouteSkeletonKind(null)).toBe('generic');
	});

	it('keeps the skeleton display threshold inside the fast-navigation window', () => {
		expect(ROUTE_SKELETON_DELAY_MS).toBeGreaterThanOrEqual(100);
		expect(ROUTE_SKELETON_DELAY_MS).toBeLessThanOrEqual(150);
	});

	it('shows route skeletons for cross-route client navigation only', () => {
		expect(
			shouldShowClientRouteSkeleton(
				new URL('https://purveyors.test/catalog?origin=Kenya'),
				new URL('https://purveyors.test/analytics')
			)
		).toBe(true);

		expect(
			shouldShowClientRouteSkeleton(
				new URL('https://purveyors.test/catalog?origin=Kenya'),
				new URL('https://purveyors.test/catalog?origin=Ethiopia')
			)
		).toBe(false);

		expect(
			shouldShowClientRouteSkeleton(
				new URL('https://purveyors.test/catalog'),
				new URL('https://purveyors.test/catalog#results')
			)
		).toBe(false);
	});

	it('lazily resolves a component for every skeleton kind', async () => {
		for (const pathname of ['/analytics', '/catalog', '/chat', '/subscription/success']) {
			const component = await loadRouteSkeletonComponent(pathname);
			expect(component).toBeTruthy();
		}
	});
});
