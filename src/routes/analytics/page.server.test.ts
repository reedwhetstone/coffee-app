import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

type SnapshotPageResult = {
	data: SnapshotRow[] | null;
	error: { message: string } | null;
};

type SnapshotQueryCall = {
	start: number;
	end: number;
	orders: Array<{ column: string; ascending: boolean }>;
};

let load: typeof import('./+page.server').load;
let loadPriceSnapshotsPaginated: typeof import('./+page.server')._loadPriceSnapshotsPaginated;
let resolvePrincipalMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-04-08T12:00:00.000Z'));

	({ load, _loadPriceSnapshotsPaginated: loadPriceSnapshotsPaginated } = await import(
		'./+page.server'
	));

	const principalModule = await import('$lib/server/principal');
	resolvePrincipalMock = vi.mocked(principalModule.resolvePrincipal);
	resolvePrincipalMock.mockResolvedValue({
		isAuthenticated: false,
		ppiAccess: false
	});
});

afterEach(() => {
	vi.useRealTimers();
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

function createSnapshotClient(
	pageResults: Array<SnapshotRow[] | SnapshotPageResult>,
	fromDate: string
) {
	const rangeCalls: SnapshotQueryCall[] = [];

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
					const page = pageResults[rangeCalls.length - 1] ?? [];
					if (Array.isArray(page)) {
						return Promise.resolve({ data: page, error: null });
					}
					return Promise.resolve(page);
				}
			};
		}
	};
}

function createAnalyticsClient(snapshotPages: SnapshotPageResult[]) {
	const snapshotFromDates: string[] = [];
	const snapshotRangeCalls: SnapshotQueryCall[] = [];

	function resolveTableResult(
		table: string,
		state: {
			columns?: string;
			selectOptions?: { count?: string; head?: boolean };
			filters: Array<{ method: string; column: string; value: unknown }>;
		}
	) {
		if (table === 'market_daily_summary') {
			return {
				data: {
					snapshot_date: '2026-04-08',
					total_stocked: 120,
					total_suppliers: 39,
					total_origins: 18,
					retail_median: 4.2,
					retail_median_7d_change: null,
					retail_median_30d_change: null,
					supply_7d_change: null,
					supply_30d_change: null
				},
				error: null
			};
		}

		if (table === 'supplier_daily_stats') {
			return { data: [], error: null };
		}

		if (table !== 'coffee_catalog') {
			throw new Error(`Unexpected table in analytics test client: ${table}`);
		}

		if (state.selectOptions?.head) {
			const stocked = state.filters.find(
				(filter) => filter.method === 'eq' && filter.column === 'stocked'
			)?.value;
			const wholesale = state.filters.find(
				(filter) => filter.method === 'eq' && filter.column === 'wholesale'
			)?.value;

			if (stocked === true && wholesale === false) return { count: 42, error: null };
			if (stocked === true && wholesale === true) return { count: 11, error: null };
			return { count: 150, error: null };
		}

		if (state.columns === 'processing, wholesale') return { data: [], error: null };
		if (state.columns === 'country, price_per_lb') return { data: [], error: null };
		if (state.columns?.includes('stocked_date')) return { data: [], error: null };
		if (state.columns?.includes('unstocked_date')) return { data: [], error: null };
		if (state.columns?.includes('bag_size')) return { data: [], error: null };

		throw new Error(`Unhandled coffee_catalog select in analytics test client: ${state.columns}`);
	}

	return {
		snapshotFromDates,
		snapshotRangeCalls,
		from(table: string) {
			const state: {
				columns?: string;
				selectOptions?: { count?: string; head?: boolean };
				filters: Array<{ method: string; column: string; value: unknown }>;
				orders: Array<{ column: string; ascending: boolean }>;
			} = {
				filters: [],
				orders: []
			};

			const query = {
				select(columns: string, selectOptions?: { count?: string; head?: boolean }) {
					state.columns = columns;
					state.selectOptions = selectOptions;
					return query;
				},
				gte(column: string, value: unknown) {
					state.filters.push({ method: 'gte', column, value });
					if (table === 'price_index_snapshots' && column === 'snapshot_date') {
						snapshotFromDates.push(String(value));
					}
					return query;
				},
				eq(column: string, value: unknown) {
					state.filters.push({ method: 'eq', column, value });
					return query;
				},
				not(column: string, value: unknown, extra: unknown) {
					state.filters.push({ method: 'not', column, value: [value, extra] });
					return query;
				},
				gt(column: string, value: unknown) {
					state.filters.push({ method: 'gt', column, value });
					return query;
				},
				lte(column: string, value: unknown) {
					state.filters.push({ method: 'lte', column, value });
					return query;
				},
				order(column: string, options: { ascending: boolean }) {
					state.orders.push({ column, ascending: options.ascending });
					return query;
				},
				limit() {
					return query;
				},
				maybeSingle() {
					return Promise.resolve(resolveTableResult(table, state));
				},
				range(start: number, end: number) {
					if (table !== 'price_index_snapshots') {
						throw new Error(`Unexpected range() on ${table}`);
					}

					snapshotRangeCalls.push({ start, end, orders: [...state.orders] });
					return Promise.resolve(
						snapshotPages[snapshotRangeCalls.length - 1] ?? { data: [], error: null }
					);
				},
				then<TResult1 = unknown, TResult2 = never>(
					onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
					onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
				) {
					return Promise.resolve(resolveTableResult(table, state)).then(onfulfilled, onrejected);
				}
			};

			return query;
		}
	};
}

