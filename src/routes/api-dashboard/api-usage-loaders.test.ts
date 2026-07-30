import { beforeEach, describe, expect, it, vi } from 'vitest';
import { anonymousPrincipal, cookieSessionPrincipal } from '$lib/server/principal.test-utils';

const mockCreateParchmentServerClient = vi.fn();
const mockApiUsageGet = vi.fn();

vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: mockCreateParchmentServerClient
}));

let overview: typeof import('./+page.server');
let analytics: typeof import('./usage/+page.server');

const usage = {
	kind: 'owner_api_key_traffic',
	generatedAt: '2026-07-26T12:00:00Z',
	window: {
		from: '2026-06-27T00:00:00Z',
		to: '2026-07-26T12:00:00Z',
		days: 30,
		recordsReturned: 0,
		recordLimit: 20000,
		truncated: false,
		seriesCoverage: 'complete'
	},
	plan: {
		id: 'viewer',
		monthlyRequestLimitPerKey: 200,
		limitScope: 'api_key',
		unlimited: false
	},
	summary: { monthlyRequests: 0, hourlyRequests: 0, totalKeys: 0, activeKeys: 0 },
	daily: [],
	keys: [],
	bounds: { keyLimit: 100, keysTruncated: false, recentPerKey: 25 }
};

function makeEvent(authenticated = true) {
	return {
		url: new URL('https://app.test/api-dashboard'),
		request: new Request('https://app.test/api-dashboard'),
		fetch: vi.fn(),
		locals: {
			principal: authenticated
				? cookieSessionPrincipal('viewer', {
						user: { id: 'user-1', email: 'user@test.dev' } as never
					})
				: anonymousPrincipal()
		}
	} as never;
}

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();
	mockApiUsageGet.mockResolvedValue({
		data: usage,
		response: new Response(null, { status: 200 })
	});
	mockCreateParchmentServerClient.mockResolvedValue({
		apiUsage: { get: mockApiUsageGet }
	});
	overview = await import('./+page.server');
	analytics = await import('./usage/+page.server');
});

describe('API usage dashboard loaders', () => {
	it('uses the session-only SDK resource for the overview', async () => {
		const event = makeEvent();
		const result = await overview.load(event);

		expect(mockCreateParchmentServerClient).toHaveBeenCalledWith(event, { mode: 'session' });
		expect(mockApiUsageGet).toHaveBeenCalledWith({ days: 30, recentPerKey: 10 });
		expect(result).toEqual(
			expect.objectContaining({
				apiKeys: [],
				usageStats: expect.objectContaining({ monthlyUsage: 0, monthlyLimitPerKey: 200 })
			})
		);
	});

	it('maps a non-success SDK response to a clear closed analytics state', async () => {
		mockApiUsageGet.mockResolvedValue({
			error: { error: { code: 'unauthorized', message: 'Session required' } },
			response: new Response(null, { status: 401 })
		});

		const result = await analytics.load(makeEvent());

		expect(result).toEqual({
			error: 'Failed to load usage analytics',
			apiKeys: [],
			usageData: [],
			dailySummary: [],
			currentStats: null,
			bounds: null
		});
	});

	it('requests a bounded recent series for the analytics page', async () => {
		const event = makeEvent();
		const result = await analytics.load(event);

		expect(mockCreateParchmentServerClient).toHaveBeenCalledWith(event, { mode: 'session' });
		expect(mockApiUsageGet).toHaveBeenCalledWith({ days: 30, recentPerKey: 25 });
		expect(result).toEqual(
			expect.objectContaining({
				currentStats: expect.objectContaining({
					monthlyUsage: 0,
					monthlyLimitPerKey: 200
				})
			})
		);
	});

	it('uses exact owner key totals even when the bounded key list is incomplete', async () => {
		mockApiUsageGet.mockResolvedValue({
			data: {
				...usage,
				summary: { ...usage.summary, totalKeys: 125, activeKeys: 110 },
				bounds: { ...usage.bounds, keysTruncated: true }
			},
			response: new Response(null, { status: 200 })
		});

		const result = await overview.load(makeEvent());

		expect(result).toEqual(
			expect.objectContaining({
				apiKeys: [],
				usageStats: expect.objectContaining({
					totalKeys: 125,
					activeKeys: 110,
					quotaCoverage: 'keys_truncated',
					highestKeyQuota: null
				})
			})
		);
	});

	it('redirects unauthenticated callers before creating an SDK client', async () => {
		await expect(overview.load(makeEvent(false))).rejects.toMatchObject({
			status: 303,
			location: '/'
		});
		expect(mockCreateParchmentServerClient).not.toHaveBeenCalled();
	});
});
