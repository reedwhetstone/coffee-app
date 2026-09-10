import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BeansPage from './+page.svelte';
const { page } = vi.hoisted(() => ({
	page: { url: new URL('https://purveyors.io/beans'), data: {} }
}));
vi.mock('$app/state', () => ({ page }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
const auth = {
	isSignedIn: true,
	user: { id: 'owner', email: null },
	role: 'member' as const,
	ppiAccess: true
};
beforeEach(() => {
	page.url = new URL('https://purveyors.io/beans');
	vi.stubGlobal(
		'fetch',
		vi.fn().mockResolvedValue(new Response(JSON.stringify({ trackedLots: [], trackedCatalog: [] })))
	);
});
afterEach(() => vi.unstubAllGlobals());
describe('portfolio streamed purchases and lazy bookmarks', () => {
	it('uses streamed purchases without another browser inventory request and loads bookmarks only on demand', async () => {
		render(BeansPage, { data: { auth, purchases: Promise.resolve({ data: [], error: null }) } });
		await screen.findByRole('tab', { name: 'Bookmarked' });
		expect(fetch).not.toHaveBeenCalled();
		await fireEvent.click(screen.getByRole('tab', { name: 'Bookmarked' }));
		await screen.findByText('No Bookmarked Lots Yet');
		expect(fetch).toHaveBeenCalledWith('/api/beans/watchlist');
		await fireEvent.click(screen.getByRole('tab', { name: 'Purchased' }));
		await fireEvent.click(screen.getByRole('tab', { name: 'Bookmarked (0)' }));
		expect(fetch).toHaveBeenCalledTimes(1);
	});
	it('loads bookmarked deep links without waiting for purchased data', async () => {
		page.url = new URL('https://purveyors.io/beans?tab=bookmarked');
		render(BeansPage, {
			data: { auth, purchases: new Promise<{ data: unknown[]; error: string | null }>(() => {}) }
		});
		await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/beans/watchlist'));
		await screen.findByText('No Bookmarked Lots Yet');
	});
	it('does not show an empty state before the watchlist request settles', async () => {
		let resolveWatchlist!: (response: Response) => void;
		vi.mocked(fetch).mockReturnValueOnce(
			new Promise<Response>((resolve) => {
				resolveWatchlist = resolve;
			})
		);
		page.url = new URL('https://purveyors.io/beans?tab=bookmarked');
		render(BeansPage, { data: { auth, purchases: Promise.resolve({ data: [], error: null }) } });

		await screen.findByText('Loading bookmarked lots…');
		expect(screen.queryByText('No Bookmarked Lots Yet')).toBeNull();
		resolveWatchlist(new Response(JSON.stringify({ trackedLots: [], trackedCatalog: [] })));
		await screen.findByText('No Bookmarked Lots Yet');
	});
	it('shows a recoverable watchlist failure instead of an empty state', async () => {
		vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 502 }));
		page.url = new URL('https://purveyors.io/beans?tab=bookmarked');
		render(BeansPage, { data: { auth, purchases: Promise.resolve({ data: [], error: null }) } });
		await screen.findByText('Unable to load bookmarked lots. Please try again.');
		expect(screen.queryByText('No Bookmarked Lots Yet')).toBeNull();
		await fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
		await screen.findByText('No Bookmarked Lots Yet');
	});
});
