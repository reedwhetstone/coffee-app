import { beforeEach, describe, expect, it, vi } from 'vitest';

const salesMocks = vi.hoisted(() => ({
	getProfitData: vi.fn()
}));

const parchmentMocks = vi.hoisted(() => ({
	createParchmentServerClient: vi.fn(),
	fetchParchmentSales: vi.fn(),
	createParchmentSale: vi.fn(),
	updateParchmentSale: vi.fn(),
	deleteParchmentSale: vi.fn()
}));

vi.mock('$lib/data/sales.js', () => ({
	getProfitData: salesMocks.getProfitData
}));

vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: parchmentMocks.createParchmentServerClient
}));

vi.mock('$lib/server/parchmentSales', () => ({
	ParchmentSalesError: class ParchmentSalesError extends Error {
		constructor(
			public status: number,
			public body: unknown
		) {
			super('Parchment sales request failed');
			this.name = 'ParchmentSalesError';
		}
	},
	fetchParchmentSales: parchmentMocks.fetchParchmentSales,
	createParchmentSale: parchmentMocks.createParchmentSale,
	updateParchmentSale: parchmentMocks.updateParchmentSale,
	deleteParchmentSale: parchmentMocks.deleteParchmentSale
}));

vi.mock('$lib/server/principal', () => ({
	isSessionPrincipal: (principal: { authKind?: string } | undefined) =>
		principal?.authKind === 'session'
}));

import { ParchmentSalesError } from '$lib/server/parchmentSales';
import { DELETE, GET, POST, PUT } from './+server';

function makeEvent(
	method: 'GET' | 'POST' | 'PUT' | 'DELETE',
	options: {
		role?: 'viewer' | 'member' | 'admin';
		id?: string;
		body?: Record<string, unknown>;
		authenticated?: boolean;
		authorization?: string;
		idempotencyKey?: string;
	} = {}
) {
	const authenticated = options.authenticated ?? true;
	const headers = new Headers();
	if (options.authorization) headers.set('Authorization', options.authorization);
	if (options.idempotencyKey) headers.set('Idempotency-Key', options.idempotencyKey);
	if (options.body) headers.set('Content-Type', 'application/json');
	const url = new URL('https://app.test/api/profit');
	if (options.id !== undefined) url.searchParams.set('id', options.id);

	return {
		url,
		request: new Request(url, {
			method,
			headers,
			body: options.body ? JSON.stringify(options.body) : undefined
		}),
		locals: {
			role: options.role ?? 'viewer',
			supabase: { direct: true },
			session: authenticated ? { access_token: 'cookie-token' } : null,
			principal: authenticated
				? {
						authKind: 'session',
						source: options.authorization ? 'bearer-session' : 'cookie-session',
						isAuthenticated: true,
						userId: 'user-1'
					}
				: {
						authKind: 'anonymous',
						source: 'none',
						isAuthenticated: false,
						userId: null
					},
			safeGetSession: vi.fn()
		}
	};
}

describe('/api/profit GET', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('combines paginated Parchment sales with the deferred profit summary', async () => {
		const event = makeEvent('GET');
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
		expect(parchmentMocks.createParchmentServerClient).toHaveBeenCalledWith(event, {
			mode: 'session'
		});
		expect(parchmentMocks.fetchParchmentSales).toHaveBeenCalledWith(client);
		expect(salesMocks.getProfitData).toHaveBeenCalledWith(event.locals.supabase, 'user-1');
	});

	it('rejects mixed bearer and cookie credentials before either query', async () => {
		const event = makeEvent('GET', { authorization: 'Bearer header-session-token' });

		const response = await GET(event as never);

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: 'Unauthorized' });
		expect(parchmentMocks.createParchmentServerClient).not.toHaveBeenCalled();
		expect(parchmentMocks.fetchParchmentSales).not.toHaveBeenCalled();
		expect(salesMocks.getProfitData).not.toHaveBeenCalled();
	});
});

