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
	arrival_date: '2026-03-15',
	stocked_date: '2026-04-01',
	last_updated: '2026-04-02',
	farm_notes: 'Farm note',
	wholesale: false,
	process_additives: null,
	process_additive_detail: null,
	fermentation_duration_hours: null,
	processing_notes: null,
	processing_disclosure_level: 'high_detail',
	processing_confidence: 0.86,
	processing_evidence_available: true,
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

const matchDetailRow = {
	id: 2200,
	name: 'Ethiopia Guji Natural Lot B',
	source: 'Supplier B',
	region: 'Guji',
	country: 'Ethiopia',
	continent: 'Africa',
	processing: 'Natural',
	processing_base_method: 'natural',
	fermentation_type: null,
	drying_method: 'Raised bed',
	stocked: true,
	arrival_date: '2026-03-20',
	stocked_date: '2026-04-03',
	last_updated: '2026-04-04',
	farm_notes: 'Supplier B farm note',
	wholesale: false,
	process_additives: null,
	process_additive_detail: null,
	fermentation_duration_hours: null,
	processing_notes: null,
	processing_disclosure_level: 'high_detail',
	processing_confidence: 0.9,
	processing_evidence_available: true,
	cost_lb: '6.75',
	price_per_lb: '8.75',
	price_tiers: [{ min_lbs: 1, price: 8.75 }]
};

