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

const anonymousPrincipal = {
	authKind: 'anonymous',
	isAuthenticated: false,
	primaryAppRole: null,
	apiPlan: null
} as RequestPrincipal;

describe('resolveCatalogAccessCapabilities', () => {
	it('keeps anonymous and viewer access in read/evaluation mode', () => {
		const anonymous = resolveCatalogAccessCapabilities({ principal: anonymousPrincipal });
		const viewer = resolveCatalogAccessCapabilities({ principal: sessionPrincipal('viewer') });

		for (const capabilities of [anonymous, viewer]) {
			expect(capabilities.canViewPublicCatalog).toBe(true);
			expect(capabilities.canViewWholesale).toBe(true);
			expect(capabilities.canUseBasicFilters).toBe(true);
			expect(capabilities.canViewFullCatalog).toBe(false);
			expect(capabilities.canUseProcessFacets).toBe(false);
			expect(capabilities.canUseBeanMatching).toBe(false);
			expect(capabilities.canViewPremiumFilterMetadata).toBe(false);
			expect(capabilities.canUseAdvancedFilters).toBe(false);
		}
	});

	it('opens the price range to every signed-in session and API key, and the score range to members', () => {
		const access = (principal: RequestPrincipal) => {
			const { canUsePriceRanges, canUsePriceScoreRanges } = resolveCatalogAccessCapabilities({
				principal
			});
			return { canUsePriceRanges, canUsePriceScoreRanges };
		};

		expect(access(anonymousPrincipal)).toEqual({
			canUsePriceRanges: false,
			canUsePriceScoreRanges: false
		});
		expect(access(sessionPrincipal('viewer'))).toEqual({
			canUsePriceRanges: true,
			canUsePriceScoreRanges: false
		});
		expect(access(sessionPrincipal('member'))).toEqual({
			canUsePriceRanges: true,
			canUsePriceScoreRanges: true
		});
		expect(access(apiPrincipal('viewer'))).toEqual({
			canUsePriceRanges: true,
			canUsePriceScoreRanges: true
		});
	});

	it('grants member and admin sessions advanced catalog leverage', () => {
		for (const role of ['member', 'admin'] as const) {
			const capabilities = resolveCatalogAccessCapabilities({ principal: sessionPrincipal(role) });

			expect(capabilities.canViewFullCatalog).toBe(true);
			expect(capabilities.canViewWholesale).toBe(true);
			expect(capabilities.canUseProcessFacets).toBe(true);
			expect(capabilities.canUsePriceScoreRanges).toBe(true);
			expect(capabilities.canUseAdvancedSorts).toBe(true);
			expect(capabilities.canUseBeanMatching).toBe(true);
			expect(capabilities.canViewPremiumFilterMetadata).toBe(true);
		}
	});

	it('gives every API plan public query parity without widening account workflows', () => {
		const green = resolveCatalogAccessCapabilities({ principal: apiPrincipal('viewer') });
		const origin = resolveCatalogAccessCapabilities({ principal: apiPrincipal('member') });
		const enterprise = resolveCatalogAccessCapabilities({ principal: apiPrincipal('enterprise') });

		expect(green.canUseBasicFilters).toBe(true);
		expect(green.canUseProcessFacets).toBe(true);
		expect(green.canUseBeanMatching).toBe(true);
		expect(green.canViewPremiumFilterMetadata).toBe(true);
		expect(green.canUseSavedSearches).toBe(false);
		expect(green.canExport).toBe(false);
		expect(origin.canUseProcessFacets).toBe(true);
		expect(origin.canUseBeanMatching).toBe(true);
		expect(origin.canViewPremiumFilterMetadata).toBe(true);
		expect(enterprise.canUseProcessFacets).toBe(true);
		expect(enterprise.canUseBeanMatching).toBe(true);
		expect(enterprise.canViewPremiumFilterMetadata).toBe(true);
	});

	it('grants per-lot price history to members, API keys, and Intelligence sessions only', () => {
		const resolve = (principal: RequestPrincipal) =>
			resolveCatalogAccessCapabilities({ principal }).canViewPriceHistory;
		expect(resolve(anonymousPrincipal)).toBe(false);
		expect(resolve(sessionPrincipal('viewer'))).toBe(false);
		expect(resolve({ ...sessionPrincipal('viewer'), ppiAccess: true } as RequestPrincipal)).toBe(
			true
		);
		expect(resolve(sessionPrincipal('member'))).toBe(true);
		expect(resolve(apiPrincipal('viewer'))).toBe(true);
	});
});
