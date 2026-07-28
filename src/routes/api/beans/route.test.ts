import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => {
	class MockAuthError extends Error {
		constructor(
			message: string,
			public status = 401
		) {
			super(message);
			this.name = 'AuthError';
		}
	}

	return {
		AuthError: MockAuthError,
		getUserRoles: vi.fn(),
		requireParchmentAccess: vi.fn()
	};
});

const dataMocks = vi.hoisted(() => ({
	buildGreenCoffeeQuery: vi.fn(),
	processGreenCoffeeData: vi.fn((rows: unknown[]) => rows),
	stripRoastProfileData: vi.fn((rows: Array<Record<string, unknown>>) =>
		rows.map((row) => ({ ...row, roast_profiles: [] }))
	),
	addToInventory: vi.fn(),
	updateInventory: vi.fn()
}));

const parchmentMocks = vi.hoisted(() => {
	class MockParchmentConfigError extends Error {}

	return {
		ParchmentConfigError: MockParchmentConfigError,
		createParchmentServerClient: vi.fn(),
		fetchParchmentInventoryProjection: vi.fn(),
		inventoryDelete: vi.fn(),
		createManualBatch: vi.fn(),
		getManualBatch: vi.fn()
	};
});

vi.mock('$lib/server/auth', () => ({
	AuthError: authMocks.AuthError,
	getUserRoles: authMocks.getUserRoles,
	requireParchmentAccess: authMocks.requireParchmentAccess
}));

vi.mock('$lib/server/greenCoffeeUtils.js', () => ({
	buildGreenCoffeeQuery: dataMocks.buildGreenCoffeeQuery,
	processGreenCoffeeData: dataMocks.processGreenCoffeeData,
	stripRoastProfileData: dataMocks.stripRoastProfileData
}));

vi.mock('$lib/data/inventory.js', () => ({
	addToInventory: dataMocks.addToInventory,
	updateInventory: dataMocks.updateInventory
}));

vi.mock('$lib/server/parchmentClient', () => ({
	ParchmentConfigError: parchmentMocks.ParchmentConfigError,
	createParchmentServerClient: parchmentMocks.createParchmentServerClient
}));

vi.mock('$lib/server/parchmentInventory', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/parchmentInventory')>();
	return {
		...actual,
		fetchParchmentInventoryProjection: parchmentMocks.fetchParchmentInventoryProjection
	};
});

import { DELETE, GET, POST, PUT } from './+server';

function makeQuery(data: unknown[] = []) {
	const query = {
		eq: vi.fn(() => query),
		then: vi.fn((resolve: (value: { data: unknown[]; error: null }) => unknown) =>
			resolve({ data, error: null })
		)
	};
	return query;
}

function makeSharedLinksQuery(data: unknown) {
	const query = {
		select: vi.fn(() => query),
		eq: vi.fn(() => query),
		gte: vi.fn(() => query),
		single: vi.fn(async () => ({ data }))
	};
	return query;
}

function makeEvent(path = '/api/beans', init: Partial<RequestInit> = {}) {
	return {
		url: new URL(`https://app.test${path}`),
		request: new Request(`https://app.test${path}`, init),
		locals: {
			supabase: {
				from: vi.fn()
			}
		}
	};
}

