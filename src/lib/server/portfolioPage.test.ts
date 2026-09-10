import { describe, expect, it, vi } from 'vitest';
const legacy = vi.hoisted(() => vi.fn());
vi.mock('./parchmentInventory', () => ({
	fetchParchmentInventoryProjection: legacy,
	projectInventoryResource: (row: unknown) => row
}));
import { fetchPortfolioPage, legacyPortfolioPage, parsePortfolioQuery } from './portfolioPage';
const query = parsePortfolioQuery(new URLSearchParams());
const rows = Array.from({ length: 105 }, (_, id) => ({
	id,
	stocked: true,
	purchased_qty_lbs: 10,
	bean_cost: 50,
	tax_ship_cost: 5,
	coffee_catalog: { name: `Lot ${id}`, source: 'Supplier A', country: 'Ethiopia' },
	roast_profiles: [{ oz_in: 16 }]
}));
describe('bounded Portfolio adapter and deployment compatibility', () => {
	it('does not hydrate catalog or enumerate inventory when the bounded contract is available', async () => {
		legacy.mockClear();
		const page = legacyPortfolioPage(rows, query);
		const list = vi.fn().mockResolvedValue({ data: page });
		const result = await fetchPortfolioPage({ inventory: { list } } as never, query, true);
		expect(result.data).toHaveLength(50);
		expect(result.pagination.total).toBe(105);
		expect(result.portfolio.summary.remainingLbs).toBe(945);
		expect(legacy).not.toHaveBeenCalled();
		expect(list).toHaveBeenCalledWith(
			expect.objectContaining({ portfolio: 'true', limit: 50, offset: 0 })
		);
	});
	it('preserves whole-selection metrics and source groups across pages in old-API compatibility mode', async () => {
		legacy.mockResolvedValue(rows);
		const list = vi.fn().mockResolvedValue({ data: { data: rows.slice(0, 50) } });
		const result = await fetchPortfolioPage(
			{ inventory: { list } } as never,
			{ ...query, offset: 100 },
			true
		);
		expect(result.data).toHaveLength(5);
		expect(result.pagination.total).toBe(105);
		expect(result.portfolio.sources['Supplier A'].count).toBe(105);
		expect(result.portfolio.summary.value).toBe(5775);
		expect(result.portfolio.uniqueValues.countries).toEqual(['Ethiopia']);
	});
	it('falls back only for an absent RPC or older response shape, never authorization/SQL failure', async () => {
		legacy.mockClear();
		legacy.mockResolvedValue(rows);
		const list = vi
			.fn()
			.mockResolvedValueOnce({ error: { error: { code: 'portfolio_query_unavailable' } } })
			.mockResolvedValueOnce({ error: { error: { code: 'forbidden' } } });
		await fetchPortfolioPage({ inventory: { list } } as never, query, true);
		expect(legacy).toHaveBeenCalledTimes(1);
		await expect(
			fetchPortfolioPage({ inventory: { list } } as never, query, true)
		).rejects.toThrow();
		expect(legacy).toHaveBeenCalledTimes(1);
	});
	it('does not mistake a malformed new envelope for an older API', async () => {
		legacy.mockClear();
		const list = vi.fn().mockResolvedValue({ data: { data: [], portfolio: {} } });
		await expect(
			fetchPortfolioPage({ inventory: { list } } as never, query, true)
		).rejects.toThrow();
		expect(legacy).not.toHaveBeenCalled();
	});
});
