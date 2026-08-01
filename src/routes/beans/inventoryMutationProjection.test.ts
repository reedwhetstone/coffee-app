import { describe, expect, it } from 'vitest';
import type { InventoryWithCatalog } from '$lib/types/component.types';
import { mergeInventoryMutationProjection } from './inventoryMutationProjection';

describe('mergeInventoryMutationProjection', () => {
	it('updates inventory fields while preserving complete catalog and roast enrichment', () => {
		const current = {
			id: 7,
			catalog_id: 101,
			purchased_qty_lbs: 5,
			last_updated: 'old-token',
			ai_tasting_notes: '["Peach"]',
			coffee_catalog: {
				id: 101,
				name: 'Old compact name',
				processing: 'Washed',
				process_data: { method: 'Washed', evidence_available: true },
				purveyor_score: 88,
				ai_tasting_notes: '["Peach"]'
			},
			roast_profiles: [{ roast_id: 9, oz_in: 16 }]
		} as unknown as InventoryWithCatalog;
		const mutation = {
			id: 7,
			catalog_id: 101,
			purchased_qty_lbs: 6,
			stocked: false,
			last_updated: 'new-token',
			ai_tasting_notes: null,
			coffee_catalog: { id: 101, name: 'Current compact name', ai_tasting_notes: null },
			roast_profiles: []
		} as unknown as InventoryWithCatalog;

		expect(mergeInventoryMutationProjection(current, mutation)).toEqual(
			expect.objectContaining({
				purchased_qty_lbs: 6,
				stocked: false,
				last_updated: 'new-token',
				ai_tasting_notes: '["Peach"]',
				coffee_catalog: expect.objectContaining({
					name: 'Old compact name',
					processing: 'Washed',
					process_data: { method: 'Washed', evidence_available: true },
					purveyor_score: 88,
					ai_tasting_notes: '["Peach"]'
				}),
				roast_profiles: [{ roast_id: 9, oz_in: 16 }]
			})
		);
	});

	it('rejects a response for a different inventory resource', () => {
		expect(() =>
			mergeInventoryMutationProjection(
				{ id: 7 } as InventoryWithCatalog,
				{ id: 8 } as InventoryWithCatalog
			)
		).toThrow('Inventory mutation returned a different resource');
	});
});
