import { describe, expect, it } from 'vitest';
import { getRouteSkeletonKind, shouldShowClientRouteSkeleton } from './routeSkeletons';

describe('route skeleton registry', () => {
	it('maps primary product routes to their canonical skeletons', () => {
		expect(getRouteSkeletonKind('/catalog')).toBe('catalog');
		expect(getRouteSkeletonKind('/catalog/origins')).toBe('catalog');
		expect(getRouteSkeletonKind('/analytics')).toBe('analytics');
		expect(getRouteSkeletonKind('/beans')).toBe('beans');
		expect(getRouteSkeletonKind('/chat', { authenticated: true, role: 'member' })).toBe('chat');
		expect(getRouteSkeletonKind('/profit')).toBe('profit');
		expect(getRouteSkeletonKind('/roast')).toBe('roast');
		expect(getRouteSkeletonKind('/subscription')).toBe('subscription');
		expect(getRouteSkeletonKind('/subscription/success')).toBe('subscription-success');
		expect(getRouteSkeletonKind('/api-dashboard/usage', { authenticated: true })).toBe('generic');
	});

	it('uses an access-gate shell unless chat is available to the current user', () => {
		expect(getRouteSkeletonKind('/chat')).toBe('access-gate');
		expect(getRouteSkeletonKind('/chat', { authenticated: true, role: 'viewer' })).toBe(
			'access-gate'
		);
		expect(
			getRouteSkeletonKind('/chat', {
				authenticated: true,
				role: 'viewer',
				ppiAccess: true
			})
		).toBe('chat');
	});

	it('falls back to a generic shell for routes without a dedicated skeleton', () => {
		expect(getRouteSkeletonKind('/docs')).toBe('generic');
		expect(getRouteSkeletonKind(null)).toBe('generic');
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

	it('keeps current content for destinations without trusted skeleton geometry', () => {
		const from = new URL('https://purveyors.test/catalog');
		for (const destination of ['/dashboard', '/api-dashboard/usage', '/subscription']) {
			expect(
				shouldShowClientRouteSkeleton(from, new URL(destination, 'https://purveyors.test'))
			).toBe(false);
		}
		expect(
			shouldShowClientRouteSkeleton(
				from,
				new URL('/subscription/success', 'https://purveyors.test')
			)
		).toBe(true);
	});
});
