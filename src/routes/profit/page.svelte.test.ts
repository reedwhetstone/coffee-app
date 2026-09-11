import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('$app/state', () => ({ page: { url: new URL('https://example.com/profit') } }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
import ProfitPage from './+page.svelte';
import { page } from '$app/state';
afterEach(() => {
	cleanup();
	page.url = new URL('https://example.com/profit');
	vi.unstubAllGlobals();
});
it('uses the server stream without eager inventory or roast picker requests', async () => {
	const fetcher = vi.fn();
	vi.stubGlobal('fetch', fetcher);
	render(ProfitPage, {
		data: {
			auth: { isSignedIn: true, user: null, role: 'member', ppiAccess: false },
			initialProfit: Promise.resolve({ data: { sales: [], profit: [] }, error: null })
		}
	});
	await waitFor(() => expect(screen.getByText('Profit cockpit')).toBeTruthy());
	expect(fetcher).not.toHaveBeenCalled();
});

it('loads picker choices when entering the new-sale form', async () => {
	page.url = new URL('https://example.com/profit?modal=new');
	const fetcher = vi
		.fn()
		.mockImplementation(async () => new Response(JSON.stringify({ data: [] })));
	vi.stubGlobal('fetch', fetcher);
	render(ProfitPage, {
		data: {
			auth: { isSignedIn: true, user: null, role: 'member', ppiAccess: false },
			initialProfit: Promise.resolve({ data: { sales: [], profit: [] }, error: null })
		}
	});
	await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
	expect(fetcher.mock.calls.map(([url]) => url).sort()).toEqual([
		'/api/beans',
		'/api/roast-profiles'
	]);
});
