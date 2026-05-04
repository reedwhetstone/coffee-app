import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockResolvePrincipal = vi.fn();
const mockRequireApiKeyAccess = vi.fn();
const mockCheckRateLimit = vi.fn();
const mockLogApiUsage = vi.fn();
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

vi.mock('$lib/server/principal', () => ({
	resolvePrincipal: mockResolvePrincipal,
	isApiKeyPrincipal: (principal: { authKind?: string }) => principal?.authKind === 'api-key',
	isSessionPrincipal: (principal: { authKind?: string }) => principal?.authKind === 'session'
}));

vi.mock('$lib/server/auth', () => ({
	AuthError: MockAuthError,
	requireApiKeyAccess: mockRequireApiKeyAccess
}));

vi.mock('$lib/server/apiAuth', () => ({
	checkRateLimit: mockCheckRateLimit,
	logApiUsage: mockLogApiUsage
}));

vi.mock('$lib/supabase-admin', () => ({
	createAdminClient: mockCreateAdminClient
}));

let GET: typeof import('./+server').GET;

const anonymousPrincipal = {
	authKind: 'anonymous',
	isAuthenticated: false,
	primaryAppRole: null,
	apiPlan: null
};

const viewerPrincipal = {
	authKind: 'session',
	isAuthenticated: true,
	primaryAppRole: 'viewer',
	apiPlan: 'viewer',
	session: { access_token: 'session-token' }
};

const memberPrincipal = {
	authKind: 'session',
	isAuthenticated: true,
	primaryAppRole: 'member',
	apiPlan: 'viewer',
	session: { access_token: 'session-token' }
};

const apiPrincipal = {
	authKind: 'api-key',
	isAuthenticated: true,
	primaryAppRole: 'viewer',
	apiPlan: 'member',
	apiKeyId: 'api-key-1',
	apiScopes: ['catalog:read']
};

const targetRow = {
	id: 1182,
	name: 'Ethiopia Guji Natural',
	source: 'Supplier A',
	region: 'Guji',
	country: 'Ethiopia',
	continent: 'Africa',
	processing: 'Natural',
	processing_base_method: 'natural',
	fermentation_type: null,
	drying_method: 'Raised bed',
	stocked: true,
	cost_lb: '7.10',
	price_per_lb: null,
	price_tiers: [{ min_lbs: 1, price: 8 }]
};

const matchRow = {
	coffee_id: 2200,
	coffee_name: 'Ethiopia Guji Natural Lot B',
	source: 'Supplier B',
	origin: 'Guji',
	country: 'Ethiopia',
	continent: 'Africa',
	processing: 'Natural',
	processing_base_method: 'natural',
	fermentation_type: null,
	drying_method: 'Raised bed',
	cost_lb: '6.75',
	price_per_lb: '8.75',
	price_tiers: [{ min_lbs: 1, price: 8.75 }],
	stocked: true,
	avg_similarity: 0.92,
	origin_similarity: 0.94,
	processing_similarity: 0.91,
	tasting_similarity: 0.87,
	chunk_matches: 3
};

function createSupabaseMock(
	options: { target?: unknown | null; matches?: unknown[]; count?: number } = {}
) {
	const maybeSingle = vi.fn().mockResolvedValue({ data: options.target ?? targetRow, error: null });
	const eq = vi.fn(() => ({ maybeSingle }));
	const select = vi.fn(() => ({ eq }));
	const from = vi.fn(() => ({ select }));
	const rpc = vi.fn((fn: string, args?: { match_count?: number }) => {
		if (fn === 'count_similar_beans_aggregated_v2') {
			return Promise.resolve({ data: options.count ?? 3, error: null });
		}
		const matches = options.matches ?? [matchRow];
		return Promise.resolve({
			data: matches.slice(0, args?.match_count ?? matches.length),
			error: null
		});
	});
	const supabase = { from, rpc };
	mockCreateAdminClient.mockReturnValue(supabase);
	return { supabase, from, select, eq, maybeSingle, rpc };
}

function makeEvent(url: string, init: { id?: string; headers?: HeadersInit } = {}) {
	return {
		url: new URL(url),
		params: { id: init.id ?? '1182' },
		request: new Request(url, { headers: init.headers }),
		locals: {}
	} as Parameters<NonNullable<typeof GET>>[0];
}

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();
	mockResolvePrincipal.mockResolvedValue(memberPrincipal);
	mockRequireApiKeyAccess.mockResolvedValue(apiPrincipal);
	mockCheckRateLimit.mockResolvedValue({
		allowed: true,
		limit: 10000,
		remaining: 9999,
		resetTime: new Date('2026-06-01T00:00:00Z')
	});
	mockLogApiUsage.mockResolvedValue(undefined);
	createSupabaseMock();
	({ GET } = await import('./+server'));
});

