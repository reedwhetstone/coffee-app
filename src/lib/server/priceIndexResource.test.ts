import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCheckRateLimit = vi.fn();
const mockGetApiRowLimit = vi.fn();
const mockLogApiUsage = vi.fn();
const mockRequireApiKeyAccess = vi.fn();
const mockCreateAdminClient = vi.fn();

class MockAuthError extends Error {
	constructor(
		message: string,
		public status = 401
	) {
		super(message);
		this.name = 'AuthError';
	}
}

vi.mock('$lib/server/apiAuth', () => ({
	checkRateLimit: mockCheckRateLimit,
	getApiRowLimit: mockGetApiRowLimit,
	logApiUsage: mockLogApiUsage
}));

vi.mock('$lib/server/auth', () => ({
	AuthError: MockAuthError,
	requireApiKeyAccess: mockRequireApiKeyAccess
}));

vi.mock('$lib/supabase-admin', () => ({
	createAdminClient: mockCreateAdminClient
}));

let buildCanonicalPriceIndexResponse: typeof import('./priceIndexResource').buildCanonicalPriceIndexResponse;

const apiPrincipal = {
	authKind: 'api-key',
	isAuthenticated: true,
	apiKeyId: 'api-key-1',
	apiPlan: 'member',
	ppiAccess: true,
	primaryAppRole: 'member'
};

const sampleSnapshot = {
	id: 'snapshot-1',
	snapshot_date: '2026-04-29',
	origin: 'Ethiopia',
	process: 'Washed',
	grade: null,
	wholesale_only: false,
	price_min: '6.25',
	price_max: '9.80',
	price_avg: '7.45',
	price_median: '7.20',
	price_p25: '6.90',
	price_p75: '8.10',
	price_stdev: '0.70',
	supplier_count: 8,
	sample_size: 31,
	aggregation_tier: 1,
	synthetic: false
};

function makeEvent(url: string, headers: HeadersInit = {}) {
	return {
		url: new URL(url),
		request: new Request(url, { headers }),
		locals: {}
	} as unknown as Parameters<typeof buildCanonicalPriceIndexResponse>[0];
}

function createQueryMock(result: {
	data?: unknown[];
	count?: number | null;
	error?: { message: string } | null;
}) {
	const query = {
		select: vi.fn(() => query),
		eq: vi.fn(() => query),
		gte: vi.fn(() => query),
		lte: vi.fn(() => query),
		order: vi.fn(() => query),
		range: vi.fn().mockResolvedValue({
			data: result.data ?? [sampleSnapshot],
			count: result.count ?? 1,
			error: result.error ?? null
		})
	};

	const supabase = {
		from: vi.fn(() => query)
	};

	mockCreateAdminClient.mockReturnValue(supabase);
	return { supabase, query };
}

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();

	mockRequireApiKeyAccess.mockResolvedValue(apiPrincipal);
	mockGetApiRowLimit.mockReturnValue(-1);
	mockCheckRateLimit.mockResolvedValue({
		allowed: true,
		limit: 10000,
		remaining: 9999,
		resetTime: new Date('2026-05-01T00:00:00Z')
	});
	mockLogApiUsage.mockResolvedValue(undefined);
	createQueryMock({ data: [sampleSnapshot], count: 1 });

	({ buildCanonicalPriceIndexResponse } = await import('./priceIndexResource'));
});

