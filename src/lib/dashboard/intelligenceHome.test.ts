import { describe, expect, it } from 'vitest';
import { getDashboardSections, getDashboardUpgradePrompt } from './intelligenceHome';

function card(title: string, role: 'viewer' | 'member' | 'admin' = 'viewer', ppiAccess = false) {
	return getDashboardSections({ role, ppiAccess })
		.flatMap((section) => section.cards)
		.find((item) => item.title === title);
}

describe('dashboard intelligence home model', () => {
	it('centers the dashboard on Parchment Intelligence before Portfolio, Mallard Studio, and Developer', () => {
		expect(
			getDashboardSections({ role: 'viewer', ppiAccess: false }).map((section) => section.id)
		).toEqual(['parchment', 'portfolio', 'mallard', 'developer']);
	});

	it('keeps the primary Parchment paths focused on market index, catalog research, ask, and reports', () => {
		const parchmentCards = getDashboardSections({ role: 'member', ppiAccess: false }).find(
			(section) => section.id === 'parchment'
		)?.cards;

		expect(parchmentCards?.map((item) => item.title)).toEqual([
			'Parchment Market Index',
			'Catalog and supply research',
			'Ask Parchment',
			'Intelligence reports'
		]);
		expect(parchmentCards?.find((item) => item.title === 'Ask Parchment')?.description).toContain(
			'sourcing questions'
		);
		expect(parchmentCards?.find((item) => item.title === 'Intelligence reports')?.status).toBe(
			'coming-soon'
		);
	});

	it('locks Ask and Portfolio for viewers while leaving public research paths available', () => {
		expect(card('Parchment Market Index')).toMatchObject({ href: '/analytics', status: 'ready' });
		expect(card('Catalog and supply research')).toMatchObject({
			href: '/catalog',
			status: 'ready'
		});
		expect(card('Ask Parchment')).toMatchObject({ href: '/chat', status: 'locked' });
		expect(card('Tracked coffee panel')).toMatchObject({ href: '/beans', status: 'locked' });
	});

	it('unlocks Ask and Portfolio for Parchment Intelligence users but keeps Mallard Studio locked', () => {
		expect(card('Ask Parchment', 'viewer', true)).toMatchObject({ status: 'ready' });
		expect(card('Tracked coffee panel', 'viewer', true)).toMatchObject({ status: 'ready' });
		expect(card('Roast context', 'viewer', true)).toMatchObject({ status: 'locked' });
	});

	it('frames Mallard Studio as a roasting add-on for members, not the umbrella product', () => {
		const mallardCards = getDashboardSections({ role: 'member', ppiAccess: false }).find(
			(section) => section.id === 'mallard'
		)?.cards;

		expect(mallardCards?.map((item) => item.title)).toEqual(['Roast context', 'Profit context']);
		expect(mallardCards?.[0].description).toContain('not the umbrella product');
		expect(mallardCards?.every((item) => item.status === 'ready')).toBe(true);
	});

	it('returns tier-specific upgrade prompts for viewer, Parchment Intelligence, and Mallard Studio states', () => {
		expect(getDashboardUpgradePrompt({ role: 'viewer', ppiAccess: false })).toMatchObject({
			headline: 'Unlock the Intelligence layer',
			variant: 'strong'
		});
		expect(getDashboardUpgradePrompt({ role: 'viewer', ppiAccess: true })).toMatchObject({
			headline: 'Add roasting context when your own coffees matter',
			variant: 'contextual'
		});
		expect(getDashboardUpgradePrompt({ role: 'member', ppiAccess: false })).toMatchObject({
			headline: 'Add Parchment Intelligence for deeper market reads',
			variant: 'contextual'
		});
		expect(getDashboardUpgradePrompt({ role: 'member', ppiAccess: true })).toBeNull();
	});
});