describe('/v1/catalog/[id]/similar', () => {
	it('returns 401 for anonymous callers without leaking match data', async () => {
		mockResolvePrincipal.mockResolvedValue(anonymousPrincipal);

		const response = await GET(makeEvent('https://app.test/v1/catalog/1182/similar'));
		const body = await response.json();

		expect(response.status).toBe(401);
		expect(body).toMatchObject({
			error: 'Authentication required',
			requiredCapability: 'canUseBeanMatching'
		});
		expect(JSON.stringify(body)).not.toContain('Supplier');
		expect(mockCreateAdminClient).not.toHaveBeenCalled();
	});

	it('returns 403 plus a locked count teaser for signed-in viewers', async () => {
		mockResolvePrincipal.mockResolvedValue(viewerPrincipal);
		const { rpc } = createSupabaseMock({ count: 4 });

		const response = await GET(makeEvent('https://app.test/v1/catalog/1182/similar?threshold=0.8'));
		const body = await response.json();

		expect(response.status).toBe(403);
		expect(body).toMatchObject({
			error: 'Insufficient permissions',
			code: 'entitlement_required',
			requiredCapability: 'canUseBeanMatching',
			teaser: { locked: true, similar_match_count: 4, beta: true }
		});
		expect(rpc).toHaveBeenCalledWith('count_similar_beans_aggregated_v2', {
			target_coffee_id: 1182,
			match_threshold: 0.8,
			stocked_only: true
		});
		expect(JSON.stringify(body)).not.toContain('Supplier B');
	});

	it('returns 400 for invalid params', async () => {
		const response = await GET(makeEvent('https://app.test/v1/catalog/1182/similar?limit=99'));
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body).toMatchObject({
			error: 'Invalid query parameter',
			details: { parameter: 'limit' }
		});
		expect(mockResolvePrincipal).not.toHaveBeenCalled();
	});

	it('returns beta matches for member session callers with canonical pricing fields', async () => {
		mockResolvePrincipal.mockResolvedValue(memberPrincipal);
		const { rpc } = createSupabaseMock();

		const response = await GET(
			makeEvent(
				'https://app.test/v1/catalog/1182/similar?limit=5&stocked_only=false&mode=likely_same'
			)
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(rpc).toHaveBeenCalledWith('find_similar_beans_aggregated_v2', {
			target_coffee_id: 1182,
			match_threshold: 0.7,
			match_count: 25,
			stocked_only: false
		});
		expect(body.data.target).toMatchObject({
			id: 1182,
			price_per_lb: null,
			price_tiers: [{ min_lbs: 1, price: 8 }],
			pricing: { baseline_price_per_lb: 8, baseline_source: 'price_tiers' }
		});
		expect(body.data.matches[0]).toMatchObject({
			coffee: { id: 2200, source: 'Supplier B' },
			pricing: {
				price_per_lb: 8.75,
				price_tiers: [{ min_lbs: 1, price: 8.75 }],
				baseline_source: 'price_per_lb'
			},
			price_delta_1lb: { amount: 0.75, percent: 9.4 },
			score: { dimensions: { origin: 0.94, processing: 0.91, tasting: 0.87 } },
			match: { category: 'likely_same', confidence: 'high_beta', beta: true }
		});
		expect(body.meta).toMatchObject({
			resource: 'catalog-similarity',
			status: 'beta',
			auth: { kind: 'session', role: 'member' },
			access: { requiredCapability: 'canUseBeanMatching', canUseBeanMatching: true }
		});
	});

	it('overfetches before mode filtering so profile rows do not hide likely-same matches', async () => {
		mockResolvePrincipal.mockResolvedValue(memberPrincipal);
		const profileRows = Array.from({ length: 5 }, (_, index) => ({
			...matchRow,
			coffee_id: 3000 + index,
			avg_similarity: 0.96 - index * 0.01,
			origin_similarity: 0.7,
			processing_similarity: 0.91,
			chunk_matches: 3
		}));
		const likelyRows = Array.from({ length: 2 }, (_, index) => ({
			...matchRow,
			coffee_id: 4000 + index,
			avg_similarity: 0.9 - index * 0.01,
			origin_similarity: 0.9,
			processing_similarity: 0.9,
			chunk_matches: 3
		}));
		const { rpc } = createSupabaseMock({ matches: [...profileRows, ...likelyRows] });

		const response = await GET(
			makeEvent('https://app.test/v1/catalog/1182/similar?limit=2&mode=likely_same')
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(rpc).toHaveBeenCalledWith('find_similar_beans_aggregated_v2', {
			target_coffee_id: 1182,
			match_threshold: 0.7,
			match_count: 25,
			stocked_only: true
		});
		expect(body.data.matches).toHaveLength(2);
		expect(body.data.matches.map((match: { coffee: { id: number } }) => match.coffee.id)).toEqual([
			4000, 4001
		]);
		expect(
			body.data.matches.every(
				(match: { match: { category: string } }) => match.match.category === 'likely_same'
			)
		).toBe(true);
	});

	it('allows paid API callers with rate headers and usage logging', async () => {
		mockResolvePrincipal.mockResolvedValue(apiPrincipal);
		mockRequireApiKeyAccess.mockResolvedValue(apiPrincipal);
		createSupabaseMock();

		const response = await GET(
			makeEvent('https://app.test/v1/catalog/1182/similar', {
				headers: { Authorization: 'Bearer pk_live_test' }
			})
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(response.headers.get('X-RateLimit-Limit')).toBe('10000');
		expect(mockRequireApiKeyAccess).toHaveBeenCalledWith(expect.anything(), {
			requiredPlan: 'member',
			requiredScope: 'catalog:read'
		});
		expect(mockLogApiUsage).toHaveBeenCalledWith(
			'api-key-1',
			'/v1/catalog/{id}/similar',
			200,
			expect.any(Number),
			undefined,
			undefined
		);
		expect(body.meta.auth).toMatchObject({ kind: 'api-key', apiPlan: 'member' });
	});
});
