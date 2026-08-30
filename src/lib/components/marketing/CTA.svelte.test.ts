import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import CTA from './CTA.svelte';
import type { PageAuthView } from '$lib/types/auth.types';

function auth(overrides: Partial<PageAuthView> = {}): PageAuthView {
	return {
		isSignedIn: false,
		user: null,
		role: 'viewer',
		ppiAccess: false,
		...overrides
	};
}

describe('homepage final CTA', () => {
	it('keeps signed-in viewers without product access on the plans path', () => {
		render(CTA, {
			auth: auth({
				isSignedIn: true,
				user: { id: 'viewer-1', email: 'viewer@example.com' }
			})
		});

		expect(screen.getByRole('link', { name: 'See plans' })).toBeInTheDocument();
		expect(screen.queryByRole('link', { name: 'Manage your plan' })).not.toBeInTheDocument();
		expect(
			screen.getByText(/catalog and core Market Index are free to explore/i)
		).toBeInTheDocument();
	});

	it('uses account management language for product-entitled users', () => {
		render(CTA, { auth: auth({ isSignedIn: true, ppiAccess: true }) });

		expect(screen.getByRole('link', { name: 'Manage your plan' })).toBeInTheDocument();
		expect(screen.queryByRole('link', { name: 'See plans' })).not.toBeInTheDocument();
		expect(screen.getByText('Your saved market context is ready.')).toBeInTheDocument();
	});

	it('recognizes Studio access from the app role', () => {
		render(CTA, { auth: auth({ isSignedIn: true, role: 'member' }) });

		expect(screen.getByRole('link', { name: 'Manage your plan' })).toBeInTheDocument();
		expect(screen.getByText('Your roastery context is ready.')).toBeInTheDocument();
	});
});
