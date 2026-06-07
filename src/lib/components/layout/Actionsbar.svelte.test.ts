import { render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import Actionsbar from './Actionsbar.svelte';

const { goto, pageState } = vi.hoisted(() => ({
	goto: vi.fn(),
	pageState: {
		route: { id: '/beans' }
	}
}));

vi.mock('$app/navigation', () => ({
	afterNavigate: vi.fn(),
	goto
}));

vi.mock('$app/state', () => ({
	page: pageState
}));

describe('Actionsbar portfolio controls', () => {
	it('shows only Portfolio creation for Parchment Intelligence-only viewers', () => {
		render(Actionsbar, { data: { role: 'viewer', ppiAccess: true } });

		expect(screen.getByText('New Bean')).toBeTruthy();
		expect(screen.queryByText('New Roast')).toBeNull();
		expect(screen.queryByText('New Sale')).toBeNull();
	});

	it('keeps Mallard actions available for members', () => {
		render(Actionsbar, { data: { role: 'member', ppiAccess: false } });

		expect(screen.getByText('New Bean')).toBeTruthy();
		expect(screen.getByText('New Roast')).toBeTruthy();
		expect(screen.getByText('New Sale')).toBeTruthy();
	});
});
