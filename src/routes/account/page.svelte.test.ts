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

function createData(signOut: ReturnType<typeof vi.fn>, overrides: Record<string, unknown> = {}) {
	return {
		auth: {
			isSignedIn: true,
			user: { id: 'user-1', email: 'owner@example.com' },
			role: 'viewer',
			ppiAccess: false
		},
		email: 'owner@example.com',
		marketReadPreference: {
			publication: 'market_read',
			status: 'unsubscribed',
			subscribed: false,
			consentSource: null,
			consentedAt: null,
			unsubscribedAt: null,
			createdAt: null,
			updatedAt: null
		},
		marketReadError: null,
		supabase: { auth: { signOut } },
		...overrides
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

	it('joins the waitlist from account settings through the server-owned preference route', async () => {
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
		await fireEvent.click(screen.getByRole('button', { name: 'Join Market Brief waitlist' }));

		await waitFor(() => expect(screen.getByText('Market Brief waitlist is on.')).toBeVisible());
		expect(fetchMock).toHaveBeenCalledWith('/api/email-subscriptions/market-read', {
			method: 'PUT'
		});
		expect(screen.getByRole('button', { name: 'Leave Market Brief waitlist' })).toBeVisible();
	});

	it('keeps a safe waitlist opt-out available when preference status is unavailable', async () => {
		const unsubscribedPreference = {
			publication: 'market_read',
			status: 'unsubscribed',
			subscribed: false,
			consentSource: null,
			consentedAt: null,
			unsubscribedAt: '2026-08-31T01:00:00.000Z',
			createdAt: '2026-08-31T01:00:00.000Z',
			updatedAt: '2026-08-31T01:00:00.000Z'
		};
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ data: unsubscribedPreference }), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			})
		);
		vi.stubGlobal('fetch', fetchMock);

		render(AccountPage, {
			data: createData(vi.fn(), {
				marketReadPreference: null,
				marketReadError: 'Your Market Brief preference is temporarily unavailable.'
			})
		});

		const button = screen.getByRole('button', { name: 'Leave Market Brief waitlist' });
		expect(button).toBeEnabled();
		await fireEvent.click(button);

		await waitFor(() => expect(screen.getByText('Market Brief waitlist is off.')).toBeVisible());
		expect(fetchMock).toHaveBeenCalledWith('/api/email-subscriptions/market-read', {
			method: 'DELETE'
		});
		expect(screen.getByRole('button', { name: 'Join Market Brief waitlist' })).toBeVisible();
		expect(screen.queryByText('temporarily unavailable')).not.toBeInTheDocument();
	});

	it('lets account owners retry a transient preference read failure', async () => {
		invalidateAll.mockResolvedValue(undefined);
		const { rerender } = render(AccountPage, {
			data: createData(vi.fn(), {
				marketReadPreference: null,
				marketReadError: 'Your Market Brief preference is temporarily unavailable.'
			})
		});

		expect(screen.getByRole('button', { name: 'Leave Market Brief waitlist' })).toBeEnabled();
		await fireEvent.click(screen.getByRole('button', { name: 'Retry status' }));
		expect(invalidateAll).toHaveBeenCalledOnce();

		await rerender({ data: createData(vi.fn()) });
		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Join Market Brief waitlist' })).toBeEnabled();
	});
});
