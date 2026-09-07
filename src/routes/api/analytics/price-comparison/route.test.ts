import { describe, expect, it, vi } from 'vitest';
const get = vi.hoisted(() => vi.fn());
vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: vi.fn(async () => ({ raw: { GET: get } }))
}));
import { GET } from './+server';
describe('comparison BFF', () => {
	it('preserves upstream authorization failure and never caches it', async () => {
		get.mockResolvedValue({
			error: { error: { message: 'Intelligence required' } },
			response: new Response(null, { status: 403 })
		});
		const result = await GET({
			url: new URL(
				'https://example.test/api/analytics/price-comparison?from=2026-01-01&to=2026-01-02&origin=Ethiopia'
			)
		} as Parameters<typeof GET>[0]);
		expect(result.status).toBe(403);
		expect(result.headers.get('Cache-Control')).toBe('private, no-store');
		expect(get).toHaveBeenCalledWith('/v1/price-index/comparison', {
			params: { query: { from: '2026-01-01', to: '2026-01-02', origin: 'Ethiopia' } }
		});
	});
});