describe('/api/beans Portfolio entitlement gating', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		dataMocks.buildGreenCoffeeQuery.mockReturnValue(makeQuery([]));
		authMocks.requireParchmentAccess.mockResolvedValue({
			user: { id: 'ppi-user' },
			ppiAccess: true,
			memberAccess: false
		});
		authMocks.getUserRoles.mockResolvedValue(['viewer']);
		dataMocks.addToInventory.mockResolvedValue({ id: 1 });
		dataMocks.updateInventory.mockResolvedValue({ id: 1 });
		parchmentMocks.inventoryDelete.mockResolvedValue({
			data: { data: { id: 1, deleted: true } }
		});
		parchmentMocks.createParchmentServerClient.mockResolvedValue({
			kind: 'parchment-client',
			inventory: {
				delete: parchmentMocks.inventoryDelete,
				createManualBatch: parchmentMocks.createManualBatch,
				getManualBatch: parchmentMocks.getManualBatch
			}
		});
		parchmentMocks.fetchParchmentInventoryProjection.mockResolvedValue([]);
		const batchResult = {
			data: {
				data: {
					batchId: '00000000-0000-4000-8000-000000000001',
					items: [
						{
							rowId: '00000000-0000-4000-8000-000000000002',
							resource: {
								id: 42,
								catalog_id: 99,
								coffee_catalog: {
									id: 99,
									name: 'Private lot',
									public_coffee: false,
									ai_tasting_notes: ['Peach', 'Floral']
								}
							}
						}
					]
				}
			},
			error: undefined,
			response: new Response(null, { status: 201 })
		};
		parchmentMocks.createManualBatch.mockResolvedValue(batchResult);
		parchmentMocks.getManualBatch.mockResolvedValue({
			...batchResult,
			response: new Response(null, { status: 200 })
		});
	});

	it('requires Parchment Intelligence or Mallard Studio access for user-owned reads', async () => {
		authMocks.requireParchmentAccess.mockRejectedValue(
			new authMocks.AuthError('Parchment Intelligence or Mallard Studio access required', 403)
		);

		const response = await GET(makeEvent() as never);

		expect(response.status).toBe(403);
		expect(await response.json()).toMatchObject({
			error: 'Parchment Intelligence or Mallard Studio access required'
		});
	});

	it('preserves share-token reads without requiring Portfolio entitlement', async () => {
		const sharedLinksQuery = makeSharedLinksQuery(null);
		const event = makeEvent('/api/beans?share=token') as ReturnType<typeof makeEvent>;
		event.locals.supabase.from = vi.fn(() => sharedLinksQuery);

		const response = await GET(event as never);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ data: [] });
		expect(authMocks.requireParchmentAccess).not.toHaveBeenCalled();
		expect(authMocks.getUserRoles).not.toHaveBeenCalled();
	});

	it('strips roast history from share reads when the owner is not a Mallard Studio member', async () => {
		const query = makeQuery([{ id: 1, roast_profiles: [{ roast_id: 10 }] }]);
		const sharedLinksQuery = makeSharedLinksQuery({ user_id: 'ppi-owner', resource_id: 'all' });
		dataMocks.buildGreenCoffeeQuery.mockReturnValue(query);
		authMocks.getUserRoles.mockResolvedValue(['viewer']);

		const event = makeEvent('/api/beans?share=token') as ReturnType<typeof makeEvent>;
		event.locals.supabase.from = vi.fn(() => sharedLinksQuery);

		const response = await GET(event as never);

		expect(response.status).toBe(200);
		expect(authMocks.requireParchmentAccess).not.toHaveBeenCalled();
		expect(authMocks.getUserRoles).toHaveBeenCalledWith(event.locals.supabase, 'ppi-owner');
		expect(query.eq).toHaveBeenCalledWith('user', 'ppi-owner');
		expect(dataMocks.stripRoastProfileData).toHaveBeenCalledWith([
			{ id: 1, roast_profiles: [{ roast_id: 10 }] }
		]);
		expect(await response.json()).toMatchObject({ data: [{ id: 1, roast_profiles: [] }] });
	});

	it('keeps roast history in share reads when the owner is a Mallard Studio member', async () => {
		const roastProfiles = [{ roast_id: 10 }];
		const query = makeQuery([{ id: 1, roast_profiles: roastProfiles }]);
		const sharedLinksQuery = makeSharedLinksQuery({ user_id: 'member-owner', resource_id: 1 });
		dataMocks.buildGreenCoffeeQuery.mockReturnValue(query);
		authMocks.getUserRoles.mockResolvedValue(['member']);

		const event = makeEvent('/api/beans?share=token') as ReturnType<typeof makeEvent>;
		event.locals.supabase.from = vi.fn(() => sharedLinksQuery);

		const response = await GET(event as never);

		expect(response.status).toBe(200);
		expect(query.eq).toHaveBeenCalledWith('id', 1);
		expect(dataMocks.stripRoastProfileData).not.toHaveBeenCalled();
		expect(await response.json()).toMatchObject({
			data: [{ id: 1, roast_profiles: roastProfiles }]
		});
	});

	it('allows Parchment Intelligence users to read only their own Portfolio rows without roast history', async () => {
		parchmentMocks.fetchParchmentInventoryProjection.mockResolvedValue([
			{ id: 1, roast_profiles: [] }
		]);
		authMocks.requireParchmentAccess.mockResolvedValue({
			user: { id: 'ppi-user' },
			ppiAccess: true,
			memberAccess: false
		});

		const response = await GET(makeEvent() as never);

		expect(response.status).toBe(200);
		expect(parchmentMocks.createParchmentServerClient).toHaveBeenCalledWith(expect.anything(), {
			mode: 'session'
		});
		expect(parchmentMocks.fetchParchmentInventoryProjection).toHaveBeenCalledWith(
			expect.objectContaining({ kind: 'parchment-client' }),
			{ id: undefined, includeRoastProfiles: false }
		);
		expect(dataMocks.buildGreenCoffeeQuery).not.toHaveBeenCalled();
		expect(await response.json()).toMatchObject({ data: [{ id: 1, roast_profiles: [] }] });
	});

	it('keeps roast history in Portfolio reads for Mallard Studio members', async () => {
		const roastProfiles = [{ roast_id: 10 }];
		parchmentMocks.fetchParchmentInventoryProjection.mockResolvedValue([
			{ id: 1, roast_profiles: roastProfiles }
		]);
		authMocks.requireParchmentAccess.mockResolvedValue({
			user: { id: 'member-user' },
			ppiAccess: false,
			memberAccess: true
		});

		const response = await GET(makeEvent('/api/beans?id=1') as never);

		expect(response.status).toBe(200);
		expect(parchmentMocks.fetchParchmentInventoryProjection).toHaveBeenCalledWith(
			expect.objectContaining({ kind: 'parchment-client' }),
			{ id: 1, includeRoastProfiles: true }
		);
		expect(dataMocks.buildGreenCoffeeQuery).not.toHaveBeenCalled();
		expect(await response.json()).toMatchObject({
			data: [{ id: 1, roast_profiles: roastProfiles }]
		});
	});

	it('preserves the legacy closed response when Parchment inventory fails', async () => {
		parchmentMocks.fetchParchmentInventoryProjection.mockRejectedValue(
			new Error('Parchment unavailable')
		);

		const response = await GET(makeEvent() as never);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			data: [],
			error: 'Failed to fetch beans'
		});
		expect(dataMocks.buildGreenCoffeeQuery).not.toHaveBeenCalled();
	});

	it('requires Portfolio entitlement for create, update, and delete writes', async () => {
		authMocks.requireParchmentAccess.mockRejectedValue(
			new authMocks.AuthError('Parchment Intelligence or Mallard Studio access required', 403)
		);

		const post = await POST(
			makeEvent('/api/beans', {
				method: 'POST',
				body: JSON.stringify({ catalog_id: 1 })
			}) as never
		);
		const put = await PUT(
			makeEvent('/api/beans?id=1', {
				method: 'PUT',
				body: JSON.stringify({ notes: 'test' })
			}) as never
		);
		const del = await DELETE(makeEvent('/api/beans?id=1', { method: 'DELETE' }) as never);

		expect(post.status).toBe(403);
		expect(put.status).toBe(403);
		expect(del.status).toBe(403);
		expect(dataMocks.addToInventory).not.toHaveBeenCalled();
		expect(dataMocks.updateInventory).not.toHaveBeenCalled();
		expect(parchmentMocks.inventoryDelete).not.toHaveBeenCalled();
	});

	it('creates one manual batch through the session SDK and preserves the beans projection', async () => {
		const batchId = '00000000-0000-4000-8000-000000000001';
		const body = {
			purchaseDate: '2026-07-28',
			taxShipTotal: 3.25,
			notes: 'Direct trade samples',
			items: [
				{
					rowId: '00000000-0000-4000-8000-000000000002',
					manualCoffee: { name: 'Private lot', region: 'Huila' },
					qty: 5,
					cost: 42.5
				}
			]
		};
		const event = makeEvent('/api/beans', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Idempotency-Key': batchId
			},
			body: JSON.stringify(body)
		});

		const response = await POST(event as never);

		expect(response.status).toBe(201);
		expect(parchmentMocks.createParchmentServerClient).toHaveBeenCalledWith(expect.anything(), {
			mode: 'session'
		});
		expect(parchmentMocks.createManualBatch).toHaveBeenCalledWith(body, {
			idempotencyKey: batchId
		});
		expect(event.locals.supabase.from).not.toHaveBeenCalled();
		expect(dataMocks.addToInventory).not.toHaveBeenCalled();
		expect(await response.json()).toEqual([
			expect.objectContaining({
				id: 42,
				catalog_id: 99,
				ai_tasting_notes: '["Peach","Floral"]',
				coffee_catalog: expect.objectContaining({
					id: 99,
					name: 'Private lot',
					ai_tasting_notes: '["Peach","Floral"]'
				}),
				roast_profiles: []
			})
		]);
	});

	it('requires a browser-stable batch UUID before calling Parchment', async () => {
		const response = await POST(
			makeEvent('/api/beans', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ items: [] })
			}) as never
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: 'Idempotency-Key is required for manual inventory batches'
		});
		expect(parchmentMocks.createParchmentServerClient).not.toHaveBeenCalled();
		expect(parchmentMocks.createManualBatch).not.toHaveBeenCalled();
	});

	it('preserves the full legacy scalar manual compatibility contract', async () => {
		const catalogInsertQuery = {
			insert: vi.fn(() => catalogInsertQuery),
			select: vi.fn(() => catalogInsertQuery),
			eq: vi.fn(() => catalogInsertQuery),
			single: vi.fn(async () => ({ data: { id: 99 }, error: null }))
		};
		const event = makeEvent('/api/beans', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				manual_name: 'Legacy private lot',
				purchase_date: '2026-07-28',
				purchased_qty_lbs: 2,
				bean_cost: 18,
				tax_ship_cost: 1.25,
				region: 'Huila',
				rank: 4,
				stocked: false,
				cupping_notes: { aroma: 8 },
				price_per_lb: 9.5,
				price_tiers: [{ min_lbs: 1, price: 9.5 }],
				ai_description: 'Floral and sweet',
				ai_tasting_notes: ['Peach', 'Jasmine']
			})
		});
		event.locals.supabase.from = vi.fn(() => catalogInsertQuery);
		dataMocks.addToInventory.mockResolvedValueOnce({ id: 42, catalog_id: 99 });
		const response = await POST(event as never);

		expect(response.status).toBe(200);
		expect(catalogInsertQuery.insert).toHaveBeenCalledWith(
			expect.objectContaining({
				name: 'Legacy private lot',
				coffee_user: 'ppi-user',
				public_coffee: false,
				region: 'Huila',
				cupping_notes: { aroma: 8 },
				price_per_lb: 9.5,
				price_tiers: [{ min_lbs: 1, price: 9.5 }],
				ai_description: 'Floral and sweet',
				ai_tasting_notes: ['Peach', 'Jasmine']
			})
		);
		expect(dataMocks.addToInventory).toHaveBeenCalledWith(event.locals.supabase, 'ppi-user', {
			catalog_id: 99,
			rank: 4,
			notes: undefined,
			purchase_date: '2026-07-28',
			purchased_qty_lbs: 2,
			bean_cost: 18,
			tax_ship_cost: 1.25,
			stocked: false,
			cupping_notes: { aroma: 8 }
		});
		expect(parchmentMocks.createManualBatch).not.toHaveBeenCalled();
		expect(await response.json()).toEqual(expect.objectContaining({ id: 42, catalog_id: 99 }));
	});

	it('reconciles an uncertain manual batch through its durable batch UUID', async () => {
		const batchId = '00000000-0000-4000-8000-000000000001';

		const response = await GET(makeEvent(`/api/beans?manualBatchId=${batchId}`) as never);

		expect(response.status).toBe(200);
		expect(parchmentMocks.getManualBatch).toHaveBeenCalledWith(batchId);
		expect(parchmentMocks.fetchParchmentInventoryProjection).not.toHaveBeenCalled();
		expect(await response.json()).toEqual([
			expect.objectContaining({
				id: 42,
				catalog_id: 99,
				roast_profiles: []
			})
		]);
	});

	it('preserves Parchment reconciliation status and error details', async () => {
		parchmentMocks.getManualBatch.mockResolvedValue({
			data: undefined,
			error: {
				error: {
					code: 'not_found',
					message: 'Manual inventory batch not found'
				}
			},
			response: new Response(null, { status: 404 })
		});

		const response = await GET(
			makeEvent('/api/beans?manualBatchId=00000000-0000-4000-8000-000000000009') as never
		);

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({
			error: 'Manual inventory batch not found',
			code: 'not_found'
		});
	});

	it('returns a failure for unexpected reconciliation errors', async () => {
		parchmentMocks.getManualBatch.mockRejectedValue(new TypeError('Response decoding failed'));

		const response = await GET(
			makeEvent('/api/beans?manualBatchId=00000000-0000-4000-8000-000000000009') as never
		);

		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({
			data: [],
			error: 'Failed to reconcile manual inventory batch'
		});
	});

	it('preserves Parchment batch rejection status and error details', async () => {
		parchmentMocks.createManualBatch.mockResolvedValue({
			data: undefined,
			error: {
				error: {
					code: 'idempotency_conflict',
					message: 'Batch UUID belongs to another request'
				}
			},
			response: new Response(null, { status: 409 })
		});

		const response = await POST(
			makeEvent('/api/beans', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Idempotency-Key': '00000000-0000-4000-8000-000000000001'
				},
				body: JSON.stringify({
					items: [
						{
							rowId: '00000000-0000-4000-8000-000000000002',
							manualCoffee: { name: 'Private lot' },
							qty: 5
						}
					]
				})
			}) as never
		);

		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({
			error: 'Batch UUID belongs to another request',
			code: 'idempotency_conflict'
		});
	});

	it('keeps catalog-backed creation on the existing path', async () => {
		const catalogQuery = {
			select: vi.fn(() => catalogQuery),
			eq: vi.fn(() => catalogQuery),
			single: vi.fn(async () => ({ data: { id: 7 }, error: null }))
		};
		const event = makeEvent('/api/beans', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ catalog_id: 7, purchased_qty_lbs: 5 })
		});
		event.locals.supabase.from = vi.fn(() => catalogQuery);

		const response = await POST(event as never);

		expect(response.status).toBe(200);
		expect(parchmentMocks.createManualBatch).not.toHaveBeenCalled();
		expect(dataMocks.addToInventory).toHaveBeenCalledWith(
			event.locals.supabase,
			'ppi-user',
			expect.objectContaining({ catalog_id: 7, purchased_qty_lbs: 5 })
		);
	});

	it('deletes through a session-mode Parchment client and preserves the legacy success envelope', async () => {
		const response = await DELETE(makeEvent('/api/beans?id=1', { method: 'DELETE' }) as never);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ success: true });
		expect(authMocks.requireParchmentAccess).toHaveBeenCalledOnce();
		expect(parchmentMocks.createParchmentServerClient).toHaveBeenCalledWith(expect.anything(), {
			mode: 'session'
		});
		expect(parchmentMocks.inventoryDelete).toHaveBeenCalledWith(1);
	});

	it.each([
		['missing', '/api/beans'],
		['non-numeric', '/api/beans?id=abc'],
		['zero', '/api/beans?id=0'],
		['negative', '/api/beans?id=-1'],
		['decimal', '/api/beans?id=1.5'],
		['outside PostgreSQL int4', '/api/beans?id=2147483648']
	])('returns 400 for a %s inventory ID', async (_case, path) => {
		const response = await DELETE(makeEvent(path, { method: 'DELETE' }) as never);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			success: false,
			error: 'Invalid or missing inventory ID'
		});
		expect(parchmentMocks.createParchmentServerClient).not.toHaveBeenCalled();
		expect(parchmentMocks.inventoryDelete).not.toHaveBeenCalled();
	});

	it('returns 403 without constructing a Parchment client when access is denied', async () => {
		authMocks.requireParchmentAccess.mockRejectedValue(
			new authMocks.AuthError('Parchment Intelligence or Mallard Studio access required', 403)
		);

		const response = await DELETE(makeEvent('/api/beans?id=1', { method: 'DELETE' }) as never);

		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({
			success: false,
			error: 'Parchment Intelligence or Mallard Studio access required'
		});
		expect(parchmentMocks.createParchmentServerClient).not.toHaveBeenCalled();
	});

	it.each([404, 409, 429, 503])(
		'relays upstream inventory delete status %i and body',
		async (status) => {
			const body = {
				error: {
					code: status === 409 ? 'dependency_conflict' : 'upstream_error',
					message: `Parchment status ${status}`
				}
			};
			parchmentMocks.inventoryDelete.mockResolvedValue({
				error: body,
				response: new Response(null, { status })
			});

			const response = await DELETE(makeEvent('/api/beans?id=1', { method: 'DELETE' }) as never);

			expect(response.status).toBe(status);
			expect(await response.json()).toEqual(body);
		}
	);
});
