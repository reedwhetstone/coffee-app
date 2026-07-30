import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockBackfillNullMilestones = vi.fn();
const authMocks = vi.hoisted(() => {
	class AuthError extends Error {
		constructor(
			message: string,
			public status = 401
		) {
			super(message);
			this.name = 'AuthError';
		}
	}

	return {
		AuthError,
		requireMemberRole: vi.fn()
	};
});

vi.mock('$lib/server/auth', () => authMocks);

vi.mock('$lib/services/milestoneCalculationService', () => ({
	createMilestoneCalculationService: () => ({
		backfillNullMilestones: mockBackfillNullMilestones
	})
}));

const { POST } = await import('./+server');

function makeEvent() {
	return {
		locals: {
			supabase: {}
		},
		request: new Request('https://app.test/api/admin/backfill-milestones', {
			method: 'POST',
			headers: { Origin: 'https://app.test' }
		}),
		url: new URL('https://app.test/api/admin/backfill-milestones')
	} as never;
}

beforeEach(() => {
	vi.clearAllMocks();
	mockBackfillNullMilestones.mockResolvedValue({ updated: 2, skipped: 1 });
});

describe('POST /api/admin/backfill-milestones', () => {
	it('requires an authenticated session', async () => {
		authMocks.requireMemberRole.mockRejectedValue(
			new authMocks.AuthError('Authentication required')
		);
		const response = await POST(makeEvent());

		expect(response.status).toBe(401);
		expect(mockBackfillNullMilestones).not.toHaveBeenCalled();
	});

	it('rejects a canonical viewer principal', async () => {
		authMocks.requireMemberRole.mockRejectedValue(
			new authMocks.AuthError('Member role required', 403)
		);
		const response = await POST(makeEvent());

		expect(response.status).toBe(403);
		expect(mockBackfillNullMilestones).not.toHaveBeenCalled();
	});

	it.each(['member', 'admin'] as const)('allows a canonical %s principal', async (role) => {
		authMocks.requireMemberRole.mockResolvedValue({
			user: { id: 'user-123' },
			role,
			principal: { primaryAppRole: role }
		});
		const event = makeEvent();
		const response = await POST(event);

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ success: true, stats: { updated: 2 } });
		expect(mockBackfillNullMilestones).toHaveBeenCalledOnce();
		expect(authMocks.requireMemberRole).toHaveBeenCalledWith(event);
	});
});
