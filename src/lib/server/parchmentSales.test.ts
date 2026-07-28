import { describe, expect, it, vi } from 'vitest';
import { fetchParchmentSales } from './parchmentSales';

describe('fetchParchmentSales', () => {
	it('paginates all owner sales and preserves the legacy projection', async () => {
		const firstSale = {
			id: 11,
			green_coffee_inv_id: 7,
			batch_name: 'Batch 7',
			buyer: 'Cafe',
			oz_sold: 12,
			price: 24,
			purchase_date: '2026-07-01',
			sell_date: '2026-07-27',
			user: 'owner-1',
			coffee_name: 'Ethiopia Guji',
			wholesale: true
		};
		const salesList = vi
			.fn()
			.mockResolvedValueOnce({ data: { data: [firstSale] } })
			.mockResolvedValueOnce({ data: { data: [] } });

		const result = await fetchParchmentSales({ sales: { list: salesList } } as never);

		expect(salesList).toHaveBeenNthCalledWith(1, { limit: 200, offset: 0 });
		expect(salesList).toHaveBeenNthCalledWith(2, { limit: 200, offset: 1 });
		expect(result).toEqual([firstSale]);
	});

	it('rejects a failed Parchment response', async () => {
		const salesList = vi.fn().mockResolvedValue({
			error: { message: 'sales unavailable' },
			response: new Response(null, { status: 503 })
		});

		await expect(fetchParchmentSales({ sales: { list: salesList } } as never)).rejects.toThrow(
			'sales unavailable'
		);
	});
});
