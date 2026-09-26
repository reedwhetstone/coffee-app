import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadCatalogCoffeeDetail } from './loadCatalogCoffeeDetail';
afterEach(() => vi.unstubAllGlobals());
describe('full catalog detail read', () => {
	it('requests the exact ID in all stock states with full projection and preserves server proof', async () => {
		const proof = { version: 'proof-summary-v1' };
		const fetcher = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					data: [{ id: 12, name: 'Coffee', proof, processing_base_method: 'washed' }]
				})
			)
		);
		vi.stubGlobal('fetch', fetcher);
		const signal = new AbortController().signal;
		const row = await loadCatalogCoffeeDetail(12, signal);
		expect(fetcher).toHaveBeenCalledWith(
			'/api/catalog?coffeeIds=12&stocked=all&limit=1&projection=full&include=proof',
			{ signal }
		);
		expect(row).toMatchObject({ id: 12, proof, process: { base_method: 'washed' } });
	});
	it.each([{ data: [] }, { data: [{ id: 99 }] }, { data: [{ id: 12, summarySignals: {} }] }])(
		'rejects missing, wrong, or still-partial rows %j',
		async ({ data }) => {
			vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data }))));
			await expect(loadCatalogCoffeeDetail(12, new AbortController().signal)).rejects.toThrow(
				'Full coffee detail unavailable'
			);
		}
	);
});
