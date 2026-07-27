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
	updateInventory: vi.fn(),
	deleteInventoryItem: vi.fn()
}));

const parchmentMocks = vi.hoisted(() => {
	class MockParchmentConfigError extends Error {
		constructor(message: string) {
			super(message);
			this.name = 'ParchmentConfigError';
		}
	}

	return {
		ParchmentConfigError: MockParchmentConfigError,
		createParchmentServerClient: vi.fn(),
		createInventory: vi.fn()
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
	updateInventory: dataMocks.updateInventory,
	deleteInventoryItem: dataMocks.deleteInventoryItem
}));

vi.mock('$lib/server/parchmentClient', () => ({
	ParchmentConfigError: parchmentMocks.ParchmentConfigError,
	createParchmentServerClient: parchmentMocks.createParchmentServerClient
}));

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
		dataMocks.deleteInventoryItem.mockResolvedValue(undefined);
		parchmentMocks.createParchmentServerClient.mockResolvedValue({
			inventory: { create: parchmentMocks.createInventory }
		});
		parchmentMocks.createInventory.mockResolvedValue({
			data: {
				data: {
					id: 42,
					catalog_id: 99,
					coffee_catalog: { id: 99, name: 'Private lot', public_coffee: false }
				}
			},
			error: undefined,
			response: new Response(null, { status: 201 })
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
		const query = makeQuery([{ id: 1, roast_profiles: [{ roast_id: 10 }] }]);
		dataMocks.buildGreenCoffeeQuery.mockReturnValue(query);
		authMocks.requireParchmentAccess.mockResolvedValue({
			user: { id: 'ppi-user' },
			ppiAccess: true,
			memberAccess: false
		});

		const response = await GET(makeEvent() as never);

		expect(response.status).toBe(200);
		expect(query.eq).toHaveBeenCalledWith('user', 'ppi-user');
		expect(dataMocks.stripRoastProfileData).toHaveBeenCalledWith([
			{ id: 1, roast_profiles: [{ roast_id: 10 }] }
		]);
		expect(await response.json()).toMatchObject({ data: [{ id: 1, roast_profiles: [] }] });
	});

	it('keeps roast history in Portfolio reads for Mallard Studio members', async () => {
		const roastProfiles = [{ roast_id: 10 }];
		const query = makeQuery([{ id: 1, roast_profiles: roastProfiles }]);
		dataMocks.buildGreenCoffeeQuery.mockReturnValue(query);
		authMocks.requireParchmentAccess.mockResolvedValue({
			user: { id: 'member-user' },
			ppiAccess: false,
			memberAccess: true
		});

		const response = await GET(makeEvent() as never);

		expect(response.status).toBe(200);
		expect(dataMocks.stripRoastProfileData).not.toHaveBeenCalled();
		expect(await response.json()).toMatchObject({
			data: [{ id: 1, roast_profiles: roastProfiles }]
		});
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
		expect(dataMocks.deleteInventoryItem).not.toHaveBeenCalled();
	});

	it('creates a manual coffee and inventory lot atomically through the session SDK client', async () => {
		const response = await POST(
			makeEvent('/api/beans', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Idempotency-Key': 'manual-lot-request-1'
				},
				body: JSON.stringify({
					manual_name: 'Private lot',
					purchased_qty_lbs: 5,
					purchase_date: '2026-07-26',
					bean_cost: 42.5,
					tax_ship_cost: 3.25,
					notes: 'Direct trade sample',
					region: 'Huila',
					drying_method: 'Raised beds',
					roast_recs: 'Light roast',
					description_short: 'Pink Bourbon microlot',
					cost_lb: 8.5,
					cupping_notes: 'Peach and florals',
					score_value: 87
				})
			}) as never
		);

		expect(response.status).toBe(200);
		expect(parchmentMocks.createParchmentServerClient).toHaveBeenCalledWith(expect.anything(), {
			mode: 'session'
		});
		expect(parchmentMocks.createInventory).toHaveBeenCalledWith(
			{
				manualCoffee: {
					name: 'Private lot',
					region: 'Huila',
					dryingMethod: 'Raised beds',
					roastRecommendations: 'Light roast',
					shortDescription: 'Pink Bourbon microlot',
					costPerLb: 8.5,
					supplierCuppingNotes: 'Peach and florals',
					scoreValue: 87
				},
				qty: 5,
				purchaseDate: '2026-07-26',
				cost: 42.5,
				taxShip: 3.25,
				notes: 'Direct trade sample'
			},
			{ idempotencyKey: 'manual-lot-request-1' }
		);
		expect(dataMocks.addToInventory).not.toHaveBeenCalled();
		expect(await response.json()).toMatchObject({
			id: 42,
			catalog_id: 99,
			coffee_catalog: { public_coffee: false }
		});
	});

	it('requires a browser-stable idempotency key before creating a manual lot', async () => {
		const response = await POST(
			makeEvent('/api/beans', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ manual_name: 'Private lot', purchased_qty_lbs: 5 })
			}) as never
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: 'Idempotency-Key is required for manual coffee creation'
		});
		expect(parchmentMocks.createParchmentServerClient).not.toHaveBeenCalled();
		expect(dataMocks.addToInventory).not.toHaveBeenCalled();
	});

	it('rejects catalog-less inventory when no manual coffee name is supplied', async () => {
		const response = await POST(
			makeEvent('/api/beans', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ manual_name: '   ', purchased_qty_lbs: 5 })
			}) as never
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: 'A catalog reference or manual coffee name is required'
		});
		expect(parchmentMocks.createParchmentServerClient).not.toHaveBeenCalled();
		expect(dataMocks.addToInventory).not.toHaveBeenCalled();
	});

	it('preserves the Parchment status and message when manual creation is rejected', async () => {
		parchmentMocks.createInventory.mockResolvedValue({
			data: undefined,
			error: { error: { code: 'idempotency_conflict', message: 'Key belongs to another request' } },
			response: new Response(null, { status: 409 })
		});

		const response = await POST(
			makeEvent('/api/beans', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Idempotency-Key': 'reused-key'
				},
				body: JSON.stringify({ manual_name: 'Private lot', purchased_qty_lbs: 5 })
			}) as never
		);

		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({ error: 'Key belongs to another request' });
	});

	it('keeps catalog-backed creation on the existing path in this atomic slice', async () => {
		const catalogQuery = {
			select: vi.fn(() => catalogQuery),
			eq: vi.fn(() => catalogQuery),
			single: vi.fn(async () => ({ data: { id: 7 }, error: null }))
		};
		const event = makeEvent('/api/beans', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ catalog_id: 7, purchased_qty_lbs: 5 })
		}) as ReturnType<typeof makeEvent>;
		event.locals.supabase.from = vi.fn(() => catalogQuery);

		const response = await POST(event as never);

		expect(response.status).toBe(200);
		expect(parchmentMocks.createParchmentServerClient).not.toHaveBeenCalled();
		expect(dataMocks.addToInventory).toHaveBeenCalledWith(
			event.locals.supabase,
			'ppi-user',
			expect.objectContaining({ catalog_id: 7, purchased_qty_lbs: 5 })
		);
	});
});
