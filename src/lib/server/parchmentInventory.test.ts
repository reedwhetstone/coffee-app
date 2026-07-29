import { describe, expect, it, vi } from 'vitest';
import {
	createParchmentManualInventoryBatch,
	deleteParchmentInventoryItem,
	fetchParchmentInventoryProjection,
	getParchmentManualInventoryBatch,
	ParchmentInventoryError
} from './parchmentInventory';

describe('fetchParchmentInventoryProjection', () => {
	it('paginates owner resources and preserves the beans-page projection', async () => {
		const inventoryList = vi
			.fn()
			.mockResolvedValueOnce({
				data: {
					data: [
						{
							id: 7,
							rank: 1,
							notes: 'owner note',
							cupping_notes: null,
							purchase_date: '2026-07-01',
							purchased_qty_lbs: 5,
							bean_cost: 40,
							tax_ship_cost: 4,
							last_updated: '2026-07-27T00:00:00Z',
							user: 'owner-1',
							catalog_id: 101,
							stocked: true,
							coffee_catalog: { id: 101, name: 'Compact name' }
						}
					]
				}
			})
			.mockResolvedValueOnce({ data: { data: [] } });
		const roastList = vi
			.fn()
			.mockResolvedValueOnce({
				data: {
					data: [
						{
							roast_id: 9,
							coffee_id: 7,
							oz_in: 16,
							oz_out: 13,
							weight_loss_percent: 18.755,
							batch_name: 'Batch 9',
							roast_date: '2026-07-20'
						},
						{
							roast_id: 10,
							coffee_id: 999,
							oz_in: 12,
							oz_out: 10,
							weight_loss_percent: 16,
							batch_name: 'Unrelated',
							roast_date: '2026-07-21'
						}
					]
				}
			})
			.mockResolvedValueOnce({ data: { data: [] } });
		const catalogList = vi.fn().mockResolvedValue({
			data: {
				data: [
					{
						id: 101,
						name: 'Full name',
						processing: 'Washed',
						ai_tasting_notes: { acidity: 4 }
					}
				]
			}
		});
		const client = {
			inventory: { list: inventoryList },
			roasts: { list: roastList },
			catalog: { list: catalogList }
		};

		const result = await fetchParchmentInventoryProjection(client as never, {
			id: 7,
			includeRoastProfiles: true
		});

		expect(inventoryList).toHaveBeenNthCalledWith(1, { limit: 200, offset: 0 });
		expect(inventoryList).toHaveBeenNthCalledWith(2, { limit: 200, offset: 1 });
		expect(catalogList).toHaveBeenCalledWith({
			coffeeIds: '101',
			stocked: 'all',
			showWholesale: 'true',
			limit: 1
		});
		expect(roastList).toHaveBeenNthCalledWith(1, {
			limit: 200,
			offset: 0,
			coffee_id: 7
		});
		expect(result).toEqual([
			expect.objectContaining({
				id: 7,
				ai_tasting_notes: '{"acidity":4}',
				coffee_catalog: expect.objectContaining({
					name: 'Full name',
					processing: 'Washed',
					ai_tasting_notes: '{"acidity":4}'
				}),
				roast_profiles: [
					{
						roast_id: 9,
						oz_in: 16,
						oz_out: 13,
						weight_loss_percent: 18.76,
						batch_name: 'Batch 9',
						roast_date: '2026-07-20'
					}
				]
			})
		]);
	});

	it('does not request roast data for Parchment Intelligence-only readers', async () => {
		const roastList = vi.fn();
		const client = {
			inventory: {
				list: vi.fn().mockResolvedValueOnce({ data: { data: [] } })
			},
			roasts: { list: roastList },
			catalog: { list: vi.fn() }
		};

		expect(
			await fetchParchmentInventoryProjection(client as never, {
				includeRoastProfiles: false
			})
		).toEqual([]);
		expect(roastList).not.toHaveBeenCalled();
	});

	it('accepts the canonical inventory delete response', async () => {
		const inventoryDelete = vi.fn().mockResolvedValue({
			data: { data: { id: 7, deleted: true } }
		});

		await expect(
			deleteParchmentInventoryItem({ inventory: { delete: inventoryDelete } } as never, 7)
		).resolves.toBeUndefined();
		expect(inventoryDelete).toHaveBeenCalledWith(7);
	});

	it('preserves Parchment inventory status and body', async () => {
		const body = {
			error: {
				code: 'dependency_conflict',
				message: 'Inventory item has dependent records'
			}
		};
		const inventoryDelete = vi.fn().mockResolvedValue({
			error: body,
			response: new Response(null, { status: 409 })
		});

		const promise = deleteParchmentInventoryItem(
			{ inventory: { delete: inventoryDelete } } as never,
			7
		);

		await expect(promise).rejects.toMatchObject({
			name: 'ParchmentInventoryError',
			status: 409,
			body
		});
		await expect(promise).rejects.toBeInstanceOf(ParchmentInventoryError);
	});

	it('rejects a malformed inventory delete success response', async () => {
		const inventoryDelete = vi.fn().mockResolvedValue({
			data: { data: { id: 8, deleted: true } }
		});

		await expect(
			deleteParchmentInventoryItem({ inventory: { delete: inventoryDelete } } as never, 7)
		).rejects.toThrow('Parchment returned an invalid inventory delete response');
	});

	it.each([
		['create', createParchmentManualInventoryBatch, 'createManualBatch'],
		['reconcile', getParchmentManualInventoryBatch, 'getManualBatch']
	])(
		'rejects a malformed 2xx %s batch response as a gateway error',
		async (_name, helper, method) => {
			const batchId = '00000000-0000-4000-8000-000000000001';
			const batchMethod = vi.fn().mockResolvedValue({
				data: { data: undefined },
				error: undefined,
				response: new Response(null, { status: method === 'createManualBatch' ? 201 : 200 })
			});
			const client = { inventory: { [method]: batchMethod } };

			const promise =
				method === 'createManualBatch'
					? (helper as typeof createParchmentManualInventoryBatch)(
							client as never,
							{ items: [{ rowId: batchId, manualCoffee: { name: 'Test lot' }, qty: 1 }] },
							batchId
						)
					: (helper as typeof getParchmentManualInventoryBatch)(client as never, batchId);

			await expect(promise).rejects.toMatchObject({
				name: 'ParchmentInventoryError',
				status: 502,
				body: {
					error: {
						code: 'invalid_response'
					}
				}
			});
		}
	);
});
