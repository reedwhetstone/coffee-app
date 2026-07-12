import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	mockCheckRateLimit,
	mockGenerateText,
	mockLogApiUsage,
	mockRequireAuthenticatedMemberPrincipal
} = vi.hoisted(() => ({
	mockCheckRateLimit: vi.fn(),
	mockGenerateText: vi.fn(),
	mockLogApiUsage: vi.fn(),
	mockRequireAuthenticatedMemberPrincipal: vi.fn()
}));

vi.mock('$env/static/private', () => ({ OPENROUTER_API_KEY: 'test-openrouter-key' }));
vi.mock('$lib/server/auth', () => ({
	requireAuthenticatedMemberPrincipal: mockRequireAuthenticatedMemberPrincipal
}));
vi.mock('$lib/server/apiAuth', () => ({
	checkRateLimit: mockCheckRateLimit,
	logApiUsage: mockLogApiUsage
}));
vi.mock('$lib/server/principal', () => ({
	isApiKeyPrincipal: (principal: { authKind?: string }) => principal.authKind === 'api-key'
}));
vi.mock('@ai-sdk/openai', () => ({
	createOpenAI: vi.fn(() => ({ chat: vi.fn() }))
}));
vi.mock('ai', () => ({ generateText: mockGenerateText }));

let POST: typeof import('./+server').POST;

const apiKeyPrincipal = {
	authKind: 'api-key',
	apiKeyId: 'key-1',
	apiPlan: 'viewer'
};

function makeEvent(body?: unknown) {
	return {
		request: new Request('https://app.test/api/ai/classify-roast', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'User-Agent': 'purvey-test' },
			body: body === undefined ? undefined : JSON.stringify(body)
		}),
		getClientAddress: () => '127.0.0.1',
		locals: {}
	} as unknown as Parameters<NonNullable<typeof POST>>[0];
}

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();
	mockLogApiUsage.mockResolvedValue(undefined);
	({ POST } = await import('./+server'));
});

describe('/api/ai/classify-roast API-key usage enforcement', () => {
	it('rejects an API key whose plan quota is exhausted before invoking the model', async () => {
		mockRequireAuthenticatedMemberPrincipal.mockResolvedValue(apiKeyPrincipal);
		mockCheckRateLimit.mockResolvedValue({
			allowed: false,
			limit: 200,
			remaining: 0,
			resetTime: new Date('2026-08-01T00:00:00Z'),
			retryAfter: 3600
		});

		const response = await POST(makeEvent());

		expect(response.status).toBe(429);
		expect(response.headers.get('Retry-After')).toBe('3600');
		expect(await response.json()).toEqual({ error: 'API rate limit exceeded' });
		expect(mockCheckRateLimit).toHaveBeenCalledWith('key-1', 'viewer');
		expect(mockGenerateText).not.toHaveBeenCalled();
		expect(mockLogApiUsage).toHaveBeenCalledWith(
			'key-1',
			'/api/ai/classify-roast',
			429,
			expect.any(Number),
			'purvey-test',
			'127.0.0.1'
		);
	});

	it('logs API-key requests after the quota check', async () => {
		mockRequireAuthenticatedMemberPrincipal.mockResolvedValue(apiKeyPrincipal);
		mockCheckRateLimit.mockResolvedValue({
			allowed: true,
			limit: 200,
			remaining: 199,
			resetTime: new Date('2026-08-01T00:00:00Z')
		});

		const response = await POST(makeEvent({}));

		expect(response.status).toBe(400);
		expect(mockCheckRateLimit).toHaveBeenCalledWith('key-1', 'viewer');
		expect(mockLogApiUsage).toHaveBeenCalledWith(
			'key-1',
			'/api/ai/classify-roast',
			400,
			expect.any(Number),
			'purvey-test',
			'127.0.0.1'
		);
	});

	it('leaves trusted session requests outside API-key quota accounting', async () => {
		mockRequireAuthenticatedMemberPrincipal.mockResolvedValue({ authKind: 'session' });

		const response = await POST(makeEvent({}));

		expect(response.status).toBe(400);
		expect(mockCheckRateLimit).not.toHaveBeenCalled();
		expect(mockLogApiUsage).not.toHaveBeenCalled();
	});
});
