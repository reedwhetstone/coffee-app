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
const noRoasts = { list: vi.fn().mockResolvedValue({ data: { data: [] } }) };
describe('bounded Portfolio adapter and deployment compatibility', () => {
	it('does not hydrate catalog or enumerate inventory when the bounded contract is available', async () => {
		legacy.mockClear();
		const page = legacyPortfolioPage(rows, query);
		const list = vi.fn().mockResolvedValue({ data: page });
		const result = await fetchPortfolioPage(
			{ inventory: { list }, roasts: noRoasts } as never,
			query,
			true
		);
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
			{ inventory: { list }, roasts: noRoasts } as never,
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
		await fetchPortfolioPage({ inventory: { list }, roasts: noRoasts } as never, query, true);
		expect(legacy).toHaveBeenCalledTimes(1);
		await expect(
			fetchPortfolioPage({ inventory: { list }, roasts: noRoasts } as never, query, true)
		).rejects.toThrow();
		expect(legacy).toHaveBeenCalledTimes(1);
	});
	it('does not mistake a malformed new envelope for an older API', async () => {
		legacy.mockClear();
		const list = vi.fn().mockResolvedValue({ data: { data: [], portfolio: {} } });
		await expect(
			fetchPortfolioPage({ inventory: { list }, roasts: noRoasts } as never, query, true)
		).rejects.toThrow();
		expect(legacy).not.toHaveBeenCalled();
	});
});

describe('last roast on the portfolio card', () => {
	const page = legacyPortfolioPage(rows.slice(0, 3), query);
	const roastList = (roasts: unknown[]) => ({
		list: vi.fn().mockResolvedValue({ data: { data: roasts } })
	});

	it('joins each coffee to its roast count and newest roast date', async () => {
		const list = vi.fn().mockResolvedValue({ data: page });
		const roasts = roastList([
			{ roast_id: 9, coffee_id: 2, roast_date: '2026-10-01T00:00:00Z' },
			{ roast_id: 8, coffee_id: 2, roast_date: '2026-09-27' },
			{ roast_id: 7, coffee_id: 1, roast_date: null },
			{ roast_id: 6, coffee_id: null, roast_date: '2026-10-02' }
		]);

		const result = await fetchPortfolioPage({ inventory: { list }, roasts } as never, query, true);

		const byId = new Map(result.data.map((row) => [row.id, row]));
		expect(byId.get(2)).toMatchObject({ roast_count: 2, last_roast_date: '2026-10-01' });
		expect(byId.get(1)).toMatchObject({ roast_count: 1, last_roast_date: null });
		expect(byId.get(0)).toMatchObject({ roast_count: 0, last_roast_date: null });
	});

	it('does not read roasts for an account without Mallard Studio', async () => {
		const list = vi.fn().mockResolvedValue({ data: page });
		const roasts = roastList([{ roast_id: 9, coffee_id: 2, roast_date: '2026-10-01' }]);

		const result = await fetchPortfolioPage({ inventory: { list }, roasts } as never, query, false);

		expect(roasts.list).not.toHaveBeenCalled();
		expect(result.data[0]).not.toHaveProperty('roast_count');
	});

	it('still returns the portfolio when the roast read fails', async () => {
		const list = vi.fn().mockResolvedValue({ data: page });
		const roasts = { list: vi.fn().mockRejectedValue(new Error('roasts unavailable')) };
		const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

		const result = await fetchPortfolioPage({ inventory: { list }, roasts } as never, query, true);

		expect(result.data).toHaveLength(3);
		expect(result.data[0]).not.toHaveProperty('roast_count');
		logged.mockRestore();
	});
});

describe('the Remaining sort', () => {
	// Coffee n was bought as 10 lb and has had n lb roasted, so coffee 0 has the most left.
	const stock = Array.from({ length: 130 }, (_, id) => ({
		id,
		stocked: true,
		purchased_qty_lbs: 10,
		bean_cost: 50,
		tax_ship_cost: 5,
		roasted_oz_in: (id % 10) * 16,
		coffee_catalog: { name: `Lot ${id}`, source: 'Supplier A' }
	}));
	const parchment = () =>
		vi.fn(async (request: { offset: number; limit: number }) => ({
			data: {
				data: stock.slice(request.offset, request.offset + request.limit),
				pagination: {
					offset: request.offset,
					limit: request.limit,
					total: stock.length,
					hasNext: request.offset + request.limit < stock.length
				},
				portfolio: { summary: { totalCount: stock.length }, sources: {}, uniqueValues: {} }
			}
		}));
	const remaining = (direction: 'asc' | 'desc', offset = 0) =>
		parsePortfolioQuery(
			new URLSearchParams({
				sort_field: 'remaining',
				sort_direction: direction,
				offset: String(offset)
			})
		);

	it('is accepted as a sort, and never as a filter', () => {
		expect(remaining('desc').sortField).toBe('remaining');
		expect(() =>
			parsePortfolioQuery(new URLSearchParams({ filters: JSON.stringify({ remaining: '5' }) }))
		).toThrow('Invalid portfolio filter');
	});

	it('orders the whole filtered selection, not one page of it', async () => {
		const list = parchment();

		const result = await fetchPortfolioPage(
			{ inventory: { list }, roasts: noRoasts } as never,
			remaining('desc'),
			true
		);

		// Parchment is read to the end in its own order; "remaining" is not sent to it.
		expect(list.mock.calls.map(([request]) => request)).toEqual([
			expect.objectContaining({ sort_field: 'purchase_date', offset: 0, limit: 100 }),
			expect.objectContaining({ sort_field: 'purchase_date', offset: 100, limit: 100 })
		]);
		expect(result.pagination).toEqual({ offset: 0, limit: 50, total: 130, hasNext: true });
		expect(result.portfolio.summary.totalCount).toBe(130);
		// The 13 coffees with nothing roasted come first, including those past Parchment's
		// first page, newest id first.
		expect(result.data.slice(0, 13).map((row) => row.id)).toEqual([
			120, 110, 100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0
		]);
	});

	it('pages through the sorted selection and reverses for least remaining first', async () => {
		const list = parchment();
		const client = { inventory: { list }, roasts: noRoasts } as never;

		const least = await fetchPortfolioPage(client, remaining('asc'), true);
		expect(least.data[0]).toMatchObject({ id: 129, roasted_oz_in: 144 });

		const last = await fetchPortfolioPage(client, remaining('desc', 100), true);
		expect(last.data).toHaveLength(30);
		expect(last.pagination.hasNext).toBe(false);
		expect(last.data.at(-1)).toMatchObject({ id: 9 });
	});

	it('sorts by what is left in old-API compatibility mode too', () => {
		const legacyRows = [
			{ id: 1, stocked: true, purchased_qty_lbs: 5, roast_profiles: [{ oz_in: 16 }] },
			{ id: 2, stocked: true, purchased_qty_lbs: 10, roast_profiles: [{ oz_in: 32 }] },
			{ id: 3, stocked: true, purchased_qty_lbs: 2, roast_profiles: [] }
		];

		expect(legacyPortfolioPage(legacyRows, remaining('desc')).data.map((row) => row.id)).toEqual([
			2, 1, 3
		]);
		expect(legacyPortfolioPage(legacyRows, remaining('asc')).data.map((row) => row.id)).toEqual([
			3, 1, 2
		]);
	});
});
