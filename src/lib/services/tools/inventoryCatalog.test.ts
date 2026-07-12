import { describe, expect, it, vi } from 'vitest';
import { loadInventoryActionCatalog } from './inventoryCatalog';

const item = (id: number) => ({ id, name: `Coffee ${id}`, source: 'Supplier', stocked: true });

describe('loadInventoryActionCatalog SDK mapping', () => {
	it('paginates SDK catalog pages and backfills a requested id', async () => {
		const list = vi.fn(async (query: Record<string, unknown>) => ({
			data: {
				data: query.coffeeIds
					? [item(9001)]
					: query.page === 1
						? Array.from({ length: 500 }, (_, i) => item(i + 1))
						: []
			},
			error: undefined
		}));
		const result = await loadInventoryActionCatalog({ catalog: { list } } as never, 9001);
		expect(result.items).toHaveLength(501);
		expect(list).toHaveBeenCalledWith(
			expect.objectContaining({ stocked: 'true', page: 1, limit: 500 })
		);
		expect(list).toHaveBeenCalledWith(expect.objectContaining({ coffeeIds: '9001' }));
	});

	it('preserves accumulated pages when a later SDK request fails', async () => {
		const list = vi.fn(async (query: Record<string, unknown>) => {
			if (query.page === 2) throw new Error('network');
			return {
				data: { data: Array.from({ length: 500 }, (_, i) => item(i + 1)) },
				error: undefined
			};
		});
		const result = await loadInventoryActionCatalog({ catalog: { list } } as never);
		expect(result.items).toHaveLength(500);
		expect(result.complete).toBe(false);
	});

	it('de-duplicates overlapping pages and marks a repeated full page incomplete', async () => {
		const first = Array.from({ length: 500 }, (_, i) => item(i + 1));
		const list = vi.fn(async () => ({ data: { data: first } }));
		const result = await loadInventoryActionCatalog({ catalog: { list } } as never);
		expect(result.items).toHaveLength(500);
		expect(result.complete).toBe(false);
		expect(list).toHaveBeenCalledTimes(2);
	});

	it('keeps stocked pages but marks the result incomplete when id backfill fails', async () => {
		const list = vi.fn(async (query: Record<string, unknown>) => {
			if (query.coffeeIds) throw new Error('backfill failed');
			return { data: { data: [item(1)] } };
		});
		const result = await loadInventoryActionCatalog({ catalog: { list } } as never, 99);
		expect(result.items.map(({ id }) => id)).toEqual([1]);
		expect(result.complete).toBe(false);
	});
});