describe('/api/profit sales mutations', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		parchmentMocks.createParchmentServerClient.mockResolvedValue({ sales: {} });
	});

	it('rejects viewer sale creation before creating a Parchment client', async () => {
		const response = await POST(
			makeEvent('POST', {
				role: 'viewer',
				body: { green_coffee_inv_id: 1, oz_sold: 8, price: 12 }
			}) as never
		);

		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({
			error: 'Mallard Studio membership is required to record sales'
		});
		expect(parchmentMocks.createParchmentServerClient).not.toHaveBeenCalled();
		expect(parchmentMocks.createParchmentSale).not.toHaveBeenCalled();
	});

	it('creates a sale through Parchment and forwards a stable idempotency key', async () => {
		const event = makeEvent('POST', {
			role: 'member',
			idempotencyKey: 'sale-create-1',
			body: {
				green_coffee_inv_id: 7,
				oz_sold: 12,
				price: 24,
				buyer: 'Cafe',
				batch_name: 'Batch 7',
				sell_date: '2026-07-28',
				coffee_name: 'computed',
				user: 'attacker'
			}
		});
		const created = { id: 31, green_coffee_inv_id: 7, coffee_name: 'Ethiopia Guji' };
		parchmentMocks.createParchmentSale.mockResolvedValue(created);

		const response = await POST(event as never);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual(created);
		expect(parchmentMocks.createParchmentServerClient).toHaveBeenCalledWith(event, {
			mode: 'session'
		});
		expect(parchmentMocks.createParchmentSale).toHaveBeenCalledWith(
			{ sales: {} },
			{
				greenCoffeeInvId: 7,
				ozSold: 12,
				price: 24,
				buyer: 'Cafe',
				batchName: 'Batch 7',
				sellDate: '2026-07-28'
			},
			'sale-create-1'
		);
	});

	it('updates only supported sale fields through Parchment', async () => {
		const event = makeEvent('PUT', {
			id: '31',
			body: {
				oz_sold: 16,
				price: 30,
				buyer: 'New buyer',
				batch_name: null,
				sell_date: '2026-07-29',
				green_coffee_inv_id: 999,
				user: 'attacker',
				coffee_name: 'computed'
			}
		});
		const updated = { id: 31, oz_sold: 16, batch_name: '' };
		parchmentMocks.updateParchmentSale.mockResolvedValue(updated);

		const response = await PUT(event as never);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual(updated);
		expect(parchmentMocks.updateParchmentSale).toHaveBeenCalledWith({ sales: {} }, 31, {
			ozSold: 16,
			price: 30,
			buyer: 'New buyer',
			batchName: '',
			sellDate: '2026-07-29'
		});
	});

	it('deletes a sale through Parchment', async () => {
		const event = makeEvent('DELETE', { id: '31' });

		const response = await DELETE(event as never);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ success: true });
		expect(parchmentMocks.deleteParchmentSale).toHaveBeenCalledWith({ sales: {} }, 31);
	});

	it.each([
		['PUT', PUT],
		['POST', POST],
		['DELETE', DELETE]
	] as const)('rejects mixed credentials before the %s mutation', async (method, handler) => {
		const event = makeEvent(method, {
			role: 'member',
			id: '31',
			authorization: 'Bearer header-session-token',
			body: method === 'DELETE' ? undefined : { green_coffee_inv_id: 7, oz_sold: 8, price: 12 }
		});

		const response = await handler(event as never);

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: 'Unauthorized' });
		expect(parchmentMocks.createParchmentServerClient).not.toHaveBeenCalled();
	});

	it('preserves Parchment status, message, and code', async () => {
		const event = makeEvent('DELETE', { id: '31' });
		parchmentMocks.deleteParchmentSale.mockRejectedValue(
			new ParchmentSalesError(404, {
				error: { code: 'not_found', message: 'Sale not found' }
			})
		);

		const response = await DELETE(event as never);

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: 'Sale not found', code: 'not_found' });
	});

	it.each(['missing', '0', '-1', 'abc'])(
		'rejects invalid sale id %s before Parchment',
		async (id) => {
			const response = await DELETE(
				makeEvent('DELETE', { id: id === 'missing' ? undefined : id }) as never
			);

			expect(response.status).toBe(400);
			expect(await response.json()).toEqual({ error: 'A positive sale ID is required' });
			expect(parchmentMocks.createParchmentServerClient).not.toHaveBeenCalled();
			expect(parchmentMocks.deleteParchmentSale).not.toHaveBeenCalled();
		}
	);
});
