import { describe, expect, it } from 'vitest';
import { canViewPriceHistoryFor } from './priceHistoryAccess';

describe('canViewPriceHistoryFor', () => {
	it('allows members, admins, and Intelligence subscribers only', () => {
		expect(canViewPriceHistoryFor(undefined)).toBe(false);
		expect(canViewPriceHistoryFor({ role: 'viewer', ppiAccess: false })).toBe(false);
		expect(canViewPriceHistoryFor({ role: 'viewer', ppiAccess: true })).toBe(true);
		expect(canViewPriceHistoryFor({ role: 'member' })).toBe(true);
		expect(canViewPriceHistoryFor({ role: 'admin' })).toBe(true);
	});
});
