import { describe, expect, it } from 'vitest';
import { compareHref, compareLimitFor } from './compareAccess';

describe('compareLimitFor', () => {
	it('matches Parchment limits: signed out 0, viewers 2, members and Intelligence 6', () => {
		expect(compareLimitFor(undefined)).toBe(0);
		expect(compareLimitFor({ isSignedIn: false, role: 'member' })).toBe(0);
		expect(compareLimitFor({ isSignedIn: true, role: 'viewer' })).toBe(2);
		expect(compareLimitFor({ isSignedIn: true, role: 'viewer', ppiAccess: true })).toBe(6);
		expect(compareLimitFor({ isSignedIn: true, role: 'member' })).toBe(6);
	});

	it('builds shareable links', () => {
		expect(compareHref([416, 8806])).toBe('/catalog/compare?ids=416%2C8806');
		expect(compareHref([1, 2], 5)).toBe('/catalog/compare?ids=1%2C2&quantityLbs=5');
	});
});
