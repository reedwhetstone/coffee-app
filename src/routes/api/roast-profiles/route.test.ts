import { beforeEach, describe, expect, it, vi } from 'vitest';

const roastMocks = vi.hoisted(() => ({
	listRoasts: vi.fn(),
	createRoasts: vi.fn(),
	updateRoast: vi.fn(),
	deleteRoast: vi.fn(),
	deleteBatch: vi.fn(),
	updateStockedStatus: vi.fn()
}));

vi.mock('$lib/data/roast.js', () => ({
	listRoasts: roastMocks.listRoasts,
	createRoasts: roastMocks.createRoasts,
	updateRoast: roastMocks.updateRoast,
	deleteRoast: roastMocks.deleteRoast,
	deleteBatch: roastMocks.deleteBatch
}));

vi.mock('$lib/server/stockedStatusUtils', () => ({
	updateStockedStatus: roastMocks.updateStockedStatus
}));

import { POST } from './+server';

function makeEvent(role: 'viewer' | 'member' | 'admin' = 'viewer') {
	return {
		request: new Request('https://app.test/api/roast-profiles', {
			method: 'POST',
			body: JSON.stringify({ coffee_id: 1 })
		}),
		locals: {
			role,
			supabase: {},
			safeGetSession: vi.fn().mockResolvedValue({
				session: { access_token: 'token' },
				user: { id: 'user-1' }
			})
		}
	};
}

describe('/api/roast-profiles POST role gate', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('rejects viewer roast creation before creating roast profiles', async () => {
		const response = await POST(makeEvent('viewer') as never);

		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({
			error: 'Mallard Studio membership is required to create roast profiles'
		});
		expect(roastMocks.createRoasts).not.toHaveBeenCalled();
	});
});
