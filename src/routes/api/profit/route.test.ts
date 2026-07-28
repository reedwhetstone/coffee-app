import { beforeEach, describe, expect, it, vi } from 'vitest';

const salesMocks = vi.hoisted(() => ({
	getProfitData: vi.fn(),
	recordSale: vi.fn(),
	updateSale: vi.fn(),
	deleteSale: vi.fn()
}));

const parchmentMocks = vi.hoisted(() => ({
	createParchmentServerClient: vi.fn(),
	fetchParchmentSales: vi.fn()
}));

vi.mock('$lib/data/sales.js', () => ({
	getProfitData: salesMocks.getProfitData,
	recordSale: salesMocks.recordSale,
	updateSale: salesMocks.updateSale,
	deleteSale: salesMocks.deleteSale
}));

vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: parchmentMocks.createParchmentServerClient
}));

vi.mock('$lib/server/parchmentSales', () => ({
	fetchParchmentSales: parchmentMocks.fetchParchmentSales
}));

vi.mock('$lib/server/principal', () => ({
	isSessionPrincipal: (principal: { authKind?: string } | undefined) =>
		principal?.authKind === 'session'
}));

import { GET, POST } from './+server';

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

function makeGetEvent(
	authenticated = true,
	options: { principalUserId?: string; cookieUserId?: string; authorization?: string } = {}
) {
	const principalUserId = options.principalUserId ?? 'user-1';
	const cookieUserId = options.cookieUserId ?? principalUserId;
	return {
		request: new Request('https://app.test/api/profit', {
			headers: options.authorization ? { Authorization: options.authorization } : undefined
		}),
		locals: {
			supabase: { direct: true },
			principal: authenticated
				? {
						authKind: 'session',
						isAuthenticated: true,
						userId: principalUserId
					}
				: {
						authKind: 'anonymous',
						isAuthenticated: false,
						userId: null
					},
			safeGetSession: vi.fn().mockResolvedValue(
				authenticated
					? {
							session: { access_token: 'token' },
							user: { id: cookieUserId }
						}
					: { session: null, user: null }
			)
		}
	};
}

describe('/api/profit GET', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('combines paginated Parchment sales with the deferred profit summary', async () => {
		const event = makeGetEvent();
		const client = { sales: { list: vi.fn() } };
		const sales = [
			{
				id: 11,
				green_coffee_inv_id: 7,
				coffee_name: 'Ethiopia Guji',
				wholesale: true,
				purchase_date: '2026-07-01'
			}
		];
		const profit = [{ id: 7, profit: 12 }];
		parchmentMocks.createParchmentServerClient.mockResolvedValue(client);
		parchmentMocks.fetchParchmentSales.mockResolvedValue(sales);
		salesMocks.getProfitData.mockResolvedValue(profit);

		const response = await GET(event as never);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ sales, profit });
		expect(parchmentMocks.createParchmentServerClient).toHaveBeenCalledTimes(1);
		expect(parchmentMocks.createParchmentServerClient).toHaveBeenCalledWith(event, {
			mode: 'session'
		});
		expect(parchmentMocks.fetchParchmentSales).toHaveBeenCalledWith(client);
		expect(salesMocks.getProfitData).toHaveBeenCalledWith(event.locals.supabase, 'user-1');
	});

	it('uses the normalized session principal for both sales and profit on mixed credentials', async () => {
		const event = makeGetEvent(true, {
			principalUserId: 'header-user',
			cookieUserId: 'cookie-user',
			authorization: 'Bearer header-session-token'
		});
		const client = { sales: { list: vi.fn() } };
		parchmentMocks.createParchmentServerClient.mockResolvedValue(client);
		parchmentMocks.fetchParchmentSales.mockResolvedValue([]);
		salesMocks.getProfitData.mockResolvedValue([]);

		const response = await GET(event as never);

		expect(response.status).toBe(200);
		expect(parchmentMocks.createParchmentServerClient).toHaveBeenCalledWith(event, {
			mode: 'session'
		});
		expect(salesMocks.getProfitData).toHaveBeenCalledWith(
			event.locals.supabase,
			'header-user'
		);
		expect(event.locals.safeGetSession).not.toHaveBeenCalled();
	});

	it('rejects unauthenticated requests before creating a Parchment client', async () => {
		const response = await GET(makeGetEvent(false) as never);

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: 'Unauthorized' });
		expect(parchmentMocks.createParchmentServerClient).not.toHaveBeenCalled();
		expect(parchmentMocks.fetchParchmentSales).not.toHaveBeenCalled();
		expect(salesMocks.getProfitData).not.toHaveBeenCalled();
	});
});

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
