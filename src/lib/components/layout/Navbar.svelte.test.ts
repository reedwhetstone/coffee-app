import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PageAuthView } from '$lib/types/auth.types';
import Navbar from './Navbar.svelte';

const { pageState } = vi.hoisted(() => ({
	pageState: {
		url: new URL('http://localhost/dashboard')
	}
}));

vi.mock('$app/state', () => ({
	page: pageState
}));

vi.mock('$app/navigation', () => ({
	afterNavigate: vi.fn()
}));

vi.mock('$lib/types/auth.types', () => ({
	checkRole: () => false
}));

const signedInAuth: PageAuthView = {
	isSignedIn: true,
	user: { id: 'viewer-id', email: 'viewer@example.com' },
	role: 'viewer',
	ppiAccess: false
};

const anonymousAuth: PageAuthView = {
	isSignedIn: false,
	user: null,
	role: 'viewer',
	ppiAccess: false
};

describe('Navbar', () => {
	beforeEach(() => {
		pageState.url = new URL('http://localhost/dashboard');
	});

	it('keeps report sections contextual to the Market Index route', () => {
		const { unmount } = render(Navbar, {
			data: { auth: signedInAuth }
		});

		expect(screen.queryByText('On this report')).toBeNull();
		unmount();

		pageState.url = new URL('http://localhost/analytics');
		render(Navbar, {
			data: { auth: signedInAuth }
		});

		expect(screen.getByText('On this report')).toBeTruthy();
		expect(screen.getByRole('link', { name: 'Read' }).getAttribute('href')).toBe(
			'/analytics#market-read'
		);
		expect(screen.getByRole('link', { name: 'Disclosure Index' })).toBeTruthy();
	});

	it('does not advertise signed-in report sections without a signed-in user', () => {
		pageState.url = new URL('http://localhost/analytics');

		render(Navbar, {
			data: { auth: anonymousAuth }
		});

		expect(screen.getByRole('link', { name: 'Read' })).toBeTruthy();
		expect(screen.queryByRole('link', { name: 'Disclosure Index' })).toBeNull();
	});

	it('closes the desktop panel after a report-section jump', async () => {
		const onClose = vi.fn();
		pageState.url = new URL('http://localhost/analytics');

		render(Navbar, {
			data: { auth: signedInAuth },
			onClose
		});

		await fireEvent.click(screen.getByRole('link', { name: 'Signals' }));

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('exposes the shared account entry when the mobile shell supplies its account handler', async () => {
		const onOpenAccount = vi.fn();

		render(Navbar, {
			data: { auth: signedInAuth },
			onOpenAccount,
			variant: 'rail'
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Account settings' }));

		expect(onOpenAccount).toHaveBeenCalledTimes(1);
	});
});
