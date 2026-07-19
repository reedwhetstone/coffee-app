import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockBackfillNullMilestones = vi.fn();

vi.mock('$lib/services/milestoneCalculationService', () => ({
	createMilestoneCalculationService: () => ({
		backfillNullMilestones: mockBackfillNullMilestones
	})
}));

const { POST } = await import('./+server');

function makeEvent(role: 'viewer' | 'member' | 'admin' | null) {
	const single = vi.fn(async () => ({ data: role ? { role } : null, error: null }));
	const eq = vi.fn(() => ({ single }));
	const select = vi.fn(() => ({ eq }));
	const from = vi.fn(() => ({ select }));
	const user = role === null ? null : { id: 'user-123' };

	return {
		event: {
			locals: {
				supabase: { from },
				safeGetSession: vi.fn(async () => ({
					session: user ? { access_token: 'token' } : null,
					user
				}))
			}
		} as never,
		mocks: { select, eq, single }
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	mockBackfillNullMilestones.mockResolvedValue({ updated: 2, skipped: 1 });
});

describe('POST /api/admin/backfill-milestones', () => {
	it('requires an authenticated session', async () => {
		const { event } = makeEvent(null);
		const response = await POST(event);

		expect(response.status).toBe(401);
		expect(mockBackfillNullMilestones).not.toHaveBeenCalled();
	});

	it('rejects a scalar viewer role', async () => {
		const { event, mocks } = makeEvent('viewer');
		const response = await POST(event);

		expect(response.status).toBe(403);
		expect(mocks.select).toHaveBeenCalledWith('role');
		expect(mockBackfillNullMilestones).not.toHaveBeenCalled();
	});

	it.each(['member', 'admin'] as const)('allows a scalar %s role', async (role) => {
		const { event } = makeEvent(role);
		const response = await POST(event);

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ success: true, stats: { updated: 2 } });
		expect(mockBackfillNullMilestones).toHaveBeenCalledOnce();
	});
});
