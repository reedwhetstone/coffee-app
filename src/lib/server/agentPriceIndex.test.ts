import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/supabase-admin', () => ({ createAdminClient: vi.fn() }));

import { _clearAgentPriceIndexCache, readPriceIndexForAgent } from './agentPriceIndex';

type Row = Record<string, unknown>;
type Call = [method: string, ...args: unknown[]];

function createMockClient(rows: Row[], calls: Call[] = []) {
	const client = {
		from(table: 'price_index_snapshots') {
			calls.push(['from', table]);
			return {
				select(columns: string) {
					calls.push(['select', columns]);
					const builder = {
						gte(column: string, value: string) {
							calls.push(['gte', column, value]);
							return builder;
						},
						eq(column: string, value: boolean) {
							calls.push(['eq', column, value]);
							return builder;
						},
						ilike(column: string, pattern: string) {
							calls.push(['ilike', column, pattern]);
							return builder;
						},
						order(column: string, options: { ascending: boolean }) {
							calls.push(['order', column, options]);
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
					return builder;
				}
			};
		}
	};

	return {
		client: client as unknown as Parameters<typeof readPriceIndexForAgent>[1],
		calls
	};
}

beforeEach(() => {
	_clearAgentPriceIndexCache();
});

describe('readPriceIndexForAgent', () => {
	const snapshotRow: Row = {
		snapshot_date: '2026-06-09',
		origin: 'Ethiopia',
		process: 'Natural',
		grade: 'G1',
		wholesale_only: false,
		price_min: '5.50',
		price_max: 12,
		price_avg: '8.25',
		price_median: 8,
		price_p25: 6.75,
		price_p75: 9.5,
		supplier_count: '4',
		sample_size: 23,
		synthetic: false
	};

	it('maps snapshot rows to compact aggregate items', async () => {
		const { client, calls } = createMockClient([snapshotRow]);

		const result = await readPriceIndexForAgent(
			{ origin: 'Ethiopia', process: 'natural', days: 30, wholesale: false },
			client
		);

		expect(result.snapshots).toEqual([
			{
				date: '2026-06-09',
				origin: 'Ethiopia',
				process: 'Natural',
				grade: 'G1',
				wholesale: false,
				price: { min: 5.5, p25: 6.75, median: 8, avg: 8.25, p75: 9.5, max: 12 },
				suppliers: 4,
				listings: 23,
				synthetic: false
			}
		]);
		expect(result.window_days).toBe(30);
		expect(result.source).toEqual({ table: 'price_index_snapshots', aggregate_only: true });
		expect(calls).toContainEqual(['ilike', 'origin', '%Ethiopia%']);
		expect(calls).toContainEqual(['ilike', 'process', '%natural%']);
		expect(calls).toContainEqual(['eq', 'wholesale_only', false]);
		expect(calls).toContainEqual(['order', 'snapshot_date', { ascending: false }]);
	});

	it('clamps the lookback window and limit', async () => {
		const { client, calls } = createMockClient([]);

		const result = await readPriceIndexForAgent({ days: 9999, limit: 500 }, client);

		expect(result.window_days).toBe(365);
		expect(calls).toContainEqual(['limit', 60]);
	});

	it('serves repeat calls from the cache without re-querying', async () => {
		const { client, calls } = createMockClient([snapshotRow]);

		await readPriceIndexForAgent({ origin: 'Ethiopia' }, client);
		const fromCallsAfterFirst = calls.filter(([m]) => m === 'from').length;
		await readPriceIndexForAgent({ origin: 'Ethiopia' }, client);

		expect(calls.filter(([m]) => m === 'from').length).toBe(fromCallsAfterFirst);
	});
});
