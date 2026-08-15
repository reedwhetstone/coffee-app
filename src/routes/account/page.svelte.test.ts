import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import AccountPage from './+page.svelte';

const { goto, signInWithGoogle } = vi.hoisted(() => ({
	goto: vi.fn(),
	signInWithGoogle: vi.fn()
}));

vi.mock('$app/navigation', () => ({ goto }));
vi.mock('$lib/supabase', () => ({ signInWithGoogle }));

function createData(signOut: ReturnType<typeof vi.fn>) {
	return {
		auth: {
			isSignedIn: true,
			user: { id: 'user-1', email: 'owner@example.com' },
			role: 'viewer',
			ppiAccess: false
		},
		email: 'owner@example.com',
		supabase: { auth: { signOut } }
	} as never;
}

describe('account deletion completion', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		sessionStorage.clear();
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				new Response(
					JSON.stringify({
						operationId: '9dc525f2-b855-4af1-9908-661f030e716c',
						status: 'accepted'
					}),
					{ status: 202, headers: { 'content-type': 'application/json' } }
				)
			)
		);
	});

	it('invalidates authenticated layout data before showing the completion page', async () => {
		const signOut = vi.fn().mockResolvedValue({ error: null });
		render(AccountPage, { data: createData(signOut) });

		await fireEvent.input(screen.getByLabelText(/Type DELETE MY ACCOUNT exactly to confirm/), {
			target: { value: 'DELETE MY ACCOUNT' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Permanently delete account' }));

		await waitFor(() =>
			expect(goto).toHaveBeenCalledWith('/', {
				replaceState: true,
				invalidateAll: true
			})
		);
		expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
		expect(signOut.mock.invocationCallOrder[0]).toBeLessThan(goto.mock.invocationCallOrder[0]);
		expect(sessionStorage.getItem('purveyors:account-deletion-accepted')).toBe('true');
	});
});
