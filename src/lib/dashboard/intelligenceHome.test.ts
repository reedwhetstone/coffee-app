import { describe, expect, it } from 'vitest';
import { getDashboardExperience, getDashboardUpgradePrompt } from './intelligenceHome';

describe('adaptive dashboard experience', () => {
	it.each([
		['viewer', false, null, 'Purveyors account'],
		['viewer', true, 'Cherry Green Agent', 'Parchment Intelligence'],
		['member', false, 'Cherry Roast Agent', 'Mallard Studio'],
		['member', true, 'Cherry Synthesis Agent', 'Parchment Intelligence + Mallard Studio']
	] as const)(
		'adapts role=%s and ppiAccess=%s to %s',
		(role, ppiAccess, expectedAgent, expectedAccessLabel) => {
			const experience = getDashboardExperience({ role, ppiAccess });
			expect(experience.agent?.name ?? null).toBe(expectedAgent);
			expect(experience.accessLabel).toBe(expectedAccessLabel);
		}
	);

	it('keeps each experience focused on a bounded set of real next actions', () => {
		for (const context of [
			{ role: 'viewer' as const, ppiAccess: false },
			{ role: 'viewer' as const, ppiAccess: true },
			{ role: 'member' as const, ppiAccess: false },
			{ role: 'member' as const, ppiAccess: true }
		]) {
			const tasks = getDashboardExperience(context).tasks;
			expect(tasks.length).toBeGreaterThanOrEqual(3);
			expect(tasks.length).toBeLessThanOrEqual(4);
			expect(new Set(tasks.map((task) => task.href)).size).toBe(tasks.length);
		}
	});

	it('connects only the capabilities the account can actually use', () => {
		expect(
			getDashboardExperience({ role: 'viewer', ppiAccess: true }).tasks.map((task) => task.id)
		).toEqual(['market', 'catalog', 'portfolio']);
		expect(
			getDashboardExperience({ role: 'member', ppiAccess: false }).tasks.map((task) => task.id)
		).toEqual(['portfolio', 'roast', 'profit', 'catalog']);
	});

	it('offers the missing context without interrupting combined subscribers', () => {
		expect(getDashboardUpgradePrompt({ role: 'viewer', ppiAccess: true })?.body).toContain(
			'Cherry Synthesis Agent'
		);
		expect(getDashboardUpgradePrompt({ role: 'member', ppiAccess: false })?.body).toContain(
			'Parchment Intelligence'
		);
		expect(getDashboardUpgradePrompt({ role: 'member', ppiAccess: true })).toBeNull();
	});
});
