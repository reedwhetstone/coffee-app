import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('Navbar', () => {
	beforeEach(() => {
		pageState.url = new URL('http://localhost/dashboard');
	});

	it('keeps report sections contextual to the Market Index route', () => {
		const { unmount } = render(Navbar, {
			data: { role: 'viewer', user: { email: 'viewer@example.com' } }
		});

		expect(screen.queryByText('On this report')).toBeNull();
		unmount();

		pageState.url = new URL('http://localhost/analytics');
		render(Navbar, {
			data: { role: 'viewer', user: { email: 'viewer@example.com' } }
		});

		expect(screen.getByText('On this report')).toBeTruthy();
		expect(screen.getByRole('link', { name: 'Read' }).getAttribute('href')).toBe(
			'/analytics#market-read'
		);
		expect(screen.getByRole('link', { name: 'Disclosure Index' })).toBeTruthy();
	});

	it('closes the desktop panel after a report-section jump', async () => {
		const onClose = vi.fn();
		pageState.url = new URL('http://localhost/analytics');

		render(Navbar, {
			data: { role: 'viewer', user: { email: 'viewer@example.com' } },
			onClose
		});

		await fireEvent.click(screen.getByRole('link', { name: 'Signals' }));

		expect(onClose).toHaveBeenCalledTimes(1);
	});
});
