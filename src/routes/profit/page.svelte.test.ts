import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('$app/state', () => ({ page: { url: new URL('https://example.com/profit') } }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
import ProfitPage from './+page.svelte';
import { page } from '$app/state';
import { pageChatContext } from '$lib/stores/pageContextStore.svelte';
afterEach(() => {
	cleanup();
	pageChatContext.clear();
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

it('does not publish profit metrics or entities while loading or after failure', async () => {
	let resolveProfit!: (value: { data: null; error: string }) => void;
	const initialProfit = new Promise<{ data: null; error: string }>((resolve) => {
		resolveProfit = resolve;
	});
	render(ProfitPage, {
		data: {
			auth: { isSignedIn: true, user: null, role: 'member', ppiAccess: false },
			initialProfit
		}
	});

	await waitFor(() => expect(pageChatContext.current?.summary).toContain('data is loading'));
	expect(pageChatContext.current?.summary).not.toContain('$0.00');
	expect(pageChatContext.current?.entities).toEqual([]);

	resolveProfit({ data: null, error: 'Unavailable' });
	await waitFor(() => expect(pageChatContext.current?.summary).toContain('data is unavailable'));
	expect(pageChatContext.current?.summary).not.toContain('$0.00');
	expect(pageChatContext.current?.entities).toEqual([]);
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
