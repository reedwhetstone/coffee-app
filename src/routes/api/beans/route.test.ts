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
	)
}));

const parchmentMocks = vi.hoisted(() => {
	class MockParchmentConfigError extends Error {}

	return {
		ParchmentConfigError: MockParchmentConfigError,
		createParchmentServerClient: vi.fn(),
		fetchParchmentInventoryProjection: vi.fn(),
		inventoryUpdate: vi.fn(),
		inventoryDelete: vi.fn(),
		reserveManualBatch: vi.fn(),
		commitManualBatch: vi.fn(),
		getManualBatchStatus: vi.fn(),
		reserveCatalogBatch: vi.fn(),
		commitCatalogBatch: vi.fn(),
		getCatalogBatchStatus: vi.fn()
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
		parchmentMocks.inventoryUpdate.mockResolvedValue({
			data: {
				data: {
					id: 1,
					rank: null,
					notes: 'Updated note',
					cupping_notes: null,
					purchase_date: '2026-07-31',
					purchased_qty_lbs: 6,
					bean_cost: 40,
					tax_ship_cost: 2,
					last_updated: '2026-07-31T18:00:00.000Z',
					user: 'ppi-user',
					catalog_id: 7,
					stocked: true,
					coffee_catalog: null
				}
			}
		});
		parchmentMocks.inventoryDelete.mockResolvedValue({
			data: { data: { id: 1, deleted: true } }
		});
		parchmentMocks.createParchmentServerClient.mockResolvedValue({
			kind: 'parchment-client',
			inventory: {
				update: parchmentMocks.inventoryUpdate,
				delete: parchmentMocks.inventoryDelete,
				reserveManualBatch: parchmentMocks.reserveManualBatch,
				commitManualBatch: parchmentMocks.commitManualBatch,
				getManualBatchStatus: parchmentMocks.getManualBatchStatus,
				reserveCatalogBatch: parchmentMocks.reserveCatalogBatch,
				commitCatalogBatch: parchmentMocks.commitCatalogBatch,
				getCatalogBatchStatus: parchmentMocks.getCatalogBatchStatus
			}
		});
		parchmentMocks.fetchParchmentInventoryProjection.mockResolvedValue([]);
		const manualBatchId = '00000000-0000-4000-8000-000000000001';
		const acceptedManualBatch = {
			data: {
				data: {
					batchId: manualBatchId,
					status: 'accepted',
					result: null,
					error: null,
					updatedAt: '2026-08-29T16:00:00.000Z'
				}
			},
			response: new Response(null, { status: 201 })
		};
		const completedManualBatch = {
			data: {
				data: {
					batchId: manualBatchId,
					status: 'completed',
					result: {
						batchId: manualBatchId,
						items: [
							{
								rowId: '00000000-0000-4000-8000-000000000002',
								resource: { id: 42 }
							}
						]
					},
					error: null,
					updatedAt: '2026-08-29T16:00:01.000Z'
				}
			},
			response: new Response(null, { status: 200 })
		};
		parchmentMocks.reserveManualBatch.mockResolvedValue(acceptedManualBatch);
		parchmentMocks.commitManualBatch.mockResolvedValue(completedManualBatch);
		parchmentMocks.getManualBatchStatus.mockResolvedValue(completedManualBatch);
		const catalogBatchId = '00000000-0000-4000-8000-000000000010';
		const acceptedCatalogBatch = {
			data: {
				data: {
					batchId: catalogBatchId,
					status: 'accepted',
					result: null,
					error: null,
					updatedAt: '2026-08-29T16:00:00.000Z'
				}
			},
			response: new Response(null, { status: 201 })
		};
		const completedCatalogBatch = {
			data: {
				data: {
					batchId: catalogBatchId,
					status: 'completed',
					result: {
						batchId: catalogBatchId,
						items: [
							{
								rowId: '00000000-0000-4000-8000-000000000011',
								inventoryId: 42
							}
						]
					},
					error: null,
					updatedAt: '2026-08-29T16:00:01.000Z'
				}
			},
			response: new Response(null, { status: 200 })
		};
		parchmentMocks.reserveCatalogBatch.mockResolvedValue(acceptedCatalogBatch);
		parchmentMocks.commitCatalogBatch.mockResolvedValue(completedCatalogBatch);
		parchmentMocks.getCatalogBatchStatus.mockResolvedValue(completedCatalogBatch);
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
		expect(parchmentMocks.reserveCatalogBatch).not.toHaveBeenCalled();
		expect(parchmentMocks.inventoryUpdate).not.toHaveBeenCalled();
		expect(parchmentMocks.inventoryDelete).not.toHaveBeenCalled();
	});

	it('reserves one manual batch through the session SDK without reading Supabase', async () => {
		const batchId = '00000000-0000-4000-8000-000000000001';
		const body = {
			batchId,
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
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});

		const response = await POST(event as never);

		expect(response.status).toBe(201);
		expect(parchmentMocks.createParchmentServerClient).toHaveBeenCalledWith(expect.anything(), {
			mode: 'session'
		});
		expect(parchmentMocks.reserveManualBatch).toHaveBeenCalledWith(body);
		expect(event.locals.supabase.from).not.toHaveBeenCalled();
		expect(await response.json()).toMatchObject({ batchId, status: 'accepted' });
	});

	it('requires a browser-stable batch UUID before calling Parchment', async () => {
		const response = await POST(
			makeEvent('/api/beans', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
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

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: 'batchId is required for manual inventory batches'
		});
		expect(parchmentMocks.createParchmentServerClient).not.toHaveBeenCalled();
		expect(parchmentMocks.reserveManualBatch).not.toHaveBeenCalled();
	});

	it('rejects the retired scalar create contract without writing Supabase', async () => {
		const event = makeEvent('/api/beans', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				manual_name: 'Legacy private lot',
				purchased_qty_lbs: 2
			})
		});
		const response = await POST(event as never);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: 'A catalog or manual inventory batch is required'
		});
		expect(event.locals.supabase.from).not.toHaveBeenCalled();
		expect(parchmentMocks.reserveManualBatch).not.toHaveBeenCalled();
		expect(parchmentMocks.reserveCatalogBatch).not.toHaveBeenCalled();
	});

	it('reconciles an uncertain manual batch through its durable batch UUID', async () => {
		const batchId = '00000000-0000-4000-8000-000000000001';

		const response = await GET(makeEvent(`/api/beans?manualBatchId=${batchId}`) as never);

		expect(response.status).toBe(200);
		expect(parchmentMocks.getManualBatchStatus).toHaveBeenCalledWith(batchId);
		expect(parchmentMocks.fetchParchmentInventoryProjection).not.toHaveBeenCalled();
		expect(await response.json()).toMatchObject({ batchId, status: 'completed' });
	});

	it('returns unknown as a nonterminal manual lifecycle', async () => {
		const batchId = '00000000-0000-4000-8000-000000000009';
		parchmentMocks.getManualBatchStatus.mockResolvedValue({
			data: {
				data: {
					batchId,
					status: 'unknown',
					result: null,
					error: null,
					updatedAt: null
				}
			},
			response: new Response(null, { status: 200 })
		});

		const response = await GET(makeEvent(`/api/beans?manualBatchId=${batchId}`) as never);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			batchId,
			status: 'unknown',
			result: null,
			error: null,
			updatedAt: null
		});
	});

	it('returns a failure for unexpected reconciliation errors', async () => {
		parchmentMocks.getManualBatchStatus.mockRejectedValue(
			new TypeError('Response decoding failed')
		);

		const response = await GET(
			makeEvent('/api/beans?manualBatchId=00000000-0000-4000-8000-000000000009') as never
		);

		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({
			data: [],
			error: 'Failed to reconcile inventory batch'
		});
	});

	it('returns a non-2xx response for a malformed successful reconciliation payload', async () => {
		parchmentMocks.getManualBatchStatus.mockResolvedValue({
			data: { data: undefined },
			error: undefined,
			response: new Response(null, { status: 200 })
		});

		const response = await GET(
			makeEvent('/api/beans?manualBatchId=00000000-0000-4000-8000-000000000009') as never
		);

		expect(response.status).toBe(502);
		expect(await response.json()).toEqual({
			error: 'Parchment inventory response did not include a manual batch lifecycle',
			code: 'invalid_response'
		});
	});

	it('preserves Parchment batch rejection status and error details', async () => {
		parchmentMocks.reserveManualBatch.mockResolvedValue({
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
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					batchId: '00000000-0000-4000-8000-000000000001',
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

	it('commits a reserved manual batch through its durable UUID', async () => {
		const batchId = '00000000-0000-4000-8000-000000000001';

		const response = await POST(
			makeEvent(`/api/beans?manualBatchId=${batchId}`, { method: 'POST' }) as never
		);

		expect(response.status).toBe(200);
		expect(parchmentMocks.commitManualBatch).toHaveBeenCalledWith(batchId);
		expect(await response.json()).toMatchObject({ batchId, status: 'completed' });
	});

	it('reserves one catalog batch through the session SDK without reading Supabase', async () => {
		const batchId = '00000000-0000-4000-8000-000000000010';
		const body = {
			batchId,
			purchaseDate: '2026-08-29',
			taxShipTotal: 5.01,
			items: [
				{
					rowId: '00000000-0000-4000-8000-000000000011',
					catalogId: 7,
					qty: 5,
					cost: 40
				}
			]
		};
		const event = makeEvent('/api/beans', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});

		const response = await POST(event as never);

		expect(response.status).toBe(201);
		expect(parchmentMocks.reserveCatalogBatch).toHaveBeenCalledWith(body);
		expect(parchmentMocks.reserveManualBatch).not.toHaveBeenCalled();
		expect(event.locals.supabase.from).not.toHaveBeenCalled();
		expect(await response.json()).toMatchObject({ batchId, status: 'accepted' });
	});

	it('commits and reconciles a catalog batch through its durable UUID', async () => {
		const batchId = '00000000-0000-4000-8000-000000000010';

		const commit = await POST(
			makeEvent(`/api/beans?catalogBatchId=${batchId}`, { method: 'POST' }) as never
		);
		const status = await GET(makeEvent(`/api/beans?catalogBatchId=${batchId}`) as never);

		expect(commit.status).toBe(200);
		expect(status.status).toBe(200);
		expect(parchmentMocks.commitCatalogBatch).toHaveBeenCalledWith(batchId);
		expect(parchmentMocks.getCatalogBatchStatus).toHaveBeenCalledWith(batchId);
		expect(await commit.json()).toMatchObject({ batchId, status: 'completed' });
		expect(await status.json()).toMatchObject({ batchId, status: 'completed' });
	});

	it('updates inventory through the canonical SDK mutation with optimistic concurrency', async () => {
		const event = makeEvent('/api/beans?id=1', {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json',
				'If-Match': '2026-07-31T17:00:00.000Z'
			},
			body: JSON.stringify({
				id: 1,
				catalog_id: 7,
				user: 'ignored-owner',
				last_updated: 'ignored-client-timestamp',
				purchased_qty_lbs: 6,
				purchase_date: '2026-07-30',
				bean_cost: null,
				tax_ship_cost: 3,
				notes: null,
				stocked: true,
				rank: null,
				cupping_notes: ['cocoa']
			})
		});

		const response = await PUT(event as never);

		expect(response.status).toBe(200);
		expect(parchmentMocks.createParchmentServerClient).toHaveBeenCalledWith(expect.anything(), {
			mode: 'session'
		});
		expect(parchmentMocks.inventoryUpdate).toHaveBeenCalledWith(
			1,
			{
				qty: 6,
				purchaseDate: '2026-07-30',
				cost: null,
				taxShip: 3,
				notes: null,
				stocked: true,
				rank: null,
				cuppingNotes: ['cocoa']
			},
			{ ifMatch: '2026-07-31T17:00:00.000Z' }
		);
		expect(event.locals.supabase.from).not.toHaveBeenCalled();
		expect(await response.json()).toEqual(
			expect.objectContaining({
				id: 1,
				purchased_qty_lbs: 6,
				last_updated: '2026-07-31T18:00:00.000Z',
				roast_profiles: []
			})
		);
	});

	it('preserves optimistic-concurrency conflicts from Parchment', async () => {
		parchmentMocks.inventoryUpdate.mockResolvedValue({
			error: {
				error: {
					code: 'precondition_failed',
					message: 'Inventory item changed before this update'
				}
			},
			response: new Response(null, { status: 409 })
		});

		const response = await PUT(
			makeEvent('/api/beans?id=1', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ notes: 'new note' })
			}) as never
		);

		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({
			error: 'Inventory item changed before this update',
			code: 'precondition_failed'
		});
	});

	it.each([
		['missing', '/api/beans'],
		['non-numeric', '/api/beans?id=abc'],
		['zero', '/api/beans?id=0'],
		['outside PostgreSQL int4', '/api/beans?id=2147483648']
	])('rejects a %s update inventory ID before constructing a client', async (_case, path) => {
		const response = await PUT(
			makeEvent(path, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ notes: 'new note' })
			}) as never
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: 'Invalid or missing inventory ID' });
		expect(parchmentMocks.createParchmentServerClient).not.toHaveBeenCalled();
		expect(parchmentMocks.inventoryUpdate).not.toHaveBeenCalled();
	});

	it('rejects a non-object update before constructing a client', async () => {
		const response = await PUT(
			makeEvent('/api/beans?id=1', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify([])
			}) as never
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: 'Invalid inventory update' });
		expect(parchmentMocks.createParchmentServerClient).not.toHaveBeenCalled();
		expect(parchmentMocks.inventoryUpdate).not.toHaveBeenCalled();
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
