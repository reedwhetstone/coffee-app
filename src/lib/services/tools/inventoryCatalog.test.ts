import { describe, expect, it, vi } from 'vitest';
import type { CatalogItem, SearchCatalogInput } from '@purveyors/cli/catalog';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadInventoryActionCatalog } from './inventoryCatalog';

function item(id: number, source: string): CatalogItem {
	return { id, name: `Coffee ${id}`, source, stocked: true } as CatalogItem;
}

describe('loadInventoryActionCatalog', () => {
	it('exhausts catalog pages so later supplier rows are available', async () => {
		const firstPage = Array.from({ length: 500 }, (_, index) => item(index + 1, 'Other'));
		const showroom = [item(501, 'Showroom Coffee'), item(502, 'Showroom Coffee')];
		const search = vi.fn(
			async (_supabase: SupabaseClient, input: SearchCatalogInput): Promise<CatalogItem[]> =>
				input.offset === 500 ? showroom : firstPage
		);

		const result = await loadInventoryActionCatalog({} as SupabaseClient, undefined, search);

		expect(result.items.filter((coffee) => coffee.source === 'Showroom Coffee')).toHaveLength(2);
		expect(result.complete).toBe(true);
		expect(search).toHaveBeenNthCalledWith(
			2,
			expect.anything(),
			expect.objectContaining({ offset: 500, limit: 500, stocked: true })
		);
	});

	it('fetches the recommended catalog row explicitly when it is absent from stocked pages', async () => {
		const search = vi.fn(
			async (_supabase: SupabaseClient, input: SearchCatalogInput): Promise<CatalogItem[]> => {
				if (input.ids) return [item(9001, 'Showroom Coffee')];
				return [item(1, 'Other')];
			}
		);

		const result = await loadInventoryActionCatalog({} as SupabaseClient, 9001, search);

		expect(result.items.map((coffee) => coffee.id)).toEqual([1, 9001]);
		expect(search).toHaveBeenLastCalledWith(
			expect.anything(),
			expect.objectContaining({ ids: [9001] })
		);
	});

	it('deduplicates rows repeated across adjacent pages', async () => {
		const firstPage = Array.from({ length: 500 }, (_, index) => item(index + 1, 'Other'));
		const search = vi.fn(
			async (_supabase: SupabaseClient, input: SearchCatalogInput): Promise<CatalogItem[]> =>
				input.offset === 500 ? [item(500, 'Other'), item(501, 'Showroom Coffee')] : firstPage
		);

		const result = await loadInventoryActionCatalog({} as SupabaseClient, undefined, search);

		expect(result.items.filter((coffee) => coffee.id === 500)).toHaveLength(1);
		expect(result.items).toHaveLength(501);
	});

	it('preserves accumulated options and marks them partial when a later page fails', async () => {
		const firstPage = Array.from({ length: 500 }, (_, index) => item(index + 1, 'Other'));
		const search = vi.fn(async (_supabase: SupabaseClient, input: SearchCatalogInput) => {
			if (input.offset === 500) throw new Error('transient page failure');
			return firstPage;
		});

		const result = await loadInventoryActionCatalog({} as SupabaseClient, undefined, search);

		expect(result.items).toHaveLength(500);
		expect(result.complete).toBe(false);
	});
});
