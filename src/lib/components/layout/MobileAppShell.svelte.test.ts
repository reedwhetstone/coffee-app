import { render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MobileAppShell from './MobileAppShell.svelte';

const { goto, pageState } = vi.hoisted(() => ({
	goto: vi.fn(),
	pageState: {
		url: new URL('http://localhost/beans'),
		route: { id: '/beans' },
		data: {} as { trackedOnly?: boolean }
	}
}));

vi.mock('$app/navigation', () => ({
	goto
}));

vi.mock('$app/state', () => ({
	page: pageState
}));

vi.mock('$lib/components/layout/Navbar.svelte', () => ({
	default: vi.fn()
}));

vi.mock('$lib/components/layout/AuthSidebar.svelte', () => ({
	default: vi.fn()
}));

vi.mock('$lib/components/layout/Settingsbar.svelte', () => ({
	default: vi.fn()
}));

vi.mock('$lib/components/layout/Actionsbar.svelte', () => ({
	default: vi.fn()
}));

vi.mock('$lib/stores/filterStore', () => ({
	filterStore: {
		subscribe: (run: (value: Record<string, unknown>) => void) => {
			run({ routeId: '/beans', filters: {}, sortField: '', sortDirection: '' });
			return () => {};
		}
	}
}));

describe('MobileAppShell actions launcher', () => {
	const auth = (role: 'viewer' | 'member', ppiAccess: boolean) => ({
		auth: {
			isSignedIn: true,
			user: { id: 'user-1', email: 'member@example.com' },
			role,
			ppiAccess
		}
	});

	beforeEach(() => {
		pageState.url = new URL('http://localhost/beans');
		pageState.data = {};
	});

	it('lets Parchment Intelligence-only viewers open portfolio actions', () => {
		render(MobileAppShell, { data: auth('viewer', true) });

		expect(screen.getByLabelText('Open actions')).toBeTruthy();
	});

	it('uses the circle-only Purveyors mark in the mobile menu trigger', () => {
		render(MobileAppShell, { data: auth('member', false) });

		const menuTrigger = screen.getByLabelText('Open app menu');
		expect(menuTrigger.querySelector('img')).toBeNull();
		expect(menuTrigger.querySelector('svg[viewBox="0 0 525 525"]')).toBeTruthy();
	});

	it('keeps the actions launcher hidden for ordinary viewers', () => {
		render(MobileAppShell, { data: auth('viewer', false) });

		expect(screen.queryByLabelText('Open actions')).toBeNull();
	});

	it('does not show an empty filters launcher on profit', () => {
		pageState.url = new URL('http://localhost/profit');
		render(MobileAppShell, { data: auth('member', false) });

		expect(screen.queryByLabelText('Open filters')).toBeNull();
	});

	it('hides catalog filters in the tracked-only view', () => {
		pageState.url = new URL('http://localhost/catalog?tracked=only');
		pageState.data = { trackedOnly: true };
		render(MobileAppShell, { data: auth('member', false) });

		expect(screen.queryByLabelText('Open filters')).toBeNull();
	});

	it('keeps filters visible when an unauthorized tracked query renders the normal catalog', () => {
		pageState.url = new URL('http://localhost/catalog?tracked=only');
		pageState.data = { trackedOnly: false };
		render(MobileAppShell, { data: auth('viewer', false) });

		expect(screen.getByLabelText('Open filters')).toBeTruthy();
	});
});
