import { describe, expect, it, vi } from 'vitest';
import { getCatalogFacets, getSupplierList, rankCatalog } from './marketTools';

describe('market tools SDK mapping', () => {
	it.each([
		['supplier', 'sources'],
		['country', 'countries'],
		['processing_base_method', 'processing_base_method'],
		['fermentation_type', 'fermentation_type'],
		['drying_method', 'drying_method'],
		['grade', 'grade'],
		['wholesale', 'wholesale']
	] as const)(
		'maps %s to the SDK %s facet without inventing sample metadata',
		async (field, sdkKey) => {
			const facets = vi.fn().mockResolvedValue({
				data: { facets: { [sdkKey]: [{ value: 'Example', count: 4 }] }, meta: { access: {} } }
			});
			const result = await getCatalogFacets({ catalog: { facets } } as never, { field });
			expect(result).toMatchObject({
				field,
				values: [{ value: 'Example', count: 4 }],
				distinct_values: 1,
				rows_examined: null,
				total_listings: null,
				truncated: null
			});
		}
	);

	it('maps facet queries and propagates SDK errors', async () => {
		const facets = vi.fn().mockResolvedValue({ error: { message: 'denied' } });
		await expect(
			getCatalogFacets({ catalog: { facets } } as never, { field: 'country' })
		).rejects.toThrow('denied');
		expect(facets).toHaveBeenCalledWith({ stocked: 'true' });
	});
	it('requests all caller-visible facets when stocked-only is disabled', async () => {
		const facets = vi.fn().mockResolvedValue({ data: { facets: {}, meta: { access: {} } } });
		await getCatalogFacets({ catalog: { facets } } as never, {
			field: 'country',
			stocked_only: false
		});
		expect(facets).toHaveBeenCalledWith({ stocked: 'all' });
	});
	it('does not share facet results across session-scoped clients', async () => {
		const first = vi.fn().mockResolvedValue({
			data: { facets: { countries: [{ value: 'Kenya', count: 2 }] }, meta: { access: {} } }
		});
		const second = vi.fn().mockResolvedValue({
			data: { facets: { countries: [{ value: 'Rwanda', count: 3 }] }, meta: { access: {} } }
		});
		const firstResult = await getCatalogFacets({ catalog: { facets: first } } as never, {
			field: 'country'
		});
		const secondResult = await getCatalogFacets({ catalog: { facets: second } } as never, {
			field: 'country'
		});
		expect(firstResult.values).toEqual([{ value: 'Kenya', count: 2 }]);
		expect(secondResult.values).toEqual([{ value: 'Rwanda', count: 3 }]);
		expect(first).toHaveBeenCalledOnce();
		expect(second).toHaveBeenCalledOnce();
	});
	it('maps supplier filters', async () => {
		const suppliers = vi.fn().mockResolvedValue({
			data: {
				data: [
					{
						supplier: 'A',
						total: 2,
						price: { min_per_lb: 4, max_per_lb: 8 },
						score: { average: 77 },
						origins: ['Kenya']
					}
				],
				meta: { returned: 1, rows_examined: 8, caveats: ['sampled'], truncated: true }
			}
		});
		const result = await getSupplierList({ catalog: { suppliers } } as never, {
			country: 'Kenya',
			non_wholesale_only: true
		});
		expect(suppliers).toHaveBeenCalledWith(
			expect.objectContaining({ country: 'Kenya', stocked: 'true', nonWholesaleOnly: 'true' })
		);
		expect(result).toMatchObject({
			returned_suppliers: 1,
			rows_examined: 8,
			truncated: true,
			suppliers: [{ listings: 2, price_min: 4, price_max: 8, avg_purveyor_score: 77 }]
		});
	});
	it('maps rank filters', async () => {
		const rank = vi.fn().mockResolvedValue({
			data: {
				data: [{ rank: 1, rank_basis: 'score per dollar' }],
				meta: { objective: 'value', candidates_considered: 9, caveats: ['limited'] }
			}
		});
		const result = await rankCatalog({ catalog: { rank } } as never, {
			objective: 'value',
			max_price: 9,
			limit: 3
		});
		expect(rank).toHaveBeenCalledWith(
			expect.objectContaining({ objective: 'value', priceMax: 9, stockedOnly: 'true', limit: 3 })
		);
		expect(result).toMatchObject({
			objective: 'value',
			candidates_considered: 9,
			caveats: ['limited'],
			coffees: [{ rank: 1 }]
		});
	});
});
