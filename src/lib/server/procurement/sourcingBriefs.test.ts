import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCheckRateLimit = vi.fn();
const mockLogApiUsage = vi.fn();
const mockRequireApiKeyAccess = vi.fn();
const mockResolvePrincipal = vi.fn();
const mockIsApiKeyPrincipal = vi.fn();
const mockIsSessionPrincipal = vi.fn();
const mockPrincipalHasRole = vi.fn();
const mockIsTrustedMutationRequest = vi.fn();
const mockCreateAdminClient = vi.fn();
const mockSearchCatalog = vi.fn();
const mockToCatalogResourceItem = vi.fn();

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
	logApiUsage: mockLogApiUsage
}));

vi.mock('$lib/server/auth', () => ({
	AuthError: MockAuthError,
	requireApiKeyAccess: mockRequireApiKeyAccess
}));

vi.mock('$lib/server/principal', () => ({
	resolvePrincipal: mockResolvePrincipal,
	isApiKeyPrincipal: mockIsApiKeyPrincipal,
	isSessionPrincipal: mockIsSessionPrincipal,
	principalHasRole: mockPrincipalHasRole,
	isTrustedMutationRequest: mockIsTrustedMutationRequest
}));

vi.mock('$lib/supabase-admin', () => ({
	createAdminClient: mockCreateAdminClient
}));

vi.mock('$lib/data/catalog', () => ({
	searchCatalog: mockSearchCatalog
}));

vi.mock('$lib/catalog/catalogResourceItem', () => ({
	toCatalogResourceItem: mockToCatalogResourceItem
}));

let buildSourcingBriefCreateResponse: typeof import('./sourcingBriefs').buildSourcingBriefCreateResponse;
let buildSourcingBriefMatchesResponse: typeof import('./sourcingBriefs').buildSourcingBriefMatchesResponse;

const memberApiPrincipal = {
	authKind: 'api-key',
	isAuthenticated: true,
	userId: '11111111-1111-4111-8111-111111111111',
	primaryAppRole: 'member',
	apiPlan: 'member',
	apiKeyId: 'api-key-1'
};

const briefRow = {
	id: '22222222-2222-4222-8222-222222222222',
	user_id: memberApiPrincipal.userId,
	name: 'Washed Colombia under 6.50',
	criteria: {
		version: 1,
		country: 'Colombia',
		processing_base_method: 'Washed',
		max_price_per_lb: 6.5,
		stocked_only: true
	},
	cadence: 'manual',
	is_active: true,
	last_run_at: null,
	created_at: '2026-05-07T00:00:00.000Z',
	updated_at: '2026-05-07T00:00:00.000Z'
};

function makeDbMock(row = briefRow) {
	const captured: { insert?: unknown; update?: unknown; eq: unknown[] } = { eq: [] };
	const builder = {
		insert: vi.fn((payload: unknown) => {
			captured.insert = payload;
			return builder;
		}),
		select: vi.fn(() => builder),
		single: vi.fn(async () => ({ data: row, error: null })),
		eq: vi.fn((...args: unknown[]) => {
			captured.eq.push(args);
			return builder;
		}),
		maybeSingle: vi.fn(async () => ({ data: row, error: null })),
		order: vi.fn(async () => ({ data: [row], error: null })),
		update: vi.fn((payload: unknown) => {
			captured.update = payload;
			return builder;
		})
	};
	return { client: { from: vi.fn(() => builder) }, builder, captured };
}

