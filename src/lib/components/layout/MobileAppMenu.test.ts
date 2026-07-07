import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MobileAppMenu from './MobileAppMenu.svelte';

const { goto, pageState } = vi.hoisted(() => ({
	goto: vi.fn(),
	pageState: {
		url: new URL('http://localhost/dashboard')
	}
}));

vi.mock('$app/navigation', () => ({
	goto
}));

vi.mock('$app/state', () => ({
	page: pageState
}));

vi.mock('$lib/types/auth.types', () => ({
	checkRole: () => true
}));

vi.mock('$lib/components/layout/appNavigation', () => ({
	getAnalyticsSectionLinks: ({ includeDisclosureIndex = false } = {}) =>
		[
			{ href: '#market-read', menuHref: '/analytics#market-read', label: 'Read' },
			{ href: '#today-signals', menuHref: '/analytics#today-signals', label: 'Signals' },
			{ href: '#market-index', menuHref: '/analytics#market-index', label: 'Market Index' },
			includeDisclosureIndex
				? {
						href: '#disclosure-index',
						menuHref: '/analytics#disclosure-index',
						label: 'Disclosure Index'
					}
				: null
		].filter(Boolean),
	getAuthenticatedNavSections: () => [],
	isNavItemActive: () => false
}));

describe('MobileAppMenu', () => {
	beforeEach(() => {
		pageState.url = new URL('http://localhost/dashboard');
		goto.mockReset();
	});

	it('offers the single continuous Coffee Chat instead of a workspace picker', async () => {
		const onClose = vi.fn();
		render(MobileAppMenu, {
			data: { role: 'member', user: { email: 'member@example.com' } },
			onClose
		});

		expect(screen.getByText('Coffee Chat')).toBeTruthy();
		expect(screen.queryByText(/create workspace/i)).toBeNull();
		expect(screen.queryByText(/^Workspaces$/)).toBeNull();

		await fireEvent.click(screen.getByRole('button', { name: 'Open chat' }));

		expect(onClose).toHaveBeenCalledTimes(1);
		expect(goto).toHaveBeenCalledWith('/chat');
	});

	it('offers Market Index section jumps from the app menu on analytics', async () => {
		const onClose = vi.fn();
		pageState.url = new URL('http://localhost/analytics');

		render(MobileAppMenu, {
			data: { role: 'member', user: { email: 'member@example.com' } },
			onClose
		});

		expect(screen.getByText('Market Index sections')).toBeTruthy();

		await fireEvent.click(screen.getByRole('button', { name: 'Disclosure Index' }));

		expect(onClose).toHaveBeenCalledTimes(1);
		expect(goto).toHaveBeenCalledWith('/analytics#disclosure-index');
	});
});