function createSupabaseMock(
	options: {
		target?: unknown | null;
		matches?: unknown[];
		details?: unknown[];
		v3Error?: { message: string; code?: string };
		v2Error?: { message: string; code?: string };
		legacyError?: { message: string; code?: string };
		legacyMatches?: unknown[];
	} = {}
) {
	const maybeSingle = vi.fn().mockResolvedValue({
		data: 'target' in options ? options.target : targetRow,
		error: null
	});
	const query = { eq: vi.fn(), maybeSingle } as {
		eq: ReturnType<typeof vi.fn>;
		maybeSingle: typeof maybeSingle;
		in?: ReturnType<typeof vi.fn>;
	};
	query.eq.mockReturnValue(query);
	const eq = query.eq;
	const inFilter = vi.fn(() =>
		Promise.resolve({
			data: options.details ?? [matchDetailRow],
			error: null
		})
	);
	query.in = inFilter;
	const select = vi.fn(() => query);
	const from = vi.fn(() => ({ select }));
	const rpc = vi.fn((fn: string, args?: { match_count?: number }) => {
		if (fn === 'find_similar_beans_aggregated') {
			if (options.legacyError) return Promise.resolve({ data: null, error: options.legacyError });
			const matches = options.legacyMatches ?? options.matches ?? [matchRow];
			const cappedMatches =
				typeof args?.match_count === 'number' ? matches.slice(0, args.match_count) : matches;
			return Promise.resolve({ data: cappedMatches, error: null });
		}
		if (fn === 'find_similar_beans_aggregated_v3') {
			const v3Error = options.v3Error ?? options.v2Error;
			if (v3Error) return Promise.resolve({ data: null, error: v3Error });
		}
		if (fn === 'find_similar_beans_aggregated_v2' && options.v2Error) {
			return Promise.resolve({ data: null, error: options.v2Error });
		}
		const matches = options.matches ?? [matchRow];
		const cappedMatches =
			typeof args?.match_count === 'number' ? matches.slice(0, args.match_count) : matches;
		return Promise.resolve({
			data: cappedMatches,
			error: null
		});
	});
	const supabase = { from, rpc };
	mockCreateAdminClient.mockReturnValue(supabase);
	return { supabase, from, select, eq, inFilter, maybeSingle, rpc };
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

	it('returns 403 plus a locked teaser without running expensive similarity counts for signed-in viewers', async () => {
		mockResolvePrincipal.mockResolvedValue(viewerPrincipal);
		const { rpc } = createSupabaseMock();

		const response = await GET(makeEvent('https://app.test/v1/catalog/1182/similar?threshold=0.8'));
		const body = await response.json();

		expect(response.status).toBe(403);
		expect(body).toMatchObject({
			error: 'Insufficient permissions',
			code: 'entitlement_required',
			requiredCapability: 'canUseBeanMatching',
			teaser: { locked: true, similar_match_count: null, beta: true }
		});
		expect(rpc).not.toHaveBeenCalled();
		expect(JSON.stringify(body)).not.toContain('Supplier B');
	});

	it('returns the same 403 entitlement response for signed-in viewers when the id is unknown', async () => {
		mockResolvePrincipal.mockResolvedValue(viewerPrincipal);
		const { rpc } = createSupabaseMock({ target: null });

		const response = await GET(makeEvent('https://app.test/v1/catalog/999999/similar'));
		const body = await response.json();

		expect(response.status).toBe(403);
		expect(body).toMatchObject({
			error: 'Insufficient permissions',
			code: 'entitlement_required',
			teaser: { locked: true, similar_match_count: null, beta: true }
		});
		expect(rpc).not.toHaveBeenCalled();
		expect(JSON.stringify(body)).not.toContain('not found');
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

	it.each(['2147483648', '999999999999', '9007199254740992'])(
		'returns 400 before database access for catalog id %s outside the int4 range',
		async (id) => {
			const response = await GET(makeEvent(`https://app.test/v1/catalog/${id}/similar`, { id }));
			const body = await response.json();

			expect(response.status).toBe(400);
			expect(body).toMatchObject({
				error: 'Invalid query parameter',
				details: {
					parameter: 'id',
					value: id,
					expected: 'positive integer less than or equal to 2147483647'
				}
			});
			expect(mockResolvePrincipal).not.toHaveBeenCalled();
			expect(mockCreateAdminClient).not.toHaveBeenCalled();
		}
	);

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
		expect(rpc).toHaveBeenCalledWith('find_similar_beans_aggregated_v3', {
			target_coffee_id: 1182,
			match_threshold: 0.7,
			match_count: 125,
			stocked_only: false,
			public_only: false,
			candidate_pool: 1000
		});
		expect(body.data.target).toMatchObject({
			id: 1182,
			stocked_date: '2026-04-01',
			price_per_lb: null,
			price_tiers: [{ min_lbs: 1, price: 8 }],
			pricing: { baseline_price_per_lb: 8, baseline_source: 'price_tiers' },
			proof: {
				families: {
					freshness: { signals: expect.arrayContaining(['stocked_date']) }
				}
			}
		});
		expect(body.data.matches[0]).toMatchObject({
			coffee: {
				id: 2200,
				source: 'Supplier B',
				stocked_date: '2026-04-03',
				proof: { families: { process: { label: 'disclosed' } } }
			},
			pricing: {
				price_per_lb: 8.75,
				price_tiers: [{ min_lbs: 1, price: 8.75 }],
				baseline_source: 'price_per_lb'
			},
			price_delta_1lb: { amount: 0.75, percent: 9.4 },
			score: { dimensions: { origin: 0.94, processing: 0.91, tasting: 0.87 } },
			match: { category: 'likely_same', confidence: 'high_beta', beta: true }
		});
		expect(body.data.groups.canonical_candidates).toHaveLength(1);
		expect(body.data.groups.similar_recommendations).toHaveLength(0);
		expect(body.data).not.toHaveProperty('queryStrategy');
		expect(body.data.matches[0].match.classification).toMatchObject({
			kind: 'canonical_candidate',
			identity_eligibility: 'eligible',
			blockers: []
		});
		expect(body.meta).toMatchObject({
			resource: 'catalog-similarity',
			status: 'beta',
			auth: { kind: 'session', role: 'member' },
			access: {
				requiredCapability: 'canUseBeanMatching',
				canUseBeanMatching: true
			},
			classification_version: 'canonical-match-v1',
			query_strategy: 'bounded-vector-candidates-v1'
		});
	});

	it('reports the v2 query strategy when bounded v3 falls back to the canonical RPC', async () => {
		mockResolvePrincipal.mockResolvedValue(memberPrincipal);
		const { rpc } = createSupabaseMock({
			v3Error: {
				message: 'Could not find the function public.find_similar_beans_aggregated_v3',
				code: 'PGRST202'
			}
		});

		const response = await GET(makeEvent('https://app.test/v1/catalog/1182/similar?limit=5'));
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(rpc).toHaveBeenCalledWith('find_similar_beans_aggregated_v3', {
			target_coffee_id: 1182,
			match_threshold: 0.7,
			match_count: 5,
			stocked_only: true,
			public_only: false,
			candidate_pool: 200
		});
		expect(rpc).toHaveBeenCalledWith('find_similar_beans_aggregated_v2', {
			target_coffee_id: 1182,
			match_threshold: 0.7,
			match_count: 5,
			stocked_only: true,
			public_only: false
		});
		expect(body.meta.query_strategy).toBe('canonical-vector-aggregated-v2');
	});

	it('falls back to the legacy similarity RPC when preview data has not deployed the canonical RPC yet', async () => {
		mockResolvePrincipal.mockResolvedValue(memberPrincipal);
		const { rpc } = createSupabaseMock({
			v2Error: {
				message:
					'structure of query does not match function result type: Returned type jsonb[] does not match expected type jsonb in column 13.',
				code: '42804'
			},
			legacyMatches: [
				{
					...matchRow,
					origin_similarity: undefined,
					processing_similarity: undefined
				}
			]
		});

		const response = await GET(makeEvent('https://app.test/v1/catalog/1182/similar?limit=5'));
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(rpc).toHaveBeenCalledWith('find_similar_beans_aggregated_v3', {
			target_coffee_id: 1182,
			match_threshold: 0.7,
			match_count: 5,
			stocked_only: true,
			public_only: false,
			candidate_pool: 200
		});
		expect(rpc).toHaveBeenCalledWith('find_similar_beans_aggregated_v2', {
			target_coffee_id: 1182,
			match_threshold: 0.7,
			match_count: 5,
			stocked_only: true,
			public_only: false
		});
		expect(rpc).toHaveBeenCalledWith('find_similar_beans_aggregated', {
			target_coffee_id: 1182,
			match_threshold: 0.7,
			match_count: 125
		});
		expect(body.data.matches[0]).toMatchObject({
			coffee: { id: 2200, source: 'Supplier B' },
			score: { dimensions: { origin: null, processing: null, tasting: null } },
			match: { category: 'similar_profile' }
		});
		expect(body.meta.query_strategy).toBe('legacy-vector-aggregated-v1');
	});

	it('overfetches legacy fallback rows before applying stocked filtering', async () => {
		mockResolvePrincipal.mockResolvedValue(memberPrincipal);
		const { rpc } = createSupabaseMock({
			v2Error: {
				message: 'Could not find the function public.find_similar_beans_aggregated_v2',
				code: 'PGRST202'
			},
			legacyMatches: [
				{ ...matchRow, coffee_id: 3001, stocked: false },
				{ ...matchRow, coffee_id: 3002, stocked: false },
				{ ...matchRow, coffee_id: 3003, stocked: true },
				{ ...matchRow, coffee_id: 3004, stocked: true }
			],
			details: [
				{ ...matchDetailRow, id: 3003, stocked: true },
				{ ...matchDetailRow, id: 3004, stocked: true }
			]
		});

		const response = await GET(makeEvent('https://app.test/v1/catalog/1182/similar?limit=2'));
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(rpc).toHaveBeenCalledWith('find_similar_beans_aggregated', {
			target_coffee_id: 1182,
			match_threshold: 0.7,
			match_count: 125
		});
		expect(body.data.matches.map((match: { coffee: { id: number } }) => match.coffee.id)).toEqual([
			3003, 3004
		]);
		expect(
			body.data.matches.every((match: { coffee: { stocked: boolean } }) => match.coffee.stocked)
		).toBe(true);
	});

	it('does not return legacy fallback rows without dimensions for likely-same mode', async () => {
		mockResolvePrincipal.mockResolvedValue(memberPrincipal);
		const { rpc } = createSupabaseMock({
			v2Error: {
				message: 'Could not find the function public.find_similar_beans_aggregated_v2',
				code: 'PGRST202'
			},
			legacyMatches: [{ ...matchRow, avg_similarity: 0.97, chunk_matches: 4 }]
		});

		const response = await GET(
			makeEvent('https://app.test/v1/catalog/1182/similar?limit=5&mode=likely_same')
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.data.matches).toEqual([]);
		expect(rpc).toHaveBeenCalledWith('find_similar_beans_aggregated', {
			target_coffee_id: 1182,
			match_threshold: 0.7,
			match_count: 125
		});
	});

	it('surfaces canonical similarity RPC permission errors instead of falling back to legacy rows', async () => {
		mockResolvePrincipal.mockResolvedValue(memberPrincipal);
		const { rpc } = createSupabaseMock({
			v2Error: {
				message: 'permission denied for function find_similar_beans_aggregated_v2',
				code: '42501'
			},
			legacyMatches: [{ ...matchRow, coffee_id: 3003, stocked: true }]
		});

		const response = await GET(makeEvent('https://app.test/v1/catalog/1182/similar?limit=2'));
		const body = await response.json();

		expect(response.status).toBe(500);
		expect(body).toMatchObject({
			error: 'Failed to fetch similar coffees',
			message: 'Internal server error'
		});
		expect(rpc).not.toHaveBeenCalledWith('find_similar_beans_aggregated', expect.anything());
	});

	it('surfaces legacy similarity RPC failures after canonical fallback instead of returning empty matches', async () => {
		mockResolvePrincipal.mockResolvedValue(memberPrincipal);
		createSupabaseMock({
			v2Error: {
				message: 'Could not find the function public.find_similar_beans_aggregated_v2',
				code: 'PGRST202'
			},
			legacyError: {
				message: 'permission denied for function find_similar_beans_aggregated',
				code: '42501'
			}
		});

		const response = await GET(makeEvent('https://app.test/v1/catalog/1182/similar?limit=5'));
		const body = await response.json();

		expect(response.status).toBe(500);
		expect(body).toMatchObject({
			error: 'Failed to fetch similar coffees',
			message: 'Internal server error'
		});
	});

	it('uses a bounded overfetch before mode filtering so profile rows do not hide likely-same matches', async () => {
		mockResolvePrincipal.mockResolvedValue(memberPrincipal);
		const profileRows = Array.from({ length: 30 }, (_, index) => ({
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
		const { rpc } = createSupabaseMock({
			matches: [...profileRows, ...likelyRows]
		});

		const response = await GET(
			makeEvent('https://app.test/v1/catalog/1182/similar?limit=2&mode=likely_same')
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(rpc).toHaveBeenCalledWith('find_similar_beans_aggregated_v3', {
			target_coffee_id: 1182,
			match_threshold: 0.7,
			match_count: 125,
			stocked_only: true,
			public_only: false,
			candidate_pool: 1000
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
		const { eq, rpc } = createSupabaseMock();

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
		expect(rpc).toHaveBeenCalledWith('find_similar_beans_aggregated_v3', {
			target_coffee_id: 1182,
			match_threshold: 0.7,
			match_count: 10,
			stocked_only: true,
			public_only: true,
			candidate_pool: 400
		});
		expect(eq).toHaveBeenCalledWith('public_coffee', true);
		expect(body.meta.auth).toMatchObject({
			kind: 'api-key',
			apiPlan: 'member'
		});
	});
});
