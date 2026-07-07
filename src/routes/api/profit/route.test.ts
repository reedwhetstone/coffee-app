import { beforeEach, describe, expect, it, vi } from 'vitest';

const salesMocks = vi.hoisted(() => ({
	listSales: vi.fn(),
	getProfitData: vi.fn(),
	recordSale: vi.fn(),
	updateSale: vi.fn(),
	deleteSale: vi.fn()
}));

vi.mock('$lib/data/sales.js', () => ({
	listSales: salesMocks.listSales,
	getProfitData: salesMocks.getProfitData,
	recordSale: salesMocks.recordSale,
	updateSale: salesMocks.updateSale,
	deleteSale: salesMocks.deleteSale
}));

import { POST } from './+server';

function makeEvent(role: 'viewer' | 'member' | 'admin' = 'viewer') {
	return {
		request: new Request('https://app.test/api/profit', {
			method: 'POST',
			body: JSON.stringify({ green_coffee_inv_id: 1 })
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

describe('/api/profit POST role gate', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('rejects viewer sale creation before recording a sale', async () => {
		const response = await POST(makeEvent('viewer') as never);

		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({
			error: 'Mallard Studio membership is required to record sales'
		});
		expect(salesMocks.recordSale).not.toHaveBeenCalled();
	});
});
