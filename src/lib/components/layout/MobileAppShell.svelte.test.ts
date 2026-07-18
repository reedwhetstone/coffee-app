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

vi.mock('$lib/components/layout/MobileAppMenu.svelte', () => ({
	default: vi.fn()
}));

vi.mock('$lib/components/layout/Settingsbar.svelte', () => ({
	default: vi.fn()
}));

vi.mock('$lib/components/layout/Actionsbar.svelte', () => ({
	default: vi.fn()
}));

describe('MobileAppShell actions launcher', () => {
	beforeEach(() => {
		pageState.url = new URL('http://localhost/beans');
		pageState.data = {};
	});

	it('lets Parchment Intelligence-only viewers open portfolio actions', () => {
		render(MobileAppShell, { data: { role: 'viewer', ppiAccess: true } });

		expect(screen.getByLabelText('Open actions')).toBeTruthy();
	});

	it('keeps the actions launcher hidden for ordinary viewers', () => {
		render(MobileAppShell, { data: { role: 'viewer', ppiAccess: false } });

		expect(screen.queryByLabelText('Open actions')).toBeNull();
	});

	it('does not show an empty filters launcher on profit', () => {
		pageState.url = new URL('http://localhost/profit');
		render(MobileAppShell, { data: { role: 'member', ppiAccess: false } });

		expect(screen.queryByLabelText('Open filters')).toBeNull();
	});

	it('hides catalog filters in the tracked-only view', () => {
		pageState.url = new URL('http://localhost/catalog?tracked=only');
		pageState.data = { trackedOnly: true };
		render(MobileAppShell, { data: { role: 'member', ppiAccess: false } });

		expect(screen.queryByLabelText('Open filters')).toBeNull();
	});

	it('keeps filters visible when an unauthorized tracked query renders the normal catalog', () => {
		pageState.url = new URL('http://localhost/catalog?tracked=only');
		pageState.data = { trackedOnly: false };
		render(MobileAppShell, { data: { role: 'viewer', ppiAccess: false } });

		expect(screen.getByLabelText('Open filters')).toBeTruthy();
	});
});
