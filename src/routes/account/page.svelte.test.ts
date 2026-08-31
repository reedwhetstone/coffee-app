import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import AccountPage from './+page.svelte';

const { goto, invalidateAll, signInWithGoogle } = vi.hoisted(() => ({
	goto: vi.fn(),
	invalidateAll: vi.fn(),
	signInWithGoogle: vi.fn()
}));

vi.mock('$app/navigation', () => ({ goto, invalidateAll }));
vi.mock('$lib/supabase', () => ({ signInWithGoogle }));

function createData(signOut: ReturnType<typeof vi.fn>, marketReadError: string | null = null) {
	return {
		auth: {
			isSignedIn: true,
			user: { id: 'user-1', email: 'owner@example.com' },
			role: 'viewer',
			ppiAccess: false
		},
		email: 'owner@example.com',
		marketReadPreference: marketReadError
			? null
			: {
					publication: 'market_read',
					status: 'unsubscribed',
					subscribed: false,
					consentSource: null,
					consentedAt: null,
					unsubscribedAt: null,
					createdAt: null,
					updatedAt: null
				},
		marketReadError,
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

	it('subscribes from account settings through the server-owned preference route', async () => {
		const subscribedPreference = {
			publication: 'market_read',
			status: 'subscribed',
			subscribed: true,
			consentSource: 'account_settings',
			consentedAt: '2026-08-31T01:00:00.000Z',
			unsubscribedAt: null,
			createdAt: '2026-08-31T01:00:00.000Z',
			updatedAt: '2026-08-31T01:00:00.000Z'
		};
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ data: subscribedPreference }), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			})
		);
		vi.stubGlobal('fetch', fetchMock);

		render(AccountPage, { data: createData(vi.fn()) });
		await fireEvent.click(screen.getByRole('button', { name: 'Subscribe to Market Wire' }));

		await waitFor(() => expect(screen.getByText('Market Wire delivery is on.')).toBeVisible());
		expect(fetchMock).toHaveBeenCalledWith('/api/email-subscriptions/market-read', {
			method: 'PUT'
		});
		expect(screen.getByRole('button', { name: 'Stop weekly emails' })).toBeVisible();
	});

	it('lets account owners retry a transient preference read failure', async () => {
		invalidateAll.mockResolvedValue(undefined);
		const { rerender } = render(AccountPage, {
			data: createData(vi.fn(), 'Your Market Wire preference is temporarily unavailable.')
		});

		expect(screen.getByRole('button', { name: 'Subscribe to Market Wire' })).toBeDisabled();
		await fireEvent.click(screen.getByRole('button', { name: 'Retry status' }));
		expect(invalidateAll).toHaveBeenCalledOnce();

		await rerender({ data: createData(vi.fn()) });
		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Subscribe to Market Wire' })).toBeEnabled();
	});
});
