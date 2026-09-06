import { beforeEach, describe, expect, it, vi } from 'vitest';
const get = vi.hoisted(() => vi.fn());
const create = vi.hoisted(() => vi.fn(async () => ({ raw: { GET: get } })));
vi.mock('$lib/server/parchmentClient', () => ({ createParchmentServerClient: create }));
import { GET } from './+server';
beforeEach(() => vi.clearAllMocks());
describe('comparison discovery session BFF', () => {
	it('preserves the raw discovery envelope and uses session auth', async () => {
		const data = { windowDays: 30, from: null, to: null, comparisons: [] };
		get.mockResolvedValue({ data, response: new Response(null, { status: 200 }) });
		const event = {
			url: new URL('https://example.test/api/analytics/price-comparisons?wholesale=all')
		} as Parameters<typeof GET>[0];
		const result = await GET(event);
		expect(create).toHaveBeenCalledWith(event, { mode: 'session' });
		expect(get).toHaveBeenCalledWith('/v1/price-index/comparisons', {
			params: { query: { wholesale: 'all' } }
		});
		expect(await result.json()).toEqual(data);
		expect(result.headers.get('Cache-Control')).toBe('private, no-store');
	});
	it.each([401, 403, 429, 500])('preserves upstream %s errors', async (status) => {
		const error = { error: { message: 'Unavailable' } };
		get.mockResolvedValue({ error, response: new Response(null, { status }) });
		const result = await GET({
			url: new URL('https://example.test/api/analytics/price-comparisons')
		} as Parameters<typeof GET>[0]);
		expect(result.status).toBe(status);
		expect(await result.json()).toEqual(error);
		expect(result.headers.get('Cache-Control')).toBe('private, no-store');
	});
});
