import { describe, expect, it, vi } from 'vitest';
import {
	createParchmentSale,
	deleteParchmentSale,
	fetchParchmentSales,
	ParchmentSalesError,
	updateParchmentSale
} from './parchmentSales';

const saleResource = {
	id: 31,
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

describe('fetchParchmentSales', () => {
	it('paginates all owner sales and preserves the legacy projection', async () => {
		const firstSale = { ...saleResource, id: 11 };
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

describe('Parchment sales mutations', () => {
	it('creates with an optional idempotency key and unwraps the sale', async () => {
		const created = saleResource;
		const create = vi.fn().mockResolvedValue({ data: { data: created } });

		await expect(
			createParchmentSale(
				{ sales: { create } } as never,
				{ greenCoffeeInvId: 7, ozSold: 12, price: 24 },
				'sale-create-1'
			)
		).resolves.toBe(created);
		expect(create).toHaveBeenCalledWith(
			{ greenCoffeeInvId: 7, ozSold: 12, price: 24 },
			{ idempotencyKey: 'sale-create-1' }
		);
	});

	it('updates and requires the response id to match', async () => {
		const update = vi.fn().mockResolvedValue({ data: { data: { ...saleResource, id: 32 } } });

		await expect(
			updateParchmentSale({ sales: { update } } as never, 31, { price: 30 })
		).rejects.toMatchObject({
			name: 'ParchmentSalesError',
			status: 502
		});
	});

	it.each([null, 42, { id: 31 }])(
		'rejects a malformed create resource as a protocol failure',
		async (data) => {
			const create = vi.fn().mockResolvedValue({ data: { data } });

			await expect(
				createParchmentSale({ sales: { create } } as never, {
					greenCoffeeInvId: 7,
					ozSold: 12,
					price: 24
				})
			).rejects.toMatchObject({
				name: 'ParchmentSalesError',
				status: 502
			});
		}
	);

	it('deletes only when Parchment confirms the requested id', async () => {
		const deleteSale = vi.fn().mockResolvedValue({ data: { data: { id: 31, deleted: true } } });

		await expect(
			deleteParchmentSale({ sales: { delete: deleteSale } } as never, 31)
		).resolves.toBeUndefined();
		expect(deleteSale).toHaveBeenCalledWith(31);
	});

	it.each([null, 42, { id: 31 }, { id: 31, deleted: false }])(
		'rejects a malformed delete confirmation',
		async (data) => {
			const deleteSale = vi.fn().mockResolvedValue({ data: { data } });

			await expect(
				deleteParchmentSale({ sales: { delete: deleteSale } } as never, 31)
			).rejects.toMatchObject({
				name: 'ParchmentSalesError',
				status: 502
			});
		}
	);

	it('preserves an upstream error response', async () => {
		const create = vi.fn().mockResolvedValue({
			error: { error: { code: 'writes_disabled', message: 'Sales writes are disabled' } },
			response: new Response(null, { status: 503 })
		});

		const promise = createParchmentSale({ sales: { create } } as never, {
			greenCoffeeInvId: 7,
			ozSold: 12,
			price: 24
		});

		await expect(promise).rejects.toBeInstanceOf(ParchmentSalesError);
		await expect(promise).rejects.toMatchObject({
			status: 503,
			body: { error: { code: 'writes_disabled', message: 'Sales writes are disabled' } }
		});
	});
});
