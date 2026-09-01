import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

const { invalidateAll } = vi.hoisted(() => ({ invalidateAll: vi.fn() }));

vi.mock('$app/navigation', () => ({ invalidateAll }));

import MarketWirePage from './+page.svelte';

const unsubscribedPreference = {
	publication: 'market_read',
	status: 'unsubscribed',
	subscribed: false,
	consentSource: null,
	consentedAt: null,
	unsubscribedAt: null,
	createdAt: null,
	updatedAt: null
};

function createData(signedIn: boolean, marketReadError: string | null = null) {
	return {
		isSignedIn: signedIn,
		email: signedIn ? 'reader@example.com' : '',
		marketReadPreference: signedIn && !marketReadError ? unsubscribedPreference : null,
		marketReadError,
		latestEditions: [],
		meta: {}
	} as never;
}

describe('/market-wire subscription journey', () => {
	beforeEach(() => vi.clearAllMocks());

	it('returns anonymous readers to Market Brief after sign-in without subscribing on a GET', () => {
		render(MarketWirePage, { data: createData(false) });

		expect(screen.getByRole('link', { name: 'Sign in to join the waitlist' })).toHaveAttribute(
			'href',
			'/auth?next=%2Fmarket-wire'
		);
	});

	it('joins the waitlist through the marketing provenance method', async () => {
		const subscribedPreference = {
			...unsubscribedPreference,
			status: 'subscribed',
			subscribed: true,
			consentSource: 'signup',
			consentedAt: '2026-08-31T01:00:00.000Z',
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
		render(MarketWirePage, { data: createData(true) });

		await fireEvent.click(screen.getByRole('button', { name: 'Join the waitlist' }));

		await waitFor(() => expect(screen.getByText('You’re on the waitlist.')).toBeVisible());
		expect(fetchMock).toHaveBeenCalledWith('/api/email-subscriptions/market-read', {
			method: 'POST'
		});
		expect(screen.getByRole('link', { name: /Manage email preference/ })).toHaveAttribute(
			'href',
			'/account'
		);
	});

	it('lets signed-in readers retry a transient preference read failure', async () => {
		invalidateAll.mockResolvedValue(undefined);
		const { rerender } = render(MarketWirePage, {
			data: createData(true, 'Your Market Brief preference is temporarily unavailable.')
		});

		expect(screen.getByRole('button', { name: 'Join the waitlist' })).toBeDisabled();
		await fireEvent.click(screen.getByRole('button', { name: 'Retry status' }));
		expect(invalidateAll).toHaveBeenCalledOnce();

		await rerender({ data: createData(true) });
		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Join the waitlist' })).toBeEnabled();
	});
});
