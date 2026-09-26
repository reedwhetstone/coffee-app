import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
	access: vi.fn(),
	client: vi.fn(),
	tracked: vi.fn(),
	catalog: vi.fn()
}));
vi.mock('$lib/server/auth', () => ({
	requireParchmentAccess: mocks.access,
	AuthError: class AuthError extends Error {
		status = 403;
	}
}));
vi.mock('$lib/server/parchmentClient', () => ({ createParchmentServerClient: mocks.client }));
vi.mock('$lib/server/trackedLots', () => ({ getTrackedLotSummaries: mocks.tracked }));
vi.mock('$lib/server/parchmentCatalog', () => ({ fetchParchmentCatalogItemsByIds: mocks.catalog }));
import { GET } from './+server';
import { AuthError } from '$lib/server/auth';
beforeEach(() => {
	vi.clearAllMocks();
	mocks.access.mockResolvedValue({});
	mocks.client.mockResolvedValue({});
	mocks.tracked.mockResolvedValue([{ catalogId: 7 }]);
	mocks.catalog.mockResolvedValue([{ id: 7 }]);
});
describe('lazy watchlist read', () => {
	it('loads only authorized session context and never caches it publicly', async () => {
		const event = {} as Parameters<typeof GET>[0];
		const response = await GET(event);
		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(await response.json()).toEqual({
			trackedLots: [{ catalogId: 7 }],
			trackedCatalog: [{ id: 7 }]
		});
		expect(mocks.client).toHaveBeenCalledWith(event, { mode: 'session' });
		expect(mocks.tracked).toHaveBeenCalledWith({}, 100);
	});
	it('does not read data before access is granted', async () => {
		mocks.access.mockRejectedValueOnce(new AuthError('Denied', 403));
		const response = await GET({} as Parameters<typeof GET>[0]);
		expect(response.status).toBe(403);
		expect(mocks.client).not.toHaveBeenCalled();
	});
	it('preserves failure rather than pretending the watchlist is empty', async () => {
		mocks.tracked.mockRejectedValueOnce(new Error('Unavailable'));
		const response = await GET({} as Parameters<typeof GET>[0]);
		expect(response.status).toBe(502);
		expect((await response.json()).error).toBeTruthy();
	});
});
