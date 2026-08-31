import { render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PageAuthView } from '$lib/types/auth.types';
import Hero from './Hero.svelte';

const auth: PageAuthView = {
	isSignedIn: false,
	user: null,
	role: 'viewer',
	ppiAccess: false
};

describe('homepage hero catalog examples', () => {
	beforeEach(() => {
		vi.stubGlobal('matchMedia', () => ({ matches: false }));
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('hides examples when the catalog has no stocked rows', () => {
		render(Hero, { auth, coffeeNames: [] });

		expect(screen.getByText('Live market coverage')).toBeInTheDocument();
		expect(screen.queryByText(/Recent coffee examples/)).not.toBeInTheDocument();
		expect(screen.queryByText('Ethiopia Guji Natural')).not.toBeInTheDocument();
	});

	it('renders only names supplied by the catalog', () => {
		render(Hero, { auth, coffeeNames: ['Ethiopia Sidamo Washed'] });

		expect(screen.getByText('Ethiopia Sidamo Washed')).toBeInTheDocument();
		expect(
			screen.getByText('Recent coffee examples include Ethiopia Sidamo Washed.')
		).toBeInTheDocument();
	});
});
