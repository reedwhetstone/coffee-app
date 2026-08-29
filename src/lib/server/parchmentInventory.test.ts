import { describe, expect, it, vi } from 'vitest';
import {
	commitParchmentCatalogInventoryBatch,
	createParchmentManualInventoryBatch,
	deleteParchmentInventoryItem,
	fetchParchmentInventoryProjection,
	getParchmentCatalogInventoryBatchStatus,
	getParchmentManualInventoryBatch,
	ParchmentInventoryError,
	reserveParchmentCatalogInventoryBatch,
	updateParchmentInventoryItem
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

	it('updates inventory with an If-Match precondition and returns the canonical projection', async () => {
		const update = vi.fn().mockResolvedValue({
			data: {
				data: {
					id: 7,
					catalog_id: 101,
					purchased_qty_lbs: 6,
					stocked: false,
					coffee_catalog: null
				}
			}
		});

		const result = await updateParchmentInventoryItem(
			{ inventory: { update } } as never,
			7,
			{ qty: 6 },
			'2026-07-31T17:00:00.000Z'
		);

		expect(update).toHaveBeenCalledWith(7, { qty: 6 }, { ifMatch: '2026-07-31T17:00:00.000Z' });
		expect(result).toEqual(
			expect.objectContaining({
				id: 7,
				purchased_qty_lbs: 6,
				stocked: false,
				roast_profiles: []
			})
		);
	});

	it('returns the committed update without a fallible post-commit projection read', async () => {
		const update = vi.fn().mockResolvedValue({
			data: {
				data: {
					id: 7,
					catalog_id: 101,
					purchased_qty_lbs: 6,
					last_updated: '2026-07-31T17:00:01.000Z',
					coffee_catalog: null
				}
			}
		});
		const roastList = vi.fn().mockRejectedValue(new Error('roast service unavailable'));
		const catalogList = vi.fn().mockRejectedValue(new Error('catalog service unavailable'));

		await expect(
			updateParchmentInventoryItem(
				{
					inventory: { update },
					roasts: { list: roastList },
					catalog: { list: catalogList }
				} as never,
				7,
				{ qty: 6 },
				'2026-07-31T17:00:00.000Z'
			)
		).resolves.toEqual(
			expect.objectContaining({
				id: 7,
				purchased_qty_lbs: 6,
				last_updated: '2026-07-31T17:00:01.000Z',
				roast_profiles: []
			})
		);
		expect(roastList).not.toHaveBeenCalled();
		expect(catalogList).not.toHaveBeenCalled();
	});

	it('rejects a malformed successful inventory update response', async () => {
		const promise = updateParchmentInventoryItem(
			{
				inventory: {
					update: vi.fn().mockResolvedValue({
						data: { data: undefined },
						response: new Response(null, { status: 200 })
					})
				}
			} as never,
			7,
			{ notes: 'new note' }
		);

		await expect(promise).rejects.toMatchObject({
			name: 'ParchmentInventoryError',
			status: 502,
			body: {
				error: {
					code: 'invalid_response',
					message: 'Parchment inventory response did not include a resource payload'
				}
			}
		});
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

	it('reserves, commits, and reconciles catalog batches through the typed SDK lifecycle', async () => {
		const batchId = '00000000-0000-4000-8000-000000000001';
		const accepted = {
			batchId,
			status: 'accepted' as const,
			result: null,
			error: null,
			updatedAt: '2026-08-29T16:00:00.000Z'
		};
		const completed = {
			batchId,
			status: 'completed' as const,
			result: {
				batchId,
				items: [{ rowId: '00000000-0000-4000-8000-000000000002', inventoryId: 41 }]
			},
			error: null,
			updatedAt: '2026-08-29T16:00:01.000Z'
		};
		const reserveCatalogBatch = vi.fn().mockResolvedValue({ data: { data: accepted } });
		const commitCatalogBatch = vi.fn().mockResolvedValue({ data: { data: completed } });
		const getCatalogBatchStatus = vi.fn().mockResolvedValue({ data: { data: completed } });
		const client = {
			inventory: { reserveCatalogBatch, commitCatalogBatch, getCatalogBatchStatus }
		};
		const body = {
			batchId,
			purchaseDate: '2026-08-29',
			taxShipTotal: 5.01,
			items: [
				{
					rowId: '00000000-0000-4000-8000-000000000002',
					catalogId: 99,
					qty: 5
				}
			]
		};

		await expect(reserveParchmentCatalogInventoryBatch(client as never, body)).resolves.toEqual(
			accepted
		);
		await expect(commitParchmentCatalogInventoryBatch(client as never, batchId)).resolves.toEqual(
			completed
		);
		await expect(
			getParchmentCatalogInventoryBatchStatus(client as never, batchId)
		).resolves.toEqual(completed);

		expect(reserveCatalogBatch).toHaveBeenCalledWith(body);
		expect(commitCatalogBatch).toHaveBeenCalledWith(batchId);
		expect(getCatalogBatchStatus).toHaveBeenCalledWith(batchId);
	});

	it.each([
		['wrong batch UUID', { batchId: '00000000-0000-4000-8000-000000000009' }],
		['malformed terminal state', { status: 'completed', result: null }],
		['missing result field', { result: undefined }],
		[
			'completed result for another batch',
			{
				status: 'completed',
				result: {
					batchId: '00000000-0000-4000-8000-000000000009',
					items: [{ rowId: '00000000-0000-4000-8000-000000000002', inventoryId: 41 }]
				}
			}
		],
		[
			'nonterminal result payload',
			{
				result: {
					batchId: '00000000-0000-4000-8000-000000000001',
					items: []
				}
			}
		]
	])('rejects a catalog lifecycle with a %s', async (_case, override) => {
		const batchId = '00000000-0000-4000-8000-000000000001';
		const lifecycle = {
			batchId,
			status: 'accepted',
			result: null,
			error: null,
			updatedAt: '2026-08-29T16:00:00.000Z',
			...override
		};
		const promise = getParchmentCatalogInventoryBatchStatus(
			{
				inventory: {
					getCatalogBatchStatus: vi.fn().mockResolvedValue({ data: { data: lifecycle } })
				}
			} as never,
			batchId
		);

		await expect(promise).rejects.toMatchObject({
			name: 'ParchmentInventoryError',
			status: 502,
			body: { error: { code: 'invalid_response' } }
		});
	});

	it('preserves catalog batch SDK status and structured error bodies', async () => {
		const body = {
			error: { code: 'catalog_batch_unavailable', message: 'Try again later' }
		};
		const promise = commitParchmentCatalogInventoryBatch(
			{
				inventory: {
					commitCatalogBatch: vi.fn().mockResolvedValue({
						error: body,
						response: new Response(null, { status: 503 })
					})
				}
			} as never,
			'00000000-0000-4000-8000-000000000001'
		);

		await expect(promise).rejects.toMatchObject({
			name: 'ParchmentInventoryError',
			status: 503,
			body
		});
	});
});
