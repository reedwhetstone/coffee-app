import { beforeEach, describe, expect, it } from 'vitest';
import {
	_clearMarketToolsCache,
	getCatalogFacets,
	getSupplierList,
	rankCatalog,
	type MarketToolsClient
} from './marketTools';

type Row = Record<string, unknown>;
type Call = [method: string, ...args: unknown[]];

/**
 * Chainable thenable query builder mock. Each from().select() consumes the
 * next page from the queue so pagination can be exercised.
 */
function createMockClient(pages: Row[][], calls: Call[] = []) {
	const queue = [...pages];

	const client: MarketToolsClient = {
		from(table) {
			calls.push(['from', table]);
			return {
				select(columns: string) {
					calls.push(['select', columns]);
					const rows = queue.length > 1 ? queue.shift()! : (queue[0] ?? []);
					const builder = {
						eq(column: string, value: unknown) {
							calls.push(['eq', column, value]);
							return builder;
						},
						gte(column: string, value: unknown) {
							calls.push(['gte', column, value]);
							return builder;
						},
						lte(column: string, value: unknown) {
							calls.push(['lte', column, value]);
							return builder;
						},
						ilike(column: string, pattern: string) {
							calls.push(['ilike', column, pattern]);
							return builder;
						},
						or(filter: string) {
							calls.push(['or', filter]);
							return builder;
						},
						order(column: string) {
							calls.push(['order', column]);
							return builder;
						},
						range(from: number, to: number) {
							calls.push(['range', from, to]);
							return builder;
						},
						limit(count: number) {
							calls.push(['limit', count]);
							return builder;
						},
						then(onFulfilled: (value: { data: Row[]; error: null }) => unknown) {
							return Promise.resolve({ data: rows, error: null }).then(onFulfilled);
						}
					};
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					return builder as any;
				}
			};
		}
	};

	return { client, calls };
}

beforeEach(() => {
	_clearMarketToolsCache();
});

describe('getCatalogFacets', () => {
	it('aggregates value counts sorted by frequency', async () => {
		const { client, calls } = createMockClient([
			[
				{ source: 'Sweet Maria' },
				{ source: 'Bodhi Leaf' },
				{ source: 'Sweet Maria' },
				{ source: '  ' }
			]
		]);

		const result = await getCatalogFacets(client, { field: 'supplier' });

		expect(result.values).toEqual([
			{ value: 'Sweet Maria', count: 2 },
			{ value: 'Bodhi Leaf', count: 1 }
		]);
		expect(result.rows_examined).toBe(4);
		expect(result.total_listings).toBe(4);
		expect(result.distinct_values).toBe(2);
		expect(calls).toContainEqual(['eq', 'stocked', true]);
	});

	it('serves repeat calls from the cache without re-querying', async () => {
		const { client, calls } = createMockClient([[{ country: 'Ethiopia' }]]);

		await getCatalogFacets(client, { field: 'country' });
		const fromCallsAfterFirst = calls.filter(([m]) => m === 'from').length;
		await getCatalogFacets(client, { field: 'country' });

		expect(calls.filter(([m]) => m === 'from').length).toBe(fromCallsAfterFirst);
	});

	it('paginates past the PostgREST page size', async () => {
		const page1: Row[] = Array.from({ length: 1000 }, () => ({ grade: 'AA' }));
		const page2: Row[] = [{ grade: 'AB' }, { grade: 'AA' }];
		const { client } = createMockClient([page1, page2]);

		const result = await getCatalogFacets(client, { field: 'grade' });

		expect(result.rows_examined).toBe(1002);
		expect(result.values[0]).toEqual({ value: 'AA', count: 1001 });
	});
});

describe('getSupplierList', () => {
	const rows: Row[] = [
		{
			source: 'Sweet Maria',
			country: 'Ethiopia',
			wholesale: false,
			price_per_lb: 8,
			score_value: 90,
			purveyor_score: 88
		},
		{
			source: 'Sweet Maria',
			country: 'Colombia',
			wholesale: true,
			price_per_lb: 6,
			score_value: 86,
			purveyor_score: 82
		},
		{
			source: 'Bodhi Leaf',
			country: 'Ethiopia',
			wholesale: false,
			price_per_lb: 7,
			score_value: null,
			purveyor_score: null
		}
	];

	it('aggregates per-supplier signals sorted by listing count', async () => {
		const { client } = createMockClient([rows]);

		const result = await getSupplierList(client, {});

		expect(result.total_suppliers).toBe(2);
		expect(result.suppliers[0]).toEqual(
			expect.objectContaining({
				supplier: 'Sweet Maria',
				listings: 2,
				non_wholesale_listings: 1,
				price_min: 6,
				price_max: 8,
				avg_purveyor_score: 85,
				avg_cup_score: 88,
				top_countries: ['Colombia', 'Ethiopia']
			})
		);
		expect(result.suppliers[0].score.average).toBe(85);
		expect(result.suppliers[1].supplier).toBe('Bodhi Leaf');
		expect(result.suppliers[1].avg_purveyor_score).toBeNull();
	});

	it('passes non_wholesale_only through to the CLI supplier aggregate query', async () => {
		const { client, calls } = createMockClient([rows]);

		await getSupplierList(client, { non_wholesale_only: true });

		expect(calls).toContainEqual(['or', 'wholesale.is.null,wholesale.eq.false']);
	});

	it('passes country through to the CLI supplier aggregate query', async () => {
		const { client, calls } = createMockClient([rows]);

		await getSupplierList(client, { country: 'Ethiopia' });

		expect(calls).toContainEqual(['ilike', 'country', '%Ethiopia%']);
	});

	it('caps the returned supplier count at the requested limit', async () => {
		const many: Row[] = Array.from({ length: 30 }, (_, i) => ({
			source: `Supplier ${i}`,
			country: 'Brazil',
			wholesale: false,
			price_per_lb: 5,
			score_value: 84,
			purveyor_score: 80
		}));
		const { client } = createMockClient([many]);

		const result = await getSupplierList(client, { limit: 100 });

		expect(result.suppliers.length).toBe(25);
		expect(result.total_suppliers).toBe(25);
		expect(result.truncated).toBe(false);
	});
});

