import { describe, expect, it } from 'vitest';
import { canManagePortfolio, canUseMallardControls } from './portfolioAccess';

describe('portfolio access helpers', () => {
	it('lets Parchment Intelligence-only viewers manage Portfolio rows', () => {
		expect(canManagePortfolio('viewer', true)).toBe(true);
	});

	it('keeps ordinary viewers read-only for Portfolio controls', () => {
		expect(canManagePortfolio('viewer', false)).toBe(false);
	});

	it('keeps Mallard controls member-only', () => {
		expect(canUseMallardControls('viewer')).toBe(false);
		expect(canUseMallardControls('member')).toBe(true);
		expect(canUseMallardControls('admin')).toBe(true);
	});
});
