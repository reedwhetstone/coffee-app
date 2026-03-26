import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRequireApiKeyAccess = vi.fn();
const mockCheckRateLimit = vi.fn();
const mockGetApiRowLimit = vi.fn();
const mockGetLegacyRateLimitTier = vi.fn();
const mockLogApiUsage = vi.fn();
const mockCreateAdminClient = vi.fn();
const mockGetPublicCatalog = vi.fn();

class MockAuthError extends Error {
	constructor(
		message: string,
		public status = 401
	) {
		super(message);
		this.name = 'AuthError';
	}
}

vi.mock('$lib/server/auth', () => ({
	AuthError: MockAuthError,
	requireApiKeyAccess: mockRequireApiKeyAccess
}));

vi.mock('$lib/server/apiAuth', () => ({
	checkRateLimit: mockCheckRateLimit,
	getApiRowLimit: mockGetApiRowLimit,
	getLegacyRateLimitTier: mockGetLegacyRateLimitTier,
	logApiUsage: mockLogApiUsage
}));

vi.mock('$lib/supabase-admin', () => ({
	createAdminClient: mockCreateAdminClient
}));

vi.mock('$lib/data/catalog', () => ({
	getPublicCatalog: mockGetPublicCatalog,
	CATALOG_API_COLUMNS: ['id', 'coffee_name']
}));

let GET: typeof import('./+server').GET;
let AuthError: typeof import('$lib/server/auth').AuthError;

function makeEvent(headers: HeadersInit = {}) {
	return {
		request: new Request('https://app.test/api/catalog-api', {
			method: 'GET',
			headers
		})
	} as Parameters<NonNullable<typeof GET>>[0];
}

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();

	mockRequireApiKeyAccess.mockResolvedValue({
		apiKeyId: 'key-1',
		apiPlan: 'api-member',
		apiScopes: ['catalog:read'],
		primaryAppRole: 'api-member'
	});
	mockGetApiRowLimit.mockReturnValue(0);
	mockGetLegacyRateLimitTier.mockReturnValue('api-member');
	mockCheckRateLimit.mockResolvedValue({
		allowed: true,
		limit: 100,
		remaining: 99,
		resetTime: new Date('2026-03-26T22:00:00Z')
	});
	mockLogApiUsage.mockResolvedValue(undefined);
	mockCreateAdminClient.mockReturnValue({ kind: 'admin-client' });
	mockGetPublicCatalog.mockResolvedValue([
		{ id: 'coffee-1', coffee_name: 'Ethiopia Guji' },
		{ id: 'coffee-2', coffee_name: 'Colombia Huila' }
	]);

	({ GET } = await import('./+server'));
	({ AuthError } = await import('$lib/server/auth'));
});

describe('/api/catalog-api auth boundary', () => {
	it('returns catalog data for an authorized API key request', async () => {
		const response = await GET(makeEvent({ Authorization: 'Bearer pk_live_valid' }));
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(mockRequireApiKeyAccess).toHaveBeenCalledWith(expect.anything(), {
			requiredPlan: 'viewer',
			requiredScope: 'catalog:read'
		});
		expect(mockCheckRateLimit).toHaveBeenCalledWith('key-1', 'api-member');
		expect(mockGetPublicCatalog).toHaveBeenCalledWith({ kind: 'admin-client' }, [
			'id',
			'coffee_name'
		]);
		expect(body).toMatchObject({
			data: [
				{ id: 'coffee-1', coffee_name: 'Ethiopia Guji' },
				{ id: 'coffee-2', coffee_name: 'Colombia Huila' }
			],
			total: 2,
			total_available: 2,
			tier: 'api-member',
			cached: false,
			api_version: '1.0'
		});
		expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
		expect(response.headers.get('X-RateLimit-Remaining')).toBe('99');
	});

	it('returns 401 when API-key authentication fails before handler execution', async () => {
		mockRequireApiKeyAccess.mockRejectedValue(
			new AuthError('API key authentication required', 401)
		);

		const response = await GET(makeEvent({ Authorization: 'Bearer pk_live_invalid' }));
		const body = await response.json();

		expect(response.status).toBe(401);
		expect(body).toEqual({
			error: 'Authentication required',
			message: 'API key authentication required'
		});
		expect(mockCheckRateLimit).not.toHaveBeenCalled();
		expect(mockGetPublicCatalog).not.toHaveBeenCalled();
		expect(mockLogApiUsage).not.toHaveBeenCalled();
	});

	it('returns 403 when the API key lacks the required catalog scope', async () => {
		mockRequireApiKeyAccess.mockRejectedValue(new AuthError('Insufficient API scope', 403));

		const response = await GET(makeEvent({ Authorization: 'Bearer pk_live_valid' }));
		const body = await response.json();

		expect(response.status).toBe(403);
		expect(body).toEqual({
			error: 'Insufficient permissions',
			message: 'Insufficient API scope'
		});
		expect(mockCheckRateLimit).not.toHaveBeenCalled();
		expect(mockGetPublicCatalog).not.toHaveBeenCalled();
	});
});
