import { describe, expect, it } from 'vitest';
import { sanitizeNextPath } from '$lib/utils/safeRedirect';
import { canOpenComparison, compareHref, compareLimitFor, signInHref } from './compareAccess';

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

	it('opens a comparison only between two coffees and the current limit', () => {
		expect(canOpenComparison(1, 6)).toBe(false);
		expect(canOpenComparison(2, 2)).toBe(true);
		expect(canOpenComparison(6, 6)).toBe(true);
		expect(canOpenComparison(6, 2)).toBe(false);
		expect(canOpenComparison(3, 0)).toBe(false);
	});

	it('returns sign-in to the comparison that sent the visitor there', () => {
		const href = signInHref(
			new URL('https://purveyors.io/catalog/compare?ids=416%2C8806&quantityLbs=5')
		);
		const next = new URL(href, 'https://purveyors.io').searchParams.get('next');
		expect(next).toBe('/catalog/compare?ids=416%2C8806&quantityLbs=5');
		expect(sanitizeNextPath(next)).toBe(next);
	});
});
