import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LeftSidebar from './LeftSidebar.svelte';

const { goto, pageState, filterState } = vi.hoisted(() => {
	let currentFilterState = {
		filters: {
			country: ['Ethiopia'],
			processing: 'Washed'
		}
	};
	const subscribers = new Set<(value: typeof currentFilterState) => void>();

	return {
		goto: vi.fn(),
		pageState: {
			url: new URL('http://localhost/catalog'),
			data: {}
		},
		filterState: {
			subscribe(callback: (value: typeof currentFilterState) => void) {
				subscribers.add(callback);
				callback(currentFilterState);
				return () => subscribers.delete(callback);
			},
			set(value: typeof currentFilterState) {
				currentFilterState = value;
				for (const callback of subscribers) callback(value);
			}
		}
	};
});

vi.mock('$app/navigation', () => ({ goto }));
vi.mock('$app/state', () => ({ page: pageState }));
vi.mock('$lib/stores/filterStore', () => ({ filterStore: filterState }));
vi.mock('$lib/types/auth.types', () => ({
	checkRole: () => false
}));
vi.mock('$lib/services/portfolioAccess', () => ({
	canManagePortfolio: () => true
}));
vi.mock('$lib/components/layout/appNavigation', () => ({
	getCurrentRouteLabel: () => 'Catalog'
}));
vi.mock('$lib/components/layout/Navbar.svelte', async () => ({
	default: (await import('./__test-fixtures__/SidebarPanelStub.svelte')).default
}));
vi.mock('$lib/components/layout/Settingsbar.svelte', async () => ({
	default: (await import('./__test-fixtures__/SidebarPanelStub.svelte')).default
}));
vi.mock('$lib/components/layout/Actionsbar.svelte', async () => ({
	default: (await import('./__test-fixtures__/SidebarPanelStub.svelte')).default
}));
vi.mock('$lib/components/layout/AuthSidebar.svelte', async () => ({
	default: (await import('./__test-fixtures__/SidebarPanelStub.svelte')).default
}));
vi.mock('$lib/components/layout/AdminSidebar.svelte', async () => ({
	default: (await import('./__test-fixtures__/SidebarPanelStub.svelte')).default
}));

describe('LeftSidebar', () => {
	beforeEach(() => {
		goto.mockReset();
		pageState.url = new URL('http://localhost/catalog');
		pageState.data = {};
		filterState.set({
			filters: {
				country: ['Ethiopia'],
				processing: 'Washed'
			}
		});
	});

	it('exposes labeled wide-screen controls and active filter counts', () => {
		render(LeftSidebar, {
			data: {
				role: 'member',
				ppiAccess: true,
				user: { email: 'member@example.com' },
				session: { user: { email: 'member@example.com' } }
			}
		});

		expect(screen.getByText('Current workspace')).toBeTruthy();
		expect(screen.getByText('Catalog')).toBeTruthy();
		expect(screen.getAllByRole('button', { name: /Account/ })).toHaveLength(2);
		expect(screen.getAllByRole('button', { name: /Chat/ })).toHaveLength(2);
		expect(screen.getAllByLabelText('2 active filters')).toHaveLength(2);
	});

	it('opens filters as an overlay without changing the shell width', async () => {
		render(LeftSidebar, {
			data: {
				role: 'member',
				ppiAccess: true,
				user: { email: 'member@example.com' },
				session: { user: { email: 'member@example.com' } }
			}
		});

		const shell = screen.getByTestId('desktop-app-shell');
		const initialClass = shell.getAttribute('class');
		await fireEvent.click(screen.getAllByRole('button', { name: /Filters/ })[0]);

		expect(screen.getAllByLabelText('Filters menu').length).toBeGreaterThan(0);
		expect(shell.getAttribute('class')).toBe(initialClass);
	});

	it('opens chat directly from the desktop shell', async () => {
		render(LeftSidebar, {
			data: {
				role: 'member',
				ppiAccess: true,
				user: { email: 'member@example.com' },
				session: { user: { email: 'member@example.com' } }
			}
		});

		await fireEvent.click(screen.getAllByRole('button', { name: /Chat/ })[0]);

		expect(goto).toHaveBeenCalledWith('/chat');
	});
});
