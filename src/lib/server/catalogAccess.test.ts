import { describe, expect, it } from 'vitest';
import { resolveCatalogAccessCapabilities } from './catalogAccess';
import type { RequestPrincipal } from './principal';

function sessionPrincipal(role: 'viewer' | 'member' | 'admin'): RequestPrincipal {
	return {
		authKind: 'session',
		isAuthenticated: true,
		primaryAppRole: role,
		apiPlan: 'viewer'
	} as RequestPrincipal;
}

function apiPrincipal(apiPlan: 'viewer' | 'member' | 'enterprise'): RequestPrincipal {
	return {
		authKind: 'api-key',
		isAuthenticated: true,
		primaryAppRole: 'viewer',
		apiPlan
	} as RequestPrincipal;
}

describe('resolveCatalogAccessCapabilities', () => {
	it('keeps anonymous and viewer access in read/evaluation mode', () => {
		const anonymous = resolveCatalogAccessCapabilities();
		const viewer = resolveCatalogAccessCapabilities({ principal: sessionPrincipal('viewer') });

		for (const capabilities of [anonymous, viewer]) {
			expect(capabilities.canViewPublicCatalog).toBe(true);
			expect(capabilities.canUseBasicFilters).toBe(true);
			expect(capabilities.canViewFullCatalog).toBe(false);
			expect(capabilities.canUseProcessFacets).toBe(false);
			expect(capabilities.canViewPremiumFilterMetadata).toBe(false);
			expect(capabilities.canUseAdvancedFilters).toBe(false);
		}
	});

	it('grants member and admin sessions advanced catalog leverage', () => {
		for (const role of ['member', 'admin'] as const) {
			const capabilities = resolveCatalogAccessCapabilities({ principal: sessionPrincipal(role) });

			expect(capabilities.canViewFullCatalog).toBe(true);
			expect(capabilities.canViewWholesale).toBe(true);
			expect(capabilities.canUseProcessFacets).toBe(true);
			expect(capabilities.canUsePriceScoreRanges).toBe(true);
			expect(capabilities.canUseAdvancedSorts).toBe(true);
			expect(capabilities.canViewPremiumFilterMetadata).toBe(true);
		}
	});

	it('keeps API Green basic while allowing paid API plans to use premium query facets', () => {
		const green = resolveCatalogAccessCapabilities({ principal: apiPrincipal('viewer') });
		const origin = resolveCatalogAccessCapabilities({ principal: apiPrincipal('member') });
		const enterprise = resolveCatalogAccessCapabilities({ principal: apiPrincipal('enterprise') });

		expect(green.canUseBasicFilters).toBe(true);
		expect(green.canUseProcessFacets).toBe(false);
		expect(green.canViewPremiumFilterMetadata).toBe(false);
		expect(origin.canUseProcessFacets).toBe(true);
		expect(origin.canViewPremiumFilterMetadata).toBe(true);
		expect(enterprise.canUseProcessFacets).toBe(true);
		expect(enterprise.canViewPremiumFilterMetadata).toBe(true);
	});
});
