import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
	AnalyticsCharts,
	AnalyticsCoverage,
	AnalyticsMemberData,
	AnalyticsPreview
} from './+page.server';

const { mockCreateAdminClient } = vi.hoisted(() => ({
	mockCreateAdminClient: vi.fn()
}));

vi.mock('$lib/server/principal', () => ({
	resolvePrincipal: vi.fn()
}));

vi.mock('$lib/seo/meta', () => ({
	buildPublicMeta: vi.fn((value) => value),
	resolvePublicPageSocialImage: vi.fn(() => '/og/analytics.jpg')
}));

vi.mock('$lib/supabase-admin', () => ({
	createAdminClient: mockCreateAdminClient
}));

vi.mock('$lib/services/schemaService', () => ({
	createSchemaService: vi.fn(() => ({
		generateOrganizationSchema: vi.fn(() => ({ '@type': 'Organization' })),
		generateDatasetSchema: vi.fn((dataset) => ({
			'@type': 'Dataset',
			...Object.fromEntries(
				Object.entries(dataset as Record<string, unknown>).filter(
					([, value]) => value !== undefined
				)
			)
		})),
		generateSchemaGraph: vi.fn((schemas) => ({ '@graph': schemas }))
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

interface StreamedLoadResult {
	analyticsPreview: AnalyticsPreview;
	analyticsCoverage: Promise<AnalyticsCoverage>;
	analyticsCharts: Promise<AnalyticsCharts>;
	analyticsMember: Promise<AnalyticsMemberData>;
	meta: Record<string, unknown>;
}

let load: typeof import('./+page.server').load;
let loadPriceSnapshotsPaginated: typeof import('./+page.server')._loadPriceSnapshotsPaginated;
let resolvePrincipalMock: ReturnType<typeof vi.fn>;
let currentPriceIndexClient: unknown;

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-04-08T12:00:00.000Z'));
	currentPriceIndexClient = undefined;
	mockCreateAdminClient.mockImplementation(() => currentPriceIndexClient);

	({ load, _loadPriceSnapshotsPaginated: loadPriceSnapshotsPaginated } = await import(
		'./+page.server'
	));

	const principalModule = await import('$lib/server/principal');
	resolvePrincipalMock = vi.mocked(principalModule.resolvePrincipal);
	resolvePrincipalMock.mockResolvedValue({
		isAuthenticated: false,
		ppiAccess: false,
		role: 'viewer'
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

function createAnalyticsClient(
	snapshotPages: SnapshotPageResult[],
	options: {
		marketSummaryDate?: string | null;
		catalogPriceRows?: Array<{ country: string; price_per_lb: number; wholesale: boolean }>;
		supplierPriceRanges?: Array<{
			source: string | null;
			market: 'retail' | 'wholesale' | 'all';
			lot_count: number;
			price_min: number;
			price_median: number;
			price_max: number;
		}>;
		originCoverageRows?: Array<{
			country: string | null;
			source?: string | null;
			wholesale: boolean;
		}>;
		movementCountError?: boolean;
		hangCoverageQueries?: boolean;
		recentRetailArrivals?: unknown[];
		recentWholesaleArrivals?: unknown[];
		recentRetailDelistings?: unknown[];
		recentWholesaleDelistings?: unknown[];
	} = {}
) {
	const snapshotFromDates: string[] = [];
	const snapshotRangeCalls: SnapshotQueryCall[] = [];
	const movementCutoffs = { arrivals: [] as string[], delistings: [] as string[] };
	const selectCalls: string[] = [];
	const summaryReadCounts = { marketSummary: 0 };

	function resolveTableResult(
		table: string,
		state: {
			columns?: string;
			selectOptions?: { count?: string; head?: boolean };
			filters: Array<{ method: string; column: string; value: unknown }>;
		}
	) {
		if (table === 'market_daily_summary') {
			summaryReadCounts.marketSummary += 1;

			if (options.marketSummaryDate === null) {
				return { data: null, error: null };
			}

			return {
				data: {
					snapshot_date: options.marketSummaryDate ?? '2026-04-08',
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
			const stockedDate = state.filters.find(
				(filter) => filter.method === 'gte' && filter.column === 'stocked_date'
			)?.value;
			const unstockedDate = state.filters.find(
				(filter) => filter.method === 'gte' && filter.column === 'unstocked_date'
			)?.value;

			if (options.movementCountError && (stockedDate || unstockedDate)) {
				return { count: null, error: { message: 'movement count failed' } };
			}

			const summaryDate = options.marketSummaryDate ?? '2026-04-08';
			const dateBefore = (days: number) => {
				const reference = new Date(`${summaryDate}T00:00:00.000Z`);
				reference.setUTCDate(reference.getUTCDate() - days);
				return reference.toISOString().split('T')[0];
			};
			const sevenDayCutoff = dateBefore(7);
			const thirtyDayCutoff = dateBefore(30);

			if (stockedDate) {
				if (stockedDate !== sevenDayCutoff && stockedDate !== thirtyDayCutoff) {
					throw new Error(`Unexpected stocked movement cutoff: ${stockedDate}`);
				}
				return {
					count: wholesale
						? stockedDate === sevenDayCutoff
							? 2
							: 7
						: stockedDate === sevenDayCutoff
							? 5
							: 14,
					error: null
				};
			}
			if (unstockedDate) {
				if (unstockedDate !== sevenDayCutoff && unstockedDate !== thirtyDayCutoff) {
					throw new Error(`Unexpected unstocked movement cutoff: ${unstockedDate}`);
				}
				return {
					count: wholesale
						? unstockedDate === sevenDayCutoff
							? 1
							: 4
						: unstockedDate === sevenDayCutoff
							? 3
							: 10,
					error: null
				};
			}

			if (stocked === true && wholesale === false) return { count: 42, error: null };
			if (stocked === true && wholesale === true) return { count: 11, error: null };
			return { count: 150, error: null };
		}

		if (state.columns === 'processing, wholesale') return { data: [], error: null };
		if (state.columns === 'country, price_per_lb, wholesale') {
			const wholesale = state.filters.find(
				(filter) => filter.method === 'eq' && filter.column === 'wholesale'
			)?.value;
			return {
				data: (options.catalogPriceRows ?? []).filter((row) => row.wholesale === wholesale),
				error: null
			};
		}
		if (state.columns?.includes('unstocked_date')) {
			const cutoff = state.filters.find(
				(filter) => filter.method === 'gte' && filter.column === 'unstocked_date'
			)?.value;
			if (cutoff) movementCutoffs.delistings.push(String(cutoff));
			const wholesale = state.filters.find(
				(filter) => filter.method === 'eq' && filter.column === 'wholesale'
			)?.value;
			return {
				data: wholesale
					? (options.recentWholesaleDelistings ?? [])
					: (options.recentRetailDelistings ?? []),
				error: null
			};
		}
		if (state.columns?.includes('stocked_date')) {
			const cutoff = state.filters.find(
				(filter) => filter.method === 'gte' && filter.column === 'stocked_date'
			)?.value;
			if (cutoff) movementCutoffs.arrivals.push(String(cutoff));
			const wholesale = state.filters.find(
				(filter) => filter.method === 'eq' && filter.column === 'wholesale'
			)?.value;
			return {
				data: wholesale
					? (options.recentWholesaleArrivals ?? [])
					: (options.recentRetailArrivals ?? []),
				error: null
			};
		}
		if (state.columns?.includes('bag_size')) return { data: [], error: null };

		throw new Error(`Unhandled coffee_catalog select in analytics test client: ${state.columns}`);
	}

	return {
		snapshotFromDates,
		snapshotRangeCalls,
		movementCutoffs,
		selectCalls,
		summaryReadCounts,
		rpc(name: string) {
			if (name === 'get_supplier_price_ranges') {
				return Promise.resolve({ data: options.supplierPriceRanges ?? [], error: null });
			}
			throw new Error(`Unexpected RPC in analytics test client: ${name}`);
		},
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
					selectCalls.push(`${table}:${columns}${selectOptions?.head ? ':head' : ''}`);
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
					if (table === 'coffee_catalog' && state.columns === 'country, source, wholesale') {
						if (options.hangCoverageQueries) {
							return new Promise(() => {});
						}
						const wholesale = state.filters.find(
							(filter) => filter.method === 'eq' && filter.column === 'wholesale'
						)?.value;
						return Promise.resolve({
							data: (options.originCoverageRows ?? [])
								.filter((row) => row.wholesale === wholesale)
								.slice(start, end + 1),
							error: null
						});
					}

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
					if (
						table === 'coffee_catalog' &&
						state.selectOptions?.head &&
						options.hangCoverageQueries
					) {
						return new Promise(() => {}).then(onfulfilled, onrejected);
					}
					return Promise.resolve(resolveTableResult(table, state)).then(onfulfilled, onrejected);
				}
			};

			return query;
		}
	};
}

function createLoadEvent(
	client: ReturnType<typeof createAnalyticsClient>,
	locals: { session?: unknown; role?: string } = {}
) {
	return {
		url: new URL('https://example.com/analytics'),
		locals: {
			supabase: client,
			session: locals.session ?? null,
			role: locals.role ?? 'viewer'
		}
	} as never;
}

function createSession() {
	return { user: { id: 'user-1', email: 'user@example.com' } };
}

async function runLoad(
	client: ReturnType<typeof createAnalyticsClient>,
	locals: { session?: unknown; role?: string } = {}
): Promise<StreamedLoadResult> {
	return (await load(createLoadEvent(client, locals))) as unknown as StreamedLoadResult;
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
	it('uses Parchment Market Index naming in public route metadata', async () => {
		const client = createAnalyticsClient([{ data: [], error: null }]);
		currentPriceIndexClient = client;

		const result = await runLoad(client);

		expect(result.meta.title).toBe('Green Coffee Market Visibility | Parchment Market Index');
		expect(result.meta.ogTitle).toBe('Green Coffee Market Visibility — Parchment Market Index');
		expect(result.meta.twitterTitle).toBe(
			'Green Coffee Market Visibility — Parchment Market Index'
		);
		expect(result.meta.schemaData).toMatchObject({
			'@graph': expect.arrayContaining([
				expect.objectContaining({
					'@type': 'Dataset',
					dateModified: '2026-04-08'
				})
			])
		});
		expect(JSON.stringify(result.meta)).not.toContain('Purveyors');
		await Promise.all([result.analyticsCoverage, result.analyticsCharts, result.analyticsMember]);
	});

	it('omits Dataset dateModified when no market summary freshness date exists', async () => {
		const client = createAnalyticsClient([{ data: [], error: null }], {
			marketSummaryDate: null
		});
		currentPriceIndexClient = client;

		const result = await runLoad(client);
		const schemaData = result.meta.schemaData as { '@graph': Array<Record<string, unknown>> };
		const dataset = schemaData['@graph'].find((entry) => entry['@type'] === 'Dataset');

		expect(dataset).toBeTruthy();
		expect(dataset).not.toHaveProperty('dateModified');
		await Promise.all([result.analyticsCoverage, result.analyticsCharts, result.analyticsMember]);
	});

	it('builds the SSR preview from the market summary alone and streams the rest', async () => {
		const client = createAnalyticsClient([{ data: [], error: null }], {
			hangCoverageQueries: true
		});
		currentPriceIndexClient = client;

		// Coverage counts, coverage pagination, and movement queries all hang; the
		// route load must still resolve because only market_daily_summary blocks
		// the first response.
		const result = await runLoad(client);

		expect(client.summaryReadCounts.marketSummary).toBe(1);
		expect(result.analyticsPreview.stats).toMatchObject({
			totalSuppliers: 39,
			originsCount: 18,
			stockedOrigins: 18,
			stockedSuppliers: 39,
			lastUpdated: '2026-04-08'
		});
		// Preview never claims scoped coverage it has not measured.
		expect(result.analyticsPreview.stats.stockedRetailBeans).toBe(0);
		expect(result.analyticsPreview.stats.totalBeansTracked).toBe(0);
		await result.analyticsCharts;
		await result.analyticsMember;
	});

	it('streams exact counts, coverage breadth, and movement velocity in the coverage payload', async () => {
		const client = createAnalyticsClient([{ data: [], error: null }], {
			originCoverageRows: [
				{ country: 'Colombia', source: 'Atlas', wholesale: false },
				{ country: 'Colombia', source: 'Atlas', wholesale: false },
				{ country: 'Ethiopia', source: 'Cafe Imports', wholesale: false },
				{ country: 'Brazil', source: 'Royal', wholesale: true },
				{ country: 'Colombia', source: 'Royal', wholesale: true },
				{ country: null, source: 'Wholesale Only Supplier', wholesale: true }
			]
		});
		currentPriceIndexClient = client;

		const result = await runLoad(client);
		const coverage = await result.analyticsCoverage;

		expect(coverage.stats.originsCount).toBe(18);
		expect(coverage.stats.totalSuppliers).toBe(39);
		expect(coverage.stats.totalBeansTracked).toBe(150);
		expect(coverage.stats.stockedRetailBeans).toBe(42);
		expect(coverage.stats.stockedWholesaleBeans).toBe(11);
		expect(coverage.stats.stockedRetailOrigins).toBe(2);
		expect(coverage.stats.stockedWholesaleOrigins).toBe(2);
		expect(coverage.stats.stockedOrigins).toBe(3);
		expect(coverage.stats.stockedRetailSuppliers).toBe(2);
		expect(coverage.stats.stockedWholesaleSuppliers).toBe(2);
		expect(coverage.stats.stockedSuppliers).toBe(4);
		expect(coverage.movementCounts).toEqual({
			available: true,
			arrivals: { sevenDay: { retail: 5, wholesale: 2 }, thirtyDay: { retail: 14, wholesale: 7 } },
			delistings: { sevenDay: { retail: 3, wholesale: 1 }, thirtyDay: { retail: 10, wholesale: 4 } }
		});
	});

	it('marks movement counts unavailable when scoped count queries fail', async () => {
		const client = createAnalyticsClient([{ data: [], error: null }], {
			movementCountError: true
		});
		currentPriceIndexClient = client;

		const result = await runLoad(client);
		const coverage = await result.analyticsCoverage;

		expect(coverage.movementCounts.available).toBe(false);
		expect(coverage.movementCounts.arrivals.sevenDay.retail).toBe(0);
		expect(coverage.movementCounts.delistings.thirtyDay.wholesale).toBe(0);
	});

	it('does not serialize named movement rows to non-Intelligence visitors', async () => {
		const client = createAnalyticsClient([{ data: [], error: null }], {
			recentRetailArrivals: [
				{
					name: 'Public should not get this lot',
					country: 'Colombia',
					processing: 'Washed',
					price_per_lb: 4.25,
					source: 'Atlas',
					stocked_date: '2026-04-07',
					wholesale: false
				}
			],
			recentWholesaleArrivals: [
				{
					name: 'Wholesale classification should not leak',
					country: 'Brazil',
					processing: 'Natural',
					price_per_lb: 3.5,
					source: 'Royal',
					stocked_date: '2026-04-07',
					wholesale: true
				}
			]
		});
		currentPriceIndexClient = client;

		const result = await runLoad(client);
		const member = await result.analyticsMember;

		expect(member.recentArrivals).toEqual([]);
		expect(member.recentDelistings).toEqual([]);
	});

	it('skips catalog evidence and gated member queries entirely for anonymous visitors', async () => {
		const client = createAnalyticsClient([{ data: [], error: null }]);
		currentPriceIndexClient = client;

		const result = await runLoad(client);
		await Promise.all([result.analyticsCoverage, result.analyticsCharts, result.analyticsMember]);

		const catalogSelects = client.selectCalls.filter((call) => call.startsWith('coffee_catalog:'));
		expect(catalogSelects.filter((call) => call.includes('processing, wholesale'))).toHaveLength(0);
		expect(
			catalogSelects.filter((call) => call.includes('country, price_per_lb, wholesale'))
		).toHaveLength(0);
		expect(catalogSelects.filter((call) => call.includes('bag_size'))).toHaveLength(0);
		expect(
			client.selectCalls.filter((call) => call.startsWith('supplier_daily_stats:'))
		).toHaveLength(0);
		// Named movement-row selects (non-head stocked_date/unstocked_date reads) never run.
		expect(client.movementCutoffs).toEqual({ arrivals: [], delistings: [] });
	});

	it('keeps named movement rows available for Parchment Intelligence users', async () => {
		const client = createAnalyticsClient([{ data: [], error: null }], {
			recentWholesaleArrivals: [
				{
					name: 'Wholesale member lot',
					country: 'Brazil',
					processing: 'Natural',
					price_per_lb: 3.5,
					source: 'Royal',
					stocked_date: '2026-04-07',
					wholesale: true
				}
			]
		});
		currentPriceIndexClient = client;
		resolvePrincipalMock.mockResolvedValueOnce({
			isAuthenticated: true,
			ppiAccess: true,
			role: 'viewer'
		});

		const result = await runLoad(client, { session: createSession() });
		const member = await result.analyticsMember;

		expect(member.recentArrivals).toHaveLength(1);
		expect(member.recentArrivals[0]).toMatchObject({
			name: 'Wholesale member lot',
			wholesale: true
		});
	});

	it('preserves the 90-day baseline window and 365-day Parchment Intelligence window', async () => {
		const anonymousClient = createAnalyticsClient([{ data: [], error: null }]);
		currentPriceIndexClient = anonymousClient;
		resolvePrincipalMock.mockResolvedValueOnce({
			isAuthenticated: false,
			ppiAccess: false,
			role: 'viewer'
		});

		const anonymousResult = await runLoad(anonymousClient);
		await anonymousResult.analyticsCharts;
		expect(anonymousClient.snapshotFromDates).toEqual(['2026-01-08']);

		const memberClient = createAnalyticsClient([{ data: [], error: null }]);
		currentPriceIndexClient = memberClient;
		resolvePrincipalMock.mockResolvedValueOnce({
			isAuthenticated: true,
			ppiAccess: true,
			role: 'viewer'
		});

		const memberResult = await runLoad(memberClient, { session: createSession() });
		await memberResult.analyticsCharts;
		await memberResult.analyticsMember;
		expect(memberClient.snapshotFromDates).toEqual(['2025-04-08']);
	});

	it('anchors arrival and delisting query cutoffs to the latest market summary date', async () => {
		const client = createAnalyticsClient([{ data: [], error: null }], {
			marketSummaryDate: '2026-03-31'
		});
		currentPriceIndexClient = client;
		resolvePrincipalMock.mockResolvedValueOnce({
			isAuthenticated: true,
			ppiAccess: true,
			role: 'viewer'
		});

		const result = await runLoad(client, { session: createSession() });
		await result.analyticsMember;

		expect(client.movementCutoffs).toEqual({
			arrivals: ['2026-03-01', '2026-03-01'],
			delistings: ['2026-03-01', '2026-03-01']
		});
	});

	it('returns origin price ranges for all, retail, and wholesale scopes', async () => {
		const client = createAnalyticsClient([{ data: [], error: null }], {
			catalogPriceRows: [
				{ country: 'Colombia', price_per_lb: 4, wholesale: false },
				{ country: 'Colombia', price_per_lb: 5, wholesale: false },
				{ country: 'Colombia', price_per_lb: 6, wholesale: false },
				{ country: 'Colombia', price_per_lb: 2, wholesale: true },
				{ country: 'Colombia', price_per_lb: 3, wholesale: true },
				{ country: 'Colombia', price_per_lb: 4, wholesale: true }
			]
		});
		currentPriceIndexClient = client;

		const result = await runLoad(client, { session: createSession() });
		const charts = await result.analyticsCharts;
		const colombiaRanges = charts.originRangeData.filter((row) => row.origin === 'Colombia');

		expect(colombiaRanges.map((row) => row.market_scope).sort()).toEqual([
			'all',
			'retail',
			'wholesale'
		]);
		expect(colombiaRanges.find((row) => row.market_scope === 'retail')).toMatchObject({
			price_min: 4,
			price_max: 6,
			sample_size: 3
		});
		expect(colombiaRanges.find((row) => row.market_scope === 'wholesale')).toMatchObject({
			price_min: 2,
			price_max: 4,
			sample_size: 3
		});
		expect(colombiaRanges.find((row) => row.market_scope === 'all')).toMatchObject({
			price_min: 2,
			price_max: 6,
			sample_size: 6
		});
	});

	it('loads supplier price ranges from the full-set aggregate instead of capped comparison rows', async () => {
		const client = createAnalyticsClient([{ data: [], error: null }], {
			supplierPriceRanges: [
				{
					source: 'Atlas',
					market: 'retail',
					lot_count: 3000,
					price_min: 4,
					price_median: 6.5,
					price_max: 14
				},
				{
					source: 'Royal',
					market: 'wholesale',
					lot_count: 600,
					price_min: 2,
					price_median: 3.25,
					price_max: 6
				},
				{
					source: 'Atlas',
					market: 'all',
					lot_count: 3200,
					price_min: 4,
					price_median: 6.75,
					price_max: 14
				}
			]
		});
		currentPriceIndexClient = client;
		resolvePrincipalMock.mockResolvedValueOnce({
			isAuthenticated: true,
			ppiAccess: true,
			role: 'viewer'
		});

		const result = await runLoad(client, { session: createSession() });
		const member = await result.analyticsMember;

		expect(member.comparisonBeans).toEqual([]);
		expect(member.supplierPriceRanges).toEqual([
			{
				source: 'Atlas',
				market: 'retail',
				count: 3000,
				min: 4,
				median: 6.5,
				max: 14
			},
			{
				source: 'Royal',
				market: 'wholesale',
				count: 600,
				min: 2,
				median: 3.25,
				max: 6
			},
			{
				source: 'Atlas',
				market: 'all',
				count: 3200,
				min: 4,
				median: 6.75,
				max: 14
			}
		]);
	});

	it('paginates active coverage rows before computing scoped origin and supplier totals', async () => {
		const retailCoverageRows = Array.from({ length: 1001 }, (_, index) => ({
			country: `Origin ${index}`,
			source: `Supplier ${index}`,
			wholesale: false
		}));
		const client = createAnalyticsClient([{ data: [], error: null }], {
			originCoverageRows: retailCoverageRows
		});
		currentPriceIndexClient = client;

		const result = await runLoad(client);
		const coverage = await result.analyticsCoverage;

		expect(coverage.stats.stockedRetailOrigins).toBe(1001);
		expect(coverage.stats.stockedRetailSuppliers).toBe(1001);
	});

	it('keeps date-only movement cutoffs stable in east-of-UTC server timezones', async () => {
		const originalTimeZone = process.env.TZ;
		process.env.TZ = 'Asia/Tokyo';

		try {
			const client = createAnalyticsClient([{ data: [], error: null }], {
				marketSummaryDate: '2026-03-31'
			});
			currentPriceIndexClient = client;
			resolvePrincipalMock.mockResolvedValueOnce({
				isAuthenticated: true,
				ppiAccess: true,
				role: 'viewer'
			});

			const result = await runLoad(client, { session: createSession() });
			await result.analyticsMember;

			expect(client.movementCutoffs).toEqual({
				arrivals: ['2026-03-01', '2026-03-01'],
				delistings: ['2026-03-01', '2026-03-01']
			});
		} finally {
			process.env.TZ = originalTimeZone;
		}
	});

	it('rejects the streamed charts payload when a later snapshot page errors without failing the route', async () => {
		const client = createAnalyticsClient([
			{ data: Array.from({ length: 1000 }, (_, index) => makeSnapshotRow(index)), error: null },
			{ data: null, error: { message: 'page timeout' } }
		]);

		currentPriceIndexClient = client;

		const result = await runLoad(client);

		await expect(result.analyticsCharts).rejects.toThrow(
			'Failed to load analytics price snapshots page 2: page timeout'
		);
		await Promise.all([result.analyticsCoverage, result.analyticsMember]);
	});
});
