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

		await fireEvent.click(screen.getByRole('button', { name: 'Open Chat' }));

		expect(onClose).toHaveBeenCalledTimes(1);
		expect(goto).toHaveBeenCalledWith('/chat');
	});
});
