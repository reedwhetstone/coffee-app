import { expect, it, vi } from 'vitest';
import { loadProductPageData } from './productPageData';
import { load as loadRoast } from '../../routes/roast/+page.server';
import { load as loadProfit } from '../../routes/profit/+page.server';
it('starts primary reads on the server and returns without awaiting them', () => {
	const fetcher = vi.fn(() => new Promise<Response>(() => {}));
	// The roast page reads the roast list for a member only.
	const member = { isAuthenticated: true, appRoles: ['member'] };
	const roast = loadRoast({
		fetch: fetcher,
		locals: { principal: member },
		url: new URL('https://app.test/roast'),
		untrack: <T>(read: () => T) => read()
	} as never);
	const profit = loadProfit({ fetch: fetcher } as never);
	expect(roast).toHaveProperty('initialRoasts', expect.any(Promise));
	expect(profit).toHaveProperty('initialProfit', expect.any(Promise));
	// The roast page asks for its first page of roasts, not every roast.
	expect(fetcher.mock.calls).toEqual([['/api/roast-profiles?limit=50&offset=0'], ['/api/profit']]);
});
it('preserves complete product response data', async () => {
	const payload = { sales: [{ id: 3 }], profit: [{ id: 7 }] };
	const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload)));
	await expect(loadProductPageData(fetcher, '/api/profit')).resolves.toEqual({
		data: payload,
		error: null
	});
});
it('settles denied and network failures for the existing retry state', async () => {
	await expect(
		loadProductPageData(vi.fn().mockResolvedValue(new Response('', { status: 401 })), '/api/profit')
	).resolves.toEqual({ data: null, error: 'Failed to load data (401)' });
	await expect(
		loadProductPageData(vi.fn().mockRejectedValue(new Error('offline')), '/api/profit')
	).resolves.toEqual({ data: null, error: 'offline' });
});