function makeEvent(url: string, init: RequestInit = {}) {
	return {
		url: new URL(url),
		request: new Request(url, init),
		locals: {}
	} as Parameters<typeof buildSourcingBriefCreateResponse>[0];
}

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();
	mockResolvePrincipal.mockResolvedValue(memberApiPrincipal);
	mockIsApiKeyPrincipal.mockReturnValue(true);
	mockIsSessionPrincipal.mockReturnValue(false);
	mockPrincipalHasRole.mockReturnValue(true);
	mockIsTrustedMutationRequest.mockReturnValue(true);
	mockRequireApiKeyAccess.mockResolvedValue(memberApiPrincipal);
	mockCheckRateLimit.mockResolvedValue({
		allowed: true,
		limit: 10000,
		remaining: 9999,
		resetTime: new Date('2026-06-01T00:00:00.000Z')
	});
	mockToCatalogResourceItem.mockImplementation((row) => ({ id: row.id, name: row.name }));
	({ buildSourcingBriefCreateResponse, buildSourcingBriefMatchesResponse } = await import(
		'./sourcingBriefs'
	));
});

describe('sourcing brief API helpers', () => {
	it('creates a member API sourcing brief with normalized criteria', async () => {
		const db = makeDbMock();
		mockCreateAdminClient.mockReturnValue(db.client);

		const response = await buildSourcingBriefCreateResponse(
			makeEvent('https://app.test/v1/procurement/briefs', {
				method: 'POST',
				headers: { Authorization: 'Bearer pk_live_test' },
				body: JSON.stringify({
					name: ' Washed Colombia under 6.50 ',
					criteria: { country: ' Colombia ', max_price_per_lb: 6.505, stocked_only: true }
				})
			})
		);
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(response.headers.get('X-RateLimit-Limit')).toBe('10000');
		expect(db.client.from).toHaveBeenCalledWith('sourcing_briefs');
		expect(db.captured.insert).toMatchObject({
			user_id: memberApiPrincipal.userId,
			name: 'Washed Colombia under 6.50',
			criteria: { version: 1, country: 'Colombia', max_price_per_lb: 6.5, stocked_only: true },
			cadence: 'manual'
		});
		expect(body.data.criteria.country).toBe('Colombia');
	});

	it('rejects insufficient API plans with the shared structured auth envelope', async () => {
		mockRequireApiKeyAccess.mockRejectedValue(new MockAuthError('Insufficient API plan', 403));

		const response = await buildSourcingBriefCreateResponse(
			makeEvent('https://app.test/v1/procurement/briefs', {
				method: 'POST',
				headers: { Authorization: 'Bearer pk_live_test' },
				body: JSON.stringify({ name: 'Brief', criteria: { country: 'Colombia' } })
			})
		);
		const body = await response.json();

		expect(response.status).toBe(403);
		expect(body).toMatchObject({
			error: 'Insufficient permissions',
			message: 'Insufficient API plan'
		});
	});

	it('runs matches with saved criteria before pagination and returns match reasons', async () => {
		const db = makeDbMock();
		mockCreateAdminClient.mockReturnValue(db.client);
		mockSearchCatalog.mockResolvedValue({
			data: [
				{
					id: 7,
					name: 'Colombia Huila Washed',
					country: 'Colombia',
					region: 'Huila',
					processing: 'Washed',
					processing_base_method: 'Washed',
					price_per_lb: 6.25,
					stocked: true,
					stocked_date: '2026-05-01',
					wholesale: false
				}
			],
			count: 17,
			filtersApplied: {}
		});

		const response = await buildSourcingBriefMatchesResponse(
			makeEvent(
				'https://app.test/v1/procurement/briefs/22222222-2222-4222-8222-222222222222/matches?page=2&limit=5',
				{
					headers: { Authorization: 'Bearer pk_live_test' }
				}
			),
			'22222222-2222-4222-8222-222222222222'
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(mockSearchCatalog).toHaveBeenCalledWith(
			db.client,
			expect.objectContaining({
				country: 'Colombia',
				processingBaseMethod: 'Washed',
				pricePerLbMax: 6.5,
				stockedFilter: true,
				limit: 5,
				offset: 5,
				fields: 'resource'
			})
		);
		expect(body.pagination.total).toBe(17);
		expect(body.data[0].matchReasons).toEqual(
			expect.arrayContaining([
				'country_match',
				'processing_base_method_match',
				'price_under_target',
				'stocked_now'
			])
		);
	});
});
