import { render, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import AuthPage from './+page.svelte';

const { goto, pageState, signInWithGoogle, signOut } = vi.hoisted(() => ({
	goto: vi.fn(),
	pageState: { url: new URL('https://purveyors.io/auth') },
	signInWithGoogle: vi.fn(),
	signOut: vi.fn()
}));

vi.mock('$app/navigation', () => ({ goto }));
vi.mock('$app/state', () => ({ page: pageState }));
vi.mock('$lib/supabase', () => ({ signInWithGoogle, signOut }));

function createData() {
	return {
		session: { user: { id: 'user-1' } },
		user: { id: 'user-1' },
		supabase: {},
		role: 'viewer',
		ppiAccess: false
	} as never;
}

describe('auth page reauthentication', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		pageState.url = new URL('https://purveyors.io/auth?next=%2Fauth%2Fcli&forceReauth=1');
	});

	it('does not sign out an authenticated browser on a hostile GET', async () => {
		render(AuthPage, { data: createData() });

		await waitFor(() => expect(goto).toHaveBeenCalledWith('/auth/cli'));
		expect(signOut).not.toHaveBeenCalled();
	});
});
