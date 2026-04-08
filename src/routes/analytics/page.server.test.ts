import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/principal', () => ({
	resolvePrincipal: vi.fn()
}));

vi.mock('$lib/seo/meta', () => ({
	buildPublicMeta: vi.fn((value) => value),
	resolvePublicPageSocialImage: vi.fn(() => '/og/analytics.jpg')
}));

vi.mock('$lib/services/schemaService', () => ({
	createSchemaService: vi.fn(() => ({
		generateOrganizationSchema: vi.fn(() => ({ '@type': 'Organization' })),
		generateDatasetSchema: vi.fn(() => ({ '@type': 'Dataset' })),
		generateSchemaGraph: vi.fn(() => ({ '@graph': [] }))
	}))
}));

type SnapshotRow = {
	snapshot_date: string;
	origin: string;
	process: string | null;
	price_avg: number | null;
	price_median: number | null;
	price_min: number | null;
	price_max: number | null;
	price_p25: number | null;
	price_p75: number | null;
	price_stdev: number | null;
	supplier_count: number;
	sample_size: number;
	wholesale_only: boolean;
	aggregation_tier: number;
};

let loadPriceSnapshotsPaginated: typeof import('./+page.server').loadPriceSnapshotsPaginated;

beforeEach(async () => {
	vi.resetModules();
	({ loadPriceSnapshotsPaginated } = await import('./+page.server'));
});

function makeSnapshotRow(index: number): SnapshotRow {
	return {
		snapshot_date: `2026-01-${String((index % 28) + 1).padStart(2, '0')}`,
		origin: `Origin ${String(index).padStart(4, '0')}`,
		process: index % 2 === 0 ? 'Washed' : 'Natural',
		price_avg: 3 + index / 100,
		price_median: 3 + index / 100,
		price_min: 2 + index / 100,
		price_max: 4 + index / 100,
		price_p25: 2.5 + index / 100,
		price_p75: 3.5 + index / 100,
		price_stdev: 0.25,
		supplier_count: 10,
		sample_size: 25,
		wholesale_only: index % 3 === 0,
		aggregation_tier: 1
	};
}

function createSnapshotClient(pages: SnapshotRow[][], fromDate: string) {
	const rangeCalls: Array<{
		start: number;
		end: number;
		orders: Array<{ column: string; ascending: boolean }>;
	}> = [];

	return {
		rangeCalls,
		from(table: string) {
			expect(table).toBe('price_index_snapshots');

			const orders: Array<{ column: string; ascending: boolean }> = [];

			return {
				select(columns: string) {
					expect(columns).toContain('snapshot_date');
					return this;
				},
				gte(column: string, value: string) {
					expect(column).toBe('snapshot_date');
					expect(value).toBe(fromDate);
					return this;
				},
				eq(column: string, value: number) {
					expect(column).toBe('aggregation_tier');
					expect(value).toBe(1);
					return this;
				},
				order(column: string, options: { ascending: boolean }) {
					orders.push({ column, ascending: options.ascending });
					return this;
				},
				range(start: number, end: number) {
					rangeCalls.push({ start, end, orders: [...orders] });
					return Promise.resolve({ data: pages[rangeCalls.length - 1] ?? [] });
				}
			};
		}
	};
}

describe('loadPriceSnapshotsPaginated', () => {
	it('loads all snapshot pages with deterministic ordering and range pagination', async () => {
		const fromDate = '2026-01-01';
		const pages = [
			Array.from({ length: 1000 }, (_, index) => makeSnapshotRow(index)),
			Array.from({ length: 1000 }, (_, index) => makeSnapshotRow(index + 1000)),
			Array.from({ length: 25 }, (_, index) => makeSnapshotRow(index + 2000))
		];
		const client = createSnapshotClient(pages, fromDate);

		const snapshots = await loadPriceSnapshotsPaginated({
			supabase: client,
			fromDate
		});

		expect(snapshots).toHaveLength(2025);
		expect(snapshots[0]).toEqual(pages[0][0]);
		expect(snapshots.at(-1)).toEqual(pages[2][24]);
		expect(client.rangeCalls).toHaveLength(3);
		expect(client.rangeCalls.map(({ start, end }) => ({ start, end }))).toEqual([
			{ start: 0, end: 999 },
			{ start: 1000, end: 1999 },
			{ start: 2000, end: 2999 }
		]);

		for (const call of client.rangeCalls) {
			expect(call.orders).toEqual([
				{ column: 'snapshot_date', ascending: true },
				{ column: 'origin', ascending: true },
				{ column: 'process', ascending: true },
				{ column: 'wholesale_only', ascending: true }
			]);
		}
	});
});
