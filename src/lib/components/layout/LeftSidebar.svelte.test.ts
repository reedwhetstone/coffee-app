import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LeftSidebar from './LeftSidebar.svelte';

const { goto, pageState, filterState } = vi.hoisted(() => {
	let currentFilterState = {
		showWholesale: true,
		wholesaleOnly: false,
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
		vi.stubGlobal(
			'matchMedia',
			vi.fn().mockImplementation((query: string) => ({
				matches: query === '(min-width: 1280px)',
				media: query,
				onchange: null,
				addListener: vi.fn(),
				removeListener: vi.fn(),
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
				dispatchEvent: vi.fn()
			}))
		);
		pageState.url = new URL('http://localhost/catalog');
		pageState.data = {};
		filterState.set({
			showWholesale: true,
			wholesaleOnly: false,
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
		vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: vi.fn(),
			removeListener: vi.fn(),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn()
		}));
		render(LeftSidebar, {
			data: {
				role: 'member',
				ppiAccess: true,
				user: { email: 'member@example.com' },
				session: { user: { email: 'member@example.com' } }
			}
		});

		const shell = screen.getByTestId('desktop-app-shell');
		const mediumControls = screen.getByLabelText('Desktop workspace controls');
		const filterTrigger = within(mediumControls).getByRole('button', { name: /Filters/ });
		const initialClass = shell.getAttribute('class');
		await fireEvent.click(filterTrigger);

		expect(screen.getAllByLabelText('Filters menu').length).toBeGreaterThan(0);
		expect(shell.getAttribute('class')).toBe(initialClass);
		await waitFor(() =>
			expect(document.activeElement).toBe(document.getElementById('desktop-shell-panel-medium'))
		);

		await fireEvent.keyDown(window, { key: 'Escape' });
		await waitFor(() => expect(document.activeElement).toBe(filterTrigger));
		expect(filterTrigger.getAttribute('aria-expanded')).toBe('false');
	});

	it('moves focus into the wide panel and restores its trigger on Escape', async () => {
		render(LeftSidebar, {
			data: {
				role: 'member',
				ppiAccess: true,
				user: { email: 'member@example.com' },
				session: { user: { email: 'member@example.com' } }
			}
		});

		const wideNavigation = screen.getByLabelText('Desktop workspace navigation');
		const accountTrigger = within(wideNavigation).getByRole('button', { name: /Account/ });
		await fireEvent.click(accountTrigger);

		await waitFor(() =>
			expect(document.activeElement).toBe(document.getElementById('desktop-shell-panel-wide'))
		);
		expect(accountTrigger.getAttribute('aria-expanded')).toBe('true');

		await fireEvent.keyDown(window, { key: 'Escape' });
		await waitFor(() => expect(document.activeElement).toBe(accountTrigger));
		expect(accountTrigger.getAttribute('aria-expanded')).toBe('false');
	});

	it('counts supplier visibility together with field filters', async () => {
		filterState.set({
			showWholesale: false,
			wholesaleOnly: false,
			filters: {
				country: [],
				processing: ''
			}
		});

		render(LeftSidebar, {
			data: {
				role: 'member',
				ppiAccess: true,
				user: { email: 'member@example.com' },
				session: { user: { email: 'member@example.com' } }
			}
		});

		expect(screen.getAllByLabelText('1 active filters')).toHaveLength(2);
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
