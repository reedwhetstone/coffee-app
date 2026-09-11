import { describe, expect, it, vi } from 'vitest';
import { fetchParchmentProfit } from './parchmentProfit';

const profitItem = {
	id: 7,
	coffee_name: 'Ethiopia Guji',
	purchase_date: '2026-07-01',
	purchased_qty_lbs: 10,
	purchased_qty_oz: 160,
	bean_cost: 50,
	tax_ship_cost: 5,
	total_sales: 80,
	oz_sold: 32,
	profit: 25,
	oz_in: 48,
	oz_out: 40,
	profit_margin: 45.45,
	wholesale: true
};

describe('fetchParchmentProfit', () => {
	it('paginates all owner summaries using stable inventory ids', async () => {
		const firstPage = Array.from({ length: 200 }, (_, i) => ({ ...profitItem, id: i + 10 }));
		const secondItem = { ...profitItem, id: 8 };
		const list = vi
			.fn()
			.mockResolvedValueOnce({ data: { data: firstPage } })
			.mockResolvedValueOnce({ data: { data: [secondItem] } })
			.mockResolvedValueOnce({ data: { data: [] } });

		await expect(fetchParchmentProfit({ profit: { list } } as never)).resolves.toEqual([
			...firstPage,
			secondItem
		]);
		expect(list).toHaveBeenNthCalledWith(1, { limit: 200, offset: 0 });
		expect(list).toHaveBeenNthCalledWith(2, { limit: 200, offset: 200 });
		expect(list).toHaveBeenCalledTimes(2);
	});

	it('preserves legacy JSON omission for absent names and dates', async () => {
		const list = vi
			.fn()
			.mockResolvedValueOnce({
				data: { data: [{ ...profitItem, coffee_name: null, purchase_date: null }] }
			})
			.mockResolvedValueOnce({ data: { data: [] } });

		const result = await fetchParchmentProfit({ profit: { list } } as never);

		expect(JSON.parse(JSON.stringify(result))).toEqual([
			{
				id: 7,
				purchased_qty_lbs: 10,
				purchased_qty_oz: 160,
				bean_cost: 50,
				tax_ship_cost: 5,
				total_sales: 80,
				oz_sold: 32,
				profit: 25,
				oz_in: 48,
				oz_out: 40,
				profit_margin: 45.45,
				wholesale: true
			}
		]);
	});

	it('rejects a failed Parchment response', async () => {
		const list = vi.fn().mockResolvedValue({
			error: { message: 'profit unavailable' },
			response: new Response(null, { status: 503 })
		});

		await expect(fetchParchmentProfit({ profit: { list } } as never)).rejects.toThrow(
			'profit unavailable'
		);
	});
});
