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

it('opens the sale form filled in from a "Log sale" link, and clears the link when it closes', async () => {
	const { goto } = await import('$app/navigation');
	const batchId = 'aaaaaaaa-0000-4000-8000-000000000001';
	page.url = new URL(`https://example.com/profit?modal=new&coffee=101&batch=${batchId}&roast=4531`);
	const fetcher = vi.fn(async (input: RequestInfo | URL) => {
		const url = String(input);
		if (url === '/api/beans') {
			return new Response(
				JSON.stringify({ data: [{ id: 101, name: 'Ethiopia Wush Wush', stocked: true }] })
			);
		}
		if (url === '/api/roast-profiles') {
			return new Response(
				JSON.stringify({
					data: [
						{
							roast_id: 4531,
							batch_id: batchId,
							batch_name: 'Wednesday roast',
							roast_date: '2026-10-01',
							coffee_id: 101,
							coffee_name: 'Ethiopia Wush Wush'
						}
					]
				})
			);
		}
		return new Response(JSON.stringify({ data: [] }));
	});
	vi.stubGlobal('fetch', fetcher);
	render(ProfitPage, {
		data: {
			auth: { isSignedIn: true, user: null, role: 'member', ppiAccess: false },
			initialProfit: Promise.resolve({ data: { sales: [], profit: [] }, error: null })
		}
	});

	const selected = (label: string | RegExp) =>
		Array.from((screen.getByLabelText(label) as HTMLSelectElement).options)
			.find((option) => option.selected)
			?.textContent?.trim();
	await waitFor(() => expect(selected('Coffee Name')).toBe('Ethiopia Wush Wush'));
	expect(selected(/^Batch/)).toMatch(/· Wednesday roast$/);
	expect(screen.getByRole('checkbox', { name: /From roast #4531 only/ })).toBeChecked();

	screen.getByRole('button', { name: 'Cancel' }).click();

	expect(vi.mocked(goto)).toHaveBeenCalledWith('/profit', expect.anything());
});

it('does not open the sale form from a "Log sale" link for an account that cannot record sales', async () => {
	page.url = new URL('https://example.com/profit?modal=new&coffee=101');
	const fetcher = vi.fn();
	vi.stubGlobal('fetch', fetcher);
	render(ProfitPage, {
		data: {
			auth: { isSignedIn: true, user: null, role: 'viewer', ppiAccess: false },
			initialProfit: Promise.resolve({ data: { sales: [], profit: [] }, error: null })
		}
	});

	await waitFor(() => expect(screen.getByText('Profit cockpit')).toBeTruthy());
	expect(screen.queryByRole('dialog')).toBeNull();
	expect(fetcher).not.toHaveBeenCalled();
});
