import { render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import MobileAppShell from './MobileAppShell.svelte';

const { goto, pageState } = vi.hoisted(() => ({
	goto: vi.fn(),
	pageState: {
		url: new URL('http://localhost/beans'),
		route: { id: '/beans' }
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
	it('lets Parchment Intelligence-only viewers open portfolio actions', () => {
		render(MobileAppShell, { data: { role: 'viewer', ppiAccess: true } });

		expect(screen.getByLabelText('Open actions')).toBeTruthy();
	});

	it('keeps the actions launcher hidden for ordinary viewers', () => {
		render(MobileAppShell, { data: { role: 'viewer', ppiAccess: false } });

		expect(screen.queryByLabelText('Open actions')).toBeNull();
	});
});
