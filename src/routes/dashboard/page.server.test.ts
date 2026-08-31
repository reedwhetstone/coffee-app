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

function briefListResponse(rows: Array<Record<string, unknown>>) {
	return {
		data: {
			data: rows,
			meta: {
				resource: 'procurement-briefs',
				namespace: '/v1/procurement/briefs',
				version: 'v1',
				auth: { kind: 'session', role: 'member', apiPlan: null }
			}
		}
	};
}

beforeEach(async () => {
	vi.clearAllMocks();
	mockCatalogList.mockResolvedValue({ data: { data: [] } });
	mockBriefsList.mockResolvedValue(briefListResponse([]));
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
		mockBriefsList.mockResolvedValue(briefListResponse(input.briefRows));
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
		expect(mockBriefsList).not.toHaveBeenCalled();
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

	it('loads tracked lots and canonical briefs for ppiAccess viewers', async () => {
		mockGetTrackedLotSummaries.mockResolvedValue([
			{ catalogId: 7, name: 'Tracked Lot', stocked: true }
		]);
		const result = (await load(
			makeLoadInput({
				role: 'viewer',
				principal: { isAuthenticated: true, userId: 'ppi-1', ppiAccess: true },
				briefRows: [
					{
						id: 'ppi-brief',
						name: 'Kenya brief',
						criteria: { version: 1, country: 'Kenya' },
						cadence: 'manual',
						isActive: true,
						lastRunAt: null,
						createdAt: '2026-07-01T00:00:00Z',
						updatedAt: '2026-07-01T00:00:00Z'
					}
				]
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
		expect(mockBriefsList).toHaveBeenCalledOnce();
		expect(result.activeBriefs).toEqual([
			expect.objectContaining({ id: 'ppi-brief', catalogHref: '/catalog?country=Kenya' })
		]);
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
						criteria: {
							version: 1,
							country: 'Colombia',
							max_price_per_lb: 6,
							stocked_days: 30
						},
						cadence: 'manual',
						isActive: true,
						lastRunAt: null,
						createdAt: '2026-07-01T00:00:00Z',
						updatedAt: '2026-07-01T00:00:00Z'
					}
				]
			})
		)) as {
			activeBriefs: Array<{ id: string; criteriaDescription: string; catalogHref: string }>;
		};

		expect(result.activeBriefs).toHaveLength(1);
		expect(mockBriefsList).toHaveBeenCalledOnce();
		expect(result.activeBriefs[0].catalogHref).toBe(
			'/catalog?country=Colombia&price_per_lb_max=6&stocked_days=30'
		);
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
