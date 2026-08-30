import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cookieSessionPrincipal } from '$lib/server/principal.test-utils';
import type { UserRole } from '$lib/types/auth.types';

const mockCatalogList = vi.fn();
const mockBriefsList = vi.fn();
const mockCreateParchmentServerClient = vi.fn();
const mockGetTrackedLotSummaries = vi.fn();

vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: (...args: unknown[]) => mockCreateParchmentServerClient(...args)
}));

vi.mock('$lib/server/trackedLots', () => ({
	getTrackedLotSummaries: (...args: unknown[]) => mockGetTrackedLotSummaries(...args)
}));

let load: typeof import('./+page.server').load;

beforeEach(async () => {
	vi.clearAllMocks();
	mockCatalogList.mockResolvedValue({ data: { data: [] } });
	mockBriefsList.mockResolvedValue({ data: { data: [] } });
	mockCreateParchmentServerClient.mockResolvedValue({
		catalog: { list: mockCatalogList },
		procurement: { briefs: { list: mockBriefsList } }
	});
	mockGetTrackedLotSummaries.mockResolvedValue([]);
	({ load } = await import('./+page.server'));
});

function makeLoadInput(input: {
	role: string;
	principal: { isAuthenticated: true; userId: string; ppiAccess: boolean } | null;
	briefRows?: Array<Record<string, unknown>>;
}) {
	if (input.briefRows) {
		mockBriefsList.mockResolvedValue({ data: { data: input.briefRows } });
	}

	return {
		locals: {
			supabase: {},
			principal: input.principal
				? cookieSessionPrincipal(input.role as UserRole, {
						userId: input.principal.userId,
						ppiAccess: input.principal.ppiAccess
					})
				: null
		}
	} as unknown as Parameters<typeof load>[0];
}

describe('/dashboard sourcing workspace load', () => {
	it('loads recent arrivals from Parchment catalog list', async () => {
		mockCatalogList.mockResolvedValue({
			data: { data: [{ id: 1, name: 'Fresh Arrival', stocked: true }] }
		});

		const result = (await load(
			makeLoadInput({
				role: 'viewer',
				principal: { isAuthenticated: true, userId: 'viewer-1', ppiAccess: false }
			})
		)) as { recentArrivals: Array<{ id: number; name: string }> };

		expect(mockCreateParchmentServerClient).toHaveBeenCalledWith(expect.anything());
		expect(mockCatalogList).toHaveBeenCalledWith({
			stocked: 'true',
			sort: 'arrival_date',
			order: 'desc',
			limit: 6
		});
		expect(result.recentArrivals).toEqual([{ id: 1, name: 'Fresh Arrival', stocked: true }]);
	});

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

	it('keeps the dashboard rendering when Parchment arrivals fail', async () => {
		mockCatalogList.mockResolvedValue({ error: { message: 'Parchment unavailable' } });

		const result = (await load(
			makeLoadInput({
				role: 'viewer',
				principal: { isAuthenticated: true, userId: 'viewer-1', ppiAccess: false }
			})
		)) as { recentArrivals: unknown[] };

		expect(result.recentArrivals).toEqual([]);
	});

	it('loads compact tracked-lot summaries for Parchment Intelligence users', async () => {
		mockGetTrackedLotSummaries.mockResolvedValue([
			{ catalogId: 7, name: 'Tracked Lot', stocked: true }
		]);
		const result = (await load(
			makeLoadInput({
				role: 'viewer',
				principal: { isAuthenticated: true, userId: 'ppi-1', ppiAccess: true }
			})
		)) as {
			trackedLots: Array<{ catalogId: number }>;
			activeBriefs: unknown[];
		};

		expect(mockGetTrackedLotSummaries).toHaveBeenCalledWith(
			expect.objectContaining({ catalog: expect.anything() }),
			12
		);
		expect(result.trackedLots).toHaveLength(1);
		expect(mockCatalogList).toHaveBeenCalledTimes(1);
		expect(result.activeBriefs).toEqual([]);
	});

	it('loads active sourcing briefs for Parchment Intelligence users', async () => {
		const result = (await load(
			makeLoadInput({
				role: 'viewer',
				principal: { isAuthenticated: true, userId: 'ppi-1', ppiAccess: true },
				briefRows: [
					{
						id: 'brief-ppi',
						name: 'Ethiopia brief',
						criteria: { version: 1, country: 'Ethiopia' }
					}
				]
			})
		)) as { activeBriefs: Array<{ name: string }> };

		expect(mockBriefsList).toHaveBeenCalledOnce();
		expect(result.activeBriefs).toEqual([expect.objectContaining({ name: 'Ethiopia brief' })]);
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
		expect(mockBriefsList).toHaveBeenCalledOnce();
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
