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
});