describe('rankCatalog', () => {
	const pool: Row[] = [
		{
			id: 1,
			name: 'Ethiopia Hambela',
			country: 'Ethiopia',
			price_per_lb: 8,
			purveyor_score: 92,
			purveyor_score_tier: 'exceptional',
			score_value: 90,
			stocked_date: '2026-06-01',
			wholesale: false
		},
		{
			id: 2,
			name: 'Colombia Huila',
			country: 'Colombia',
			price_per_lb: 5,
			purveyor_score: 80,
			purveyor_score_tier: 'solid',
			score_value: 85,
			stocked_date: '2026-06-08',
			wholesale: false
		},
		{
			id: 3,
			name: 'Brazil Cerrado',
			country: 'Colombia',
			price_per_lb: 4,
			purveyor_score: null,
			score_value: null,
			stocked_date: '2026-05-01',
			wholesale: true
		},
		{
			id: 4,
			name: 'Yemen Haraz',
			country: 'Yemen',
			price_per_lb: 14,
			purveyor_score: 88,
			purveyor_score_tier: 'excellent',
			score_value: 89,
			stocked_date: '2026-04-20',
			wholesale: false
		}
	];

	it('ranks premium by Purveyor Score with nulls last', async () => {
		const { client } = createMockClient([pool]);

		const result = await rankCatalog(client, { objective: 'premium' });

		expect(result.coffees.map((c) => c.id)).toEqual([1, 4, 2, 3]);
		expect(result.coffees[0].rank).toBe(1);
		expect(result.coffees[0].rank_basis).toContain('Purveyor Score 92');
		expect(result.candidates_considered).toBe(4);
		expect(result.caveats.length).toBeGreaterThan(0);
	});

	it('ranks value by score-per-dollar and excludes unscored lots', async () => {
		const { client } = createMockClient([pool]);

		const result = await rankCatalog(client, { objective: 'value' });

		// ratios: id2 80/5=16, id1 92/8=11.5, id4 88/14≈6.3; id3 excluded (no score)
		expect(result.coffees.map((c) => c.id)).toEqual([2, 1, 4]);
		expect(result.caveats.join(' ')).toContain('Purveyor Score per dollar');
	});

	it('ranks fresh_arrival by stocked_date descending', async () => {
		const { client } = createMockClient([pool]);

		const result = await rankCatalog(client, { objective: 'fresh_arrival' });

		expect(result.coffees.map((c) => c.id)).toEqual([2, 1, 3, 4]);
		expect(result.coffees[0].rank_basis).toContain('2026-06-08');
	});

	it('ranks rare_origin by origin scarcity within the pool', async () => {
		const { client } = createMockClient([pool]);

		const result = await rankCatalog(client, { objective: 'rare_origin' });

		// Ethiopia: 1 lot, Yemen: 1 lot, Colombia: 2 lots → singles first, score tiebreak
		expect(result.coffees.map((c) => c.id)).toEqual([1, 4, 2, 3]);
		expect(result.coffees[0].rank_basis).toContain('Ethiopia');
	});

	it('applies non_wholesale_only and limit, and passes filters to the query', async () => {
		const { client, calls } = createMockClient([pool]);

		const result = await rankCatalog(client, {
			objective: 'premium',
			non_wholesale_only: true,
			max_price: 10,
			country: 'Colombia',
			limit: 2
		});

		expect(result.coffees.length).toBe(2);
		expect(result.coffees.every((c) => c.wholesale !== true)).toBe(true);
		expect(calls).toContainEqual(['lte', 'price_per_lb', 10]);
		expect(calls).toContainEqual(['ilike', 'country', '%Colombia%']);
		expect(calls).toContainEqual(['or', 'wholesale.is.null,wholesale.eq.false']);
	});

	it('ignores non-positive numeric filters to preserve chat-tool tolerance', async () => {
		const { client, calls } = createMockClient([pool]);

		await rankCatalog(client, {
			objective: 'premium',
			max_price: 0,
			min_purveyor_score: 0
		});

		expect(calls.some(([method, column]) => method === 'lte' && column === 'price_per_lb')).toBe(
			false
		);
		expect(calls.some(([method, column]) => method === 'gte' && column === 'purveyor_score')).toBe(
			false
		);
	});
});
