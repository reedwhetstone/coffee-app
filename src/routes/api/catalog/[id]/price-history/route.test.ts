import { beforeEach, describe, expect, it, vi } from 'vitest';

const priceHistory = vi.hoisted(() => vi.fn());
vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: vi.fn(async () => ({ catalog: { priceHistory } }))
}));

import { GET } from './+server';

function event(id: string, query = '') {
	return {
		params: { id },
		url: new URL(`https://example.test/api/catalog/${id}/price-history${query}`)
	} as Parameters<typeof GET>[0];
}

describe('catalog price-history BFF', () => {
	beforeEach(() => priceHistory.mockReset());

	it('forwards the coffee and window, and never caches the member response', async () => {
		priceHistory.mockResolvedValue({
			data: { data: { points: [] } },
			response: new Response(null, { status: 200 })
		});

		const result = await GET(event('8806', '?days=180'));

		expect(result.status).toBe(200);
		expect(await result.json()).toEqual({ data: { points: [] } });
		expect(result.headers.get('Cache-Control')).toContain('no-store');
		expect(priceHistory).toHaveBeenCalledWith('8806', { days: '180' });
	});

	it('leaves the window to Parchment when none is given', async () => {
		priceHistory.mockResolvedValue({
			data: { data: { points: [] } },
			response: new Response(null, { status: 200 })
		});

		await GET(event('8806'));

		expect(priceHistory).toHaveBeenCalledWith('8806', undefined);
	});

	it('preserves an upstream entitlement refusal', async () => {
		priceHistory.mockResolvedValue({
			error: { error: { code: 'forbidden', message: 'Membership required' } },
			response: new Response(null, { status: 403 })
		});

		const result = await GET(event('8806'));

		expect(result.status).toBe(403);
		expect(await result.json()).toEqual({
			error: { code: 'forbidden', message: 'Membership required' }
		});
	});

	it('rejects an invalid id before calling Parchment', async () => {
		const result = await GET(event('not-a-number'));

		expect(result.status).toBe(400);
		expect(priceHistory).not.toHaveBeenCalled();
	});
});
