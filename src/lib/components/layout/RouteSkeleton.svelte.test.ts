import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import RouteSkeleton from './RouteSkeleton.svelte';

describe('RouteSkeleton', () => {
	it('renders an accessible route-level loading shell', () => {
		render(RouteSkeleton, { pathname: '/analytics' });

		const skeleton = screen.getByTestId('route-skeleton');
		expect(skeleton).toHaveAttribute('aria-busy', 'true');
		expect(skeleton).toHaveAccessibleName('Loading page');
	});

	it('renders a destination-specific skeleton for catalog navigation', () => {
		render(RouteSkeleton, { pathname: '/catalog' });

		expect(screen.getByTestId('route-skeleton')).toBeInTheDocument();
		expect(document.querySelectorAll('.grid').length).toBeGreaterThan(0);
	});

	it('renders a chat workspace skeleton for chat navigation', () => {
		render(RouteSkeleton, { pathname: '/chat', authenticated: true, role: 'member' });

		expect(screen.getByTestId('route-skeleton')).toBeInTheDocument();
		expect(document.querySelectorAll('aside').length).toBe(1);
		expect(document.querySelectorAll('section').length).toBe(1);
	});

	it('renders a centered access gate for ineligible chat navigation', () => {
		render(RouteSkeleton, { pathname: '/chat', authenticated: true, role: 'viewer' });

		expect(screen.getByTestId('access-gate-skeleton')).toBeInTheDocument();
		expect(document.querySelector('aside')).not.toBeInTheDocument();
		expect(document.querySelector('section')).not.toBeInTheDocument();
	});

	it('renders a product-card skeleton for subscription navigation', () => {
		render(RouteSkeleton, { pathname: '/subscription' });

		expect(screen.getByTestId('route-skeleton')).toBeInTheDocument();
		expect(document.querySelectorAll('[class*="surface-panel"]').length).toBeGreaterThanOrEqual(4);
	});

	it('renders a centered verification skeleton for subscription success', () => {
		render(RouteSkeleton, { pathname: '/subscription/success' });

		expect(screen.getByTestId('subscription-verification-skeleton')).toBeInTheDocument();
		expect(
			document.querySelectorAll('[data-testid="subscription-verification-skeleton"]')
		).toHaveLength(1);
	});

	it('renders a generic skeleton for unmapped routes', () => {
		render(RouteSkeleton, { pathname: '/settings' });

		expect(screen.getByTestId('route-skeleton')).toBeInTheDocument();
		expect(document.querySelectorAll('[class*="surface-panel"]').length).toBeGreaterThan(0);
	});
});