function createLoadEvent(client: ReturnType<typeof createAnalyticsClient>) {
	return {
		url: new URL('https://example.com/analytics'),
		locals: {
			supabase: client,
			session: null,
			role: 'viewer'
		}
	} as never;
}

describe('loadPriceSnapshotsPaginated', () => {
	it('loads all snapshot pages with a total ordering that survives schema ties', async () => {
		const fromDate = '2026-01-01';
		const client = createSnapshotClient(
			[
				Array.from({ length: 1000 }, (_, index) => makeSnapshotRow(index)),
				Array.from({ length: 1000 }, (_, index) => makeSnapshotRow(index + 1000)),
				Array.from({ length: 25 }, (_, index) => makeSnapshotRow(index + 2000))
			],
			fromDate
		);

		const snapshots = await loadPriceSnapshotsPaginated({
			supabase: client,
			fromDate
		});

		expect(snapshots).toHaveLength(2025);
		expect(snapshots[0]).toEqual(makeSnapshotRow(0));
		expect(snapshots.at(-1)).toEqual(makeSnapshotRow(2024));
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
				{ column: 'grade', ascending: true },
				{ column: 'wholesale_only', ascending: true },
				{ column: 'synthetic', ascending: true },
				{ column: 'id', ascending: true }
			]);
		}
	});

	it('throws when an intermediate snapshot page fails instead of returning partial data', async () => {
		const fromDate = '2026-01-01';
		const client = createSnapshotClient(
			[
				Array.from({ length: 1000 }, (_, index) => makeSnapshotRow(index)),
				{ data: null, error: { message: 'db blew up' } }
			],
			fromDate
		);

		await expect(
			loadPriceSnapshotsPaginated({
				supabase: client,
				fromDate
			})
		).rejects.toThrow('Failed to load analytics price snapshots page 2: db blew up');
	});
});

describe('analytics load', () => {
	it('preserves the 90-day public window and 365-day PPI member window', async () => {
		const anonymousClient = createAnalyticsClient([{ data: [], error: null }]);
		resolvePrincipalMock.mockResolvedValueOnce({
			isAuthenticated: false,
			ppiAccess: false
		});

		await load(createLoadEvent(anonymousClient));
		expect(anonymousClient.snapshotFromDates).toEqual(['2026-01-08']);

		const memberClient = createAnalyticsClient([{ data: [], error: null }]);
		resolvePrincipalMock.mockResolvedValueOnce({
			isAuthenticated: true,
			ppiAccess: true
		});

		await load(createLoadEvent(memberClient));
		expect(memberClient.snapshotFromDates).toEqual(['2025-04-08']);
	});

	it('fails the route load when a later snapshot page errors', async () => {
		const client = createAnalyticsClient([
			{ data: Array.from({ length: 1000 }, (_, index) => makeSnapshotRow(index)), error: null },
			{ data: null, error: { message: 'page timeout' } }
		]);

		await expect(load(createLoadEvent(client))).rejects.toThrow(
			'Failed to load analytics price snapshots page 2: page timeout'
		);
	});
});