describe('buildCanonicalPriceIndexResponse', () => {
	it('serves aggregate price index rows for a valid API-key principal with Parchment Intelligence access', async () => {
		const { supabase, query } = createQueryMock({ data: [sampleSnapshot], count: 1 });

		const response = await buildCanonicalPriceIndexResponse(
			makeEvent('https://app.test/v1/price-index?origin=Ethiopia&from=2026-04-01&to=2026-04-29')
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(response.headers.get('X-RateLimit-Limit')).toBe('10000');
		expect(body.data).toEqual([
			{
				date: '2026-04-29',
				origin: 'Ethiopia',
				process: 'Washed',
				grade: null,
				wholesale: false,
				price: {
					min: 6.25,
					max: 9.8,
					avg: 7.45,
					median: 7.2,
					p25: 6.9,
					p75: 8.1,
					stdev: 0.7
				},
				sample: { suppliers: 8, listings: 31, aggregation_tier: 1 },
				provenance: { synthetic: false }
			}
		]);
		expect(body.meta).toMatchObject({
			resource: 'price-index',
			namespace: '/v1/price-index',
			version: 'v1',
			auth: { kind: 'api-key', apiPlan: 'member', ppiAccess: true },
			filters: {
				origin: 'Ethiopia',
				process: null,
				grade: null,
				from: '2026-04-01',
				to: '2026-04-29',
				wholesale: null
			},
			source: { table: 'price_index_snapshots', aggregateOnly: true }
		});
		expect(supabase.from).toHaveBeenCalledWith('price_index_snapshots');
		expect(query.eq).toHaveBeenCalledWith('origin', 'Ethiopia');
		expect(query.gte).toHaveBeenCalledWith('snapshot_date', '2026-04-01');
		expect(query.lte).toHaveBeenCalledWith('snapshot_date', '2026-04-29');
		expect(query.range).toHaveBeenCalledWith(0, 99);
		expect(mockLogApiUsage).toHaveBeenCalledWith(
			'api-key-1',
			'/v1/price-index',
			200,
			expect.any(Number),
			undefined,
			undefined
		);
	});

	it('returns 401 when API-key authentication is missing or invalid', async () => {
		mockRequireApiKeyAccess.mockRejectedValue(new MockAuthError('API key authentication required'));

		const response = await buildCanonicalPriceIndexResponse(
			makeEvent('https://app.test/v1/price-index')
		);
		const body = await response.json();

		expect(response.status).toBe(401);
		expect(body).toMatchObject({
			error: 'Authentication required',
			message: 'API key authentication required'
		});
		expect(mockCreateAdminClient).not.toHaveBeenCalled();
		expect(mockLogApiUsage).not.toHaveBeenCalled();
	});

	it('returns 403 for a valid API key without Parchment Intelligence access', async () => {
		mockRequireApiKeyAccess.mockResolvedValue({ ...apiPrincipal, ppiAccess: false });

		const response = await buildCanonicalPriceIndexResponse(
			makeEvent('https://app.test/v1/price-index')
		);
		const body = await response.json();

		expect(response.status).toBe(403);
		expect(body).toMatchObject({
			error: 'Insufficient permissions',
			requiredEntitlement: 'ppiAccess'
		});
		expect(mockCreateAdminClient).not.toHaveBeenCalled();
		expect(mockLogApiUsage).toHaveBeenCalledWith(
			'api-key-1',
			'/v1/price-index',
			403,
			expect.any(Number),
			undefined,
			undefined
		);
	});

	it.each([
		['page', '0', 'positive integer'],
		['limit', '101', 'positive integer less than or equal to 100'],
		['from', '2026-02-31', 'YYYY-MM-DD'],
		['to', 'yesterday', 'YYYY-MM-DD'],
		['wholesale', 'yes', 'true or false'],
		['format', 'csv', 'json']
	])('returns 400 for invalid %s query params', async (parameter, value, expected) => {
		const response = await buildCanonicalPriceIndexResponse(
			makeEvent(`https://app.test/v1/price-index?${parameter}=${encodeURIComponent(value)}`)
		);
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body).toMatchObject({
			error: 'Invalid query parameter',
			details: { parameter, value, expected }
		});
		expect(mockCreateAdminClient).not.toHaveBeenCalled();
		expect(mockLogApiUsage).toHaveBeenCalledWith(
			'api-key-1',
			'/v1/price-index',
			400,
			expect.any(Number),
			undefined,
			undefined
		);
	});

	it('uses deterministic pagination and applies filters only to aggregate snapshot columns', async () => {
		const { query } = createQueryMock({
			data: [{ ...sampleSnapshot, id: 'snapshot-2', snapshot_date: '2026-04-28' }],
			count: 2
		});

		const response = await buildCanonicalPriceIndexResponse(
			makeEvent(
				'https://app.test/v1/price-index?page=2&limit=1&process=Natural&grade=G1&wholesale=true'
			)
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(query.eq).toHaveBeenCalledWith('process', 'Natural');
		expect(query.eq).toHaveBeenCalledWith('grade', 'G1');
		expect(query.eq).toHaveBeenCalledWith('wholesale_only', true);
		expect(query.order.mock.calls).toEqual([
			['snapshot_date', { ascending: false }],
			['origin', { ascending: true }],
			['process', { ascending: true }],
			['grade', { ascending: true }],
			['wholesale_only', { ascending: true }],
			['synthetic', { ascending: true }],
			['id', { ascending: true }]
		]);
		expect(query.range).toHaveBeenCalledWith(1, 1);
		expect(body.pagination).toEqual({
			page: 2,
			limit: 1,
			total: 2,
			totalPages: 2,
			hasNext: false,
			hasPrev: true
		});
	});

	it('caps effective page size by the API row limit when present', async () => {
		mockGetApiRowLimit.mockReturnValue(25);
		const { query } = createQueryMock({ data: [sampleSnapshot], count: 240 });

		const response = await buildCanonicalPriceIndexResponse(
			makeEvent('https://app.test/v1/price-index?limit=100')
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(query.range).toHaveBeenCalledWith(0, 24);
		expect(body.pagination.limit).toBe(25);
		expect(body.meta.access).toMatchObject({
			rowLimit: 25,
			limited: true,
			totalAvailable: 240
		});
	});

	it('uses the capped effective page size when computing row-limited page offsets', async () => {
		mockGetApiRowLimit.mockReturnValue(25);
		const { query } = createQueryMock({ data: [sampleSnapshot], count: 240 });

		const response = await buildCanonicalPriceIndexResponse(
			makeEvent('https://app.test/v1/price-index?page=2&limit=100')
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(query.range).toHaveBeenCalledWith(25, 49);
		expect(body.pagination).toMatchObject({
			page: 2,
			limit: 25,
			total: 240,
			totalPages: 10,
			hasNext: true,
			hasPrev: true
		});
	});
});
