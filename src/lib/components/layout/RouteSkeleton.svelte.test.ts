import { render, screen, waitFor } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import RouteSkeleton from './RouteSkeleton.svelte';

describe('RouteSkeleton', () => {
	it('renders an accessible route-level loading shell', () => {
		render(RouteSkeleton, { pathname: '/analytics' });

		const skeleton = screen.getByTestId('route-skeleton');
		expect(skeleton).toHaveAttribute('aria-busy', 'true');
		expect(skeleton).toHaveAccessibleName('Loading page');
	});

	it('lazily renders the destination-specific skeleton for catalog navigation', async () => {
		render(RouteSkeleton, { pathname: '/catalog' });

		await waitFor(() => {
			expect(document.querySelectorAll('.grid').length).toBeGreaterThan(0);
		});
	});

	it('shows an inline fallback shell until the lazy destination skeleton resolves', async () => {
		render(RouteSkeleton, { pathname: '/catalog' });

		// The main area must never be blank while the destination chunk is in
		// flight — the layout has already unmounted the previous page.
		expect(screen.getByTestId('route-skeleton-fallback')).toBeInTheDocument();

		await waitFor(() => {
			expect(screen.queryByTestId('route-skeleton-fallback')).not.toBeInTheDocument();
		});
	});

	it('renders the shared analytics skeleton contract for analytics navigation', async () => {
		const { container } = render(RouteSkeleton, { pathname: '/analytics' });

		await waitFor(() => {
			expect(container.querySelector('[aria-label="Loading Market Index"]')).toBeTruthy();
		});
	});

	it('renders a chat workspace skeleton for chat navigation', async () => {
		render(RouteSkeleton, { pathname: '/chat' });

		await waitFor(() => {
			expect(document.querySelectorAll('aside').length).toBe(1);
		});
		expect(document.querySelectorAll('section').length).toBe(1);
	});

	it('renders a generic skeleton for unmapped routes and checkout success', async () => {
		for (const pathname of ['/settings', '/subscription/success']) {
			const { unmount } = render(RouteSkeleton, { pathname });

			await waitFor(() => {
				expect(document.querySelectorAll('[class*="surface-panel"]').length).toBeGreaterThan(0);
			});
			unmount();
		}
	});
});
