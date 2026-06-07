import { describe, expect, it } from 'vitest';
import { getAuthenticatedNavSections, getCurrentRouteLabel } from './appNavigation';

function sectionById(role: 'viewer' | 'member' | 'admin', id: string, ppiAccess = false) {
	return getAuthenticatedNavSections(role, { ppiAccess }).find((section) => section.id === id);
}

describe('authenticated app navigation taxonomy', () => {
	it('uses the Parchment, Portfolio, Maillard Studio, and Developer product groups', () => {
		const ids = getAuthenticatedNavSections('member').map((section) => section.id);

		expect(ids).toEqual(['parchment', 'portfolio', 'maillard', 'developer']);
	});

	it('places chat in Parchment instead of Maillard Studio', () => {
		const parchmentItems = sectionById('member', 'parchment')?.items.map((item) => item.href);
		const maillardItems = sectionById('member', 'maillard')?.items.map((item) => item.href);

		expect(parchmentItems).toContain('/chat');
		expect(maillardItems).not.toContain('/chat');
	});

	it('labels analytics as Parchment Market Index in the Parchment group', () => {
		const analyticsItem = sectionById('member', 'parchment')?.items.find(
			(item) => item.href === '/analytics'
		);

		expect(analyticsItem).toMatchObject({
			label: 'Parchment Market Index',
			description: expect.stringContaining('Market trends')
		});
		expect(getCurrentRouteLabel('/analytics', 'member')).toBe('Parchment Market Index');
	});

	it('keeps Portfolio and Maillard Studio items visible but locked for viewers', () => {
		const portfolioItem = sectionById('viewer', 'portfolio')?.items[0];
		const roastItem = sectionById('viewer', 'maillard')?.items.find(
			(item) => item.href === '/roast'
		);

		expect(portfolioItem).toMatchObject({ label: 'Portfolio', href: '/beans', locked: true });
		expect(roastItem).toMatchObject({ label: 'Roast', locked: true });
	});

	it('unlocks chat and Portfolio for Parchment Intelligence users without showing roasting tools as unlocked', () => {
		const parchmentItems = sectionById('viewer', 'parchment', true)?.items;
		const chatItem = parchmentItems?.find((item) => item.href === '/chat');
		const portfolioItem = sectionById('viewer', 'portfolio', true)?.items.find(
			(item) => item.href === '/beans'
		);
		const roastItem = sectionById('viewer', 'maillard', true)?.items.find(
			(item) => item.href === '/roast'
		);

		expect(chatItem).toMatchObject({ label: 'Chat', locked: false });
		expect(portfolioItem).toMatchObject({ label: 'Portfolio', locked: false });
		expect(roastItem).toMatchObject({ label: 'Roast', locked: true });
	});

	it('hides admin navigation from non-admin users', () => {
		expect(sectionById('member', 'admin')).toBeUndefined();
		expect(sectionById('admin', 'admin')?.items.map((item) => item.href)).toContain('/admin');
	});
});
