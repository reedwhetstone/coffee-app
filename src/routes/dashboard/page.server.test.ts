import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSearchCatalog = vi.fn();
const mockGetCatalogItemsByIds = vi.fn();
const mockGetTrackedLotSummaries = vi.fn();

vi.mock('$lib/data/catalog', () => ({
	searchCatalog: (...args: unknown[]) => mockSearchCatalog(...args),
	getCatalogItemsByIds: (...args: unknown[]) => mockGetCatalogItemsByIds(...args)
}));

vi.mock('$lib/server/trackedLots', () => ({
	getTrackedLotSummaries: (...args: unknown[]) => mockGetTrackedLotSummaries(...args)
}));

let load: typeof import('./+page.server').load;

beforeEach(async () => {
	vi.clearAllMocks();
	mockSearchCatalog.mockResolvedValue({ data: [], count: 0 });
	mockGetCatalogItemsByIds.mockResolvedValue([]);
	mockGetTrackedLotSummaries.mockResolvedValue([]);
	({ load } = await import('./+page.server'));
});

function makeBriefsQuery(rows: Array<Record<string, unknown>>) {
	return {
		select: vi.fn().mockReturnThis(),
		eq: vi.fn().mockReturnThis(),
		order: vi.fn().mockReturnThis(),
		limit: vi.fn().mockResolvedValue({ data: rows, error: null })
	};
}

function makeLoadInput(input: {
	role: string;
	principal: { isAuthenticated: true; userId: string; ppiAccess: boolean } | null;
	briefRows?: Array<Record<string, unknown>>;
}) {
	return {
		locals: {
			supabase: { from: vi.fn().mockReturnValue(makeBriefsQuery(input.briefRows ?? [])) },
			role: input.role,
			session: input.principal ? { access_token: 'token' } : null,
			principal: input.principal
		}
	} as unknown as Parameters<typeof load>[0];
}

describe('/dashboard sourcing workspace load', () => {
	it('returns empty workspace context for viewers without sourcing access', async () => {
		const result = (await load(
			makeLoadInput({
				role: 'viewer',
				principal: { isAuthenticated: true, userId: 'viewer-1', ppiAccess: false }
			})
		)) as { trackedLots: unknown[]; activeBriefs: unknown[] };

		expect(result.trackedLots).toEqual([]);
		expect(result.activeBriefs).toEqual([]);
		expect(mockGetTrackedLotSummaries).not.toHaveBeenCalled();
	});

	it('loads tracked lot summaries and their catalog cards for ppiAccess users', async () => {
		mockGetTrackedLotSummaries.mockResolvedValue([
			{ catalogId: 7, name: 'Tracked Lot', stocked: true }
		]);
		mockGetCatalogItemsByIds.mockResolvedValue([{ id: 7, name: 'Tracked Lot' }]);

		const result = (await load(
			makeLoadInput({
				role: 'viewer',
				principal: { isAuthenticated: true, userId: 'ppi-1', ppiAccess: true }
			})
		)) as {
			trackedLots: Array<{ catalogId: number }>;
			trackedCatalog: Array<{ id: number }>;
			activeBriefs: unknown[];
		};

		expect(mockGetTrackedLotSummaries).toHaveBeenCalledWith(expect.anything(), 'ppi-1', 12);
		expect(mockGetCatalogItemsByIds).toHaveBeenCalledWith(expect.anything(), [7]);
		expect(result.trackedLots).toHaveLength(1);
		expect(result.trackedCatalog).toHaveLength(1);
		expect(result.activeBriefs).toEqual([]);
	});

	it('loads tracked lots and active briefs with catalog deep links for members', async () => {
		mockGetTrackedLotSummaries.mockResolvedValue([]);

		const result = (await load(
			makeLoadInput({
				role: 'member',
				principal: { isAuthenticated: true, userId: 'member-1', ppiAccess: false },
				briefRows: [
					{
						id: 'brief-1',
						name: 'Colombia brief',
						criteria: { version: 1, country: 'Colombia', max_price_per_lb: 6 }
					}
				]
			})
		)) as {
			activeBriefs: Array<{ id: string; criteriaDescription: string; catalogHref: string }>;
		};

		expect(result.activeBriefs).toHaveLength(1);
		expect(result.activeBriefs[0].catalogHref).toBe('/catalog?country=Colombia');
		expect(result.activeBriefs[0].criteriaDescription).toContain('Colombia');
	});

	it('keeps the dashboard rendering when sourcing context queries fail', async () => {
		mockGetTrackedLotSummaries.mockRejectedValue(new Error('rls denied'));

		const result = (await load(
			makeLoadInput({
				role: 'member',
				principal: { isAuthenticated: true, userId: 'member-1', ppiAccess: false }
			})
		)) as { trackedLots: unknown[]; activeBriefs: unknown[] };

		expect(result.trackedLots).toEqual([]);
		expect(result.activeBriefs).toEqual([]);
	});
});
