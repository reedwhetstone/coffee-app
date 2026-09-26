import { expect, it, vi } from 'vitest';
import { loadProductPageData } from './productPageData';
import { load as loadRoast } from '../../routes/roast/+page.server';
import { load as loadProfit } from '../../routes/profit/+page.server';
it('starts primary reads on the server and returns without awaiting them', () => {
	const fetcher = vi.fn(() => new Promise<Response>(() => {}));
	const roast = loadRoast({ fetch: fetcher } as never);
	const profit = loadProfit({ fetch: fetcher } as never);
	expect(roast).toHaveProperty('initialRoasts', expect.any(Promise));
	expect(profit).toHaveProperty('initialProfit', expect.any(Promise));
	expect(fetcher.mock.calls).toEqual([['/api/roast-profiles'], ['/api/profit']]);
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
