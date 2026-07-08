import { describe, expect, it } from 'vitest';
import { getRouteSkeletonKind, shouldShowClientRouteSkeleton } from './routeSkeletons';

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
		expect(getRouteSkeletonKind('/subscription/success')).toBe('subscription');
		expect(getRouteSkeletonKind('/api-dashboard/usage')).toBe('dashboard');
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
});
