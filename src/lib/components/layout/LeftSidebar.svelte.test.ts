import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LeftSidebar from './LeftSidebar.svelte';

const { goto, pageState, filterState } = vi.hoisted(() => {
	type CurrentFilterState = {
		routeId: string;
		showWholesale: boolean;
		wholesaleOnly: boolean;
		filters: Record<string, string | string[]>;
	};

	let currentFilterState: CurrentFilterState = {
		routeId: '/catalog',
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
			routeId: '/catalog',
			showWholesale: true,
			wholesaleOnly: false,
			filters: {
				country: ['Ethiopia'],
				processing: 'Washed'
			}
		});
	});

	it('keeps navigation closed behind one narrow desktop icon rail', async () => {
		render(LeftSidebar, {
			data: {
				role: 'member',
				ppiAccess: true,
				user: { email: 'member@example.com' },
				session: { user: { email: 'member@example.com' } }
			}
		});

		const actionBar = screen.getByLabelText('Desktop action bar');
		const navigationTrigger = within(actionBar).getByRole('button', { name: 'Open navigation' });
		const chatTrigger = within(actionBar).getByRole('button', { name: 'Open chat' });
		const actionsTrigger = within(actionBar).getByRole('button', { name: 'Open actions' });
		expect(screen.queryByLabelText('Main navigation menu')).toBeNull();
		expect(actionBar).toHaveClass('w-16');
		expect(navigationTrigger).toBeTruthy();
		expect(chatTrigger.getAttribute('style')).toContain('box-shadow');
		expect(actionsTrigger).not.toHaveClass('bg-accent');
		expect(within(actionBar).getByRole('button', { name: 'Open filters' })).toBeTruthy();
		expect(within(actionBar).getByRole('button', { name: 'Open account' })).toBeTruthy();
		expect(screen.getAllByLabelText('2 active filters')).toHaveLength(1);

		await fireEvent.click(navigationTrigger);
		expect(screen.getAllByLabelText('Main navigation menu')).toHaveLength(1);
	});

	it('opens one overlay filters panel without changing the action-bar width', async () => {
		render(LeftSidebar, {
			data: {
				role: 'member',
				ppiAccess: true,
				user: { email: 'member@example.com' },
				session: { user: { email: 'member@example.com' } }
			}
		});

		const shell = screen.getByTestId('desktop-app-shell');
		const actionBar = screen.getByLabelText('Desktop action bar');
		const filterTrigger = within(actionBar).getByRole('button', { name: 'Open filters' });
		const initialClass = shell.getAttribute('class');
		await fireEvent.click(filterTrigger);

		expect(screen.getAllByLabelText('Filters menu')).toHaveLength(1);
		expect(shell.getAttribute('class')).toBe(initialClass);
		const panel = document.getElementById('desktop-shell-panel');
		expect(document.querySelectorAll('#desktop-shell-panel')).toHaveLength(1);
		expect(panel).toHaveClass('left-16');
		expect(panel?.getAttribute('role')).toBe('region');
		expect(panel?.getAttribute('aria-label')).toBe('Filters panel');
		await waitFor(() => expect(document.activeElement).toBe(panel));

		await fireEvent.keyDown(window, { key: 'Escape' });
		await waitFor(() => expect(document.activeElement).toBe(filterTrigger));
		expect(filterTrigger.getAttribute('aria-expanded')).toBe('false');
	});

	it('moves focus into the shared panel and restores its trigger on Escape', async () => {
		render(LeftSidebar, {
			data: {
				role: 'member',
				ppiAccess: true,
				user: { email: 'member@example.com' },
				session: { user: { email: 'member@example.com' } }
			}
		});

		const actionBar = screen.getByLabelText('Desktop action bar');
		const accountTrigger = within(actionBar).getByRole('button', { name: 'Open account' });
		await fireEvent.click(accountTrigger);

		const panel = document.getElementById('desktop-shell-panel');
		expect(document.querySelectorAll('#desktop-shell-panel')).toHaveLength(1);
		expect(panel?.getAttribute('role')).toBe('region');
		expect(panel?.getAttribute('aria-label')).toBe('Account panel');
		await waitFor(() => expect(document.activeElement).toBe(panel));
		expect(accountTrigger.getAttribute('aria-expanded')).toBe('true');

		await fireEvent.keyDown(window, { key: 'Escape' });
		await waitFor(() => expect(document.activeElement).toBe(accountTrigger));
		expect(accountTrigger.getAttribute('aria-expanded')).toBe('false');
	});

	it('counts supplier visibility together with field filters', async () => {
		filterState.set({
			routeId: '/catalog',
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

		expect(screen.getAllByLabelText('1 active filters')).toHaveLength(1);
	});

	it('suppresses stale filter badges while the store belongs to another route', () => {
		filterState.set({
			routeId: '/beans',
			showWholesale: false,
			wholesaleOnly: false,
			filters: {
				stocked: 'TRUE'
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

		expect(screen.queryAllByLabelText(/active filters/)).toHaveLength(0);
	});

	it('leaves the panel open when a higher modal layer already handled Escape', async () => {
		render(LeftSidebar, {
			data: {
				role: 'member',
				ppiAccess: true,
				user: { email: 'member@example.com' },
				session: { user: { email: 'member@example.com' } }
			}
		});

		const actionBar = screen.getByLabelText('Desktop action bar');
		const accountTrigger = within(actionBar).getByRole('button', { name: 'Open account' });
		await fireEvent.click(accountTrigger);

		const escapeEvent = new KeyboardEvent('keydown', {
			key: 'Escape',
			bubbles: true,
			cancelable: true
		});
		escapeEvent.preventDefault();
		window.dispatchEvent(escapeEvent);

		expect(screen.getAllByRole('region', { name: 'Account panel', hidden: true })).toHaveLength(1);
		expect(accountTrigger.getAttribute('aria-expanded')).toBe('true');
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

		await fireEvent.click(screen.getByRole('button', { name: 'Open chat' }));

		expect(goto).toHaveBeenCalledWith('/chat');
	});
});
