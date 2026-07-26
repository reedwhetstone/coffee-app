import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	mockGetPageAuthState,
	mockCreateParchmentServerClient,
	mockGetTrackedLotSummaries,
	mockFetchParchmentCatalogItemsByIds
} = vi.hoisted(() => ({
	mockGetPageAuthState: vi.fn(),
	mockCreateParchmentServerClient: vi.fn(),
	mockGetTrackedLotSummaries: vi.fn(),
	mockFetchParchmentCatalogItemsByIds: vi.fn()
}));

vi.mock('$lib/server/pageAuth', () => ({ getPageAuthState: mockGetPageAuthState }));
vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: mockCreateParchmentServerClient
}));
vi.mock('$lib/server/trackedLots', () => ({
	getTrackedLotSummaries: mockGetTrackedLotSummaries
}));
vi.mock('$lib/server/parchmentCatalog', () => ({
	fetchParchmentCatalogItemsByIds: mockFetchParchmentCatalogItemsByIds
}));

let load: typeof import('./+page.server').load;

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();
	mockGetPageAuthState.mockReturnValue({ user: { id: 'user-1' }, role: 'member' });
	mockCreateParchmentServerClient.mockResolvedValue({ kind: 'session-client' });
	mockGetTrackedLotSummaries.mockResolvedValue([{ catalogId: 7, name: 'Tracked lot' }]);
	mockFetchParchmentCatalogItemsByIds.mockResolvedValue([{ id: 7, name: 'Tracked lot' }]);
	({ load } = await import('./+page.server'));
});

function makeEvent() {
	return {
		locals: {
			principal: { isAuthenticated: true, userId: 'user-1', ppiAccess: false },
			session: { access_token: 'session-token' }
		}
	} as unknown as Parameters<typeof load>[0];
}

describe('/beans tracked-lot context', () => {
	it('reuses one request-bound Parchment client for summaries and catalog hydration', async () => {
		const result = (await load(makeEvent())) as {
			trackedLots: Array<{ catalogId: number }>;
			trackedCatalog: Array<{ id: number }>;
		};

		expect(mockCreateParchmentServerClient).toHaveBeenCalledOnce();
		expect(mockCreateParchmentServerClient).toHaveBeenCalledWith(expect.anything(), {
			mode: 'session'
		});
		expect(mockGetTrackedLotSummaries).toHaveBeenCalledWith({ kind: 'session-client' }, 100);
		expect(mockFetchParchmentCatalogItemsByIds).toHaveBeenCalledWith({ kind: 'session-client' }, [
			7
		]);
		expect(result.trackedLots).toHaveLength(1);
		expect(result.trackedCatalog).toHaveLength(1);
	});

	it('degrades tracked-lot enrichment to empty when Parchment fails', async () => {
		mockGetTrackedLotSummaries.mockRejectedValue(new Error('Parchment unavailable'));
		const result = (await load(makeEvent())) as {
			trackedLots: unknown[];
			trackedCatalog: unknown[];
		};

		expect(result.trackedLots).toEqual([]);
		expect(result.trackedCatalog).toEqual([]);
	});
});
