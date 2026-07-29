import { beforeEach, describe, expect, it, vi } from 'vitest';

const roastMocks = vi.hoisted(() => ({
	createRoasts: vi.fn(),
	updateRoast: vi.fn(),
	deleteRoast: vi.fn(),
	deleteBatch: vi.fn(),
	updateStockedStatus: vi.fn()
}));

const parchmentMocks = vi.hoisted(() => ({
	createParchmentServerClient: vi.fn(),
	fetchParchmentRoasts: vi.fn()
}));

vi.mock('$lib/data/roast.js', () => ({
	createRoasts: roastMocks.createRoasts,
	updateRoast: roastMocks.updateRoast,
	deleteRoast: roastMocks.deleteRoast,
	deleteBatch: roastMocks.deleteBatch
}));

vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: parchmentMocks.createParchmentServerClient
}));

vi.mock('$lib/server/parchmentRoasts', () => ({
	fetchParchmentRoasts: parchmentMocks.fetchParchmentRoasts
}));

vi.mock('$lib/server/stockedStatusUtils', () => ({
	updateStockedStatus: roastMocks.updateStockedStatus
}));

import { GET, POST } from './+server';

function makeEvent(
	role: 'viewer' | 'member' | 'admin' = 'viewer',
	options: {
		authenticated?: boolean;
		method?: 'GET' | 'POST';
		authorization?: string;
		principalAuthenticated?: boolean;
	} = {}
) {
	const authenticated = options.authenticated ?? true;
	const method = options.method ?? 'POST';
	const headers = new Headers();
	if (options.authorization) headers.set('Authorization', options.authorization);
	return {
		request: new Request('https://app.test/api/roast-profiles', {
			method,
			headers,
			body: method === 'POST' ? JSON.stringify({ coffee_id: 1 }) : undefined
		}),
		fetch: vi.fn(),
		locals: {
			role,
			supabase: { from: vi.fn() },
			session: authenticated ? { access_token: 'token' } : null,
			user: authenticated ? { id: 'user-1' } : null,
			principal: {
				isAuthenticated: options.principalAuthenticated ?? authenticated,
				authKind: options.authorization ? 'api-key' : authenticated ? 'session' : 'anonymous'
			},
			safeGetSession: vi.fn().mockResolvedValue({
				session: authenticated ? { access_token: 'token' } : null,
				user: authenticated ? { id: 'user-1' } : null
			})
		}
	};
}

describe('/api/roast-profiles GET', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns every owner roast from the session Parchment client', async () => {
		const event = makeEvent('viewer', { method: 'GET' });
		const client = { roasts: { list: vi.fn() } };
		const profiles = [{ roast_id: 9, is_wholesale: true, dry_end_time: 245 }];
		parchmentMocks.createParchmentServerClient.mockResolvedValue(client);
		parchmentMocks.fetchParchmentRoasts.mockResolvedValue(profiles);

		const response = await GET(event as never);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ data: profiles });
		expect(parchmentMocks.createParchmentServerClient).toHaveBeenCalledWith(event, {
			mode: 'session'
		});
		expect(parchmentMocks.fetchParchmentRoasts).toHaveBeenCalledWith(client);
		expect(event.locals.supabase.from).not.toHaveBeenCalled();
		expect(event.locals.safeGetSession).not.toHaveBeenCalled();
	});

	it('rejects unauthenticated callers before constructing a Parchment client', async () => {
		const response = await GET(
			makeEvent('viewer', { authenticated: false, method: 'GET' }) as never
		);

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: 'Unauthorized' });
		expect(parchmentMocks.createParchmentServerClient).not.toHaveBeenCalled();
		expect(parchmentMocks.fetchParchmentRoasts).not.toHaveBeenCalled();
	});

	it('keeps the browser BFF cookie-session-only for header-authenticated principals', async () => {
		const response = await GET(
			makeEvent('member', {
				authenticated: false,
				method: 'GET',
				authorization: 'Bearer machine-key',
				principalAuthenticated: true
			}) as never
		);

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: 'Unauthorized' });
		expect(parchmentMocks.createParchmentServerClient).not.toHaveBeenCalled();
		expect(parchmentMocks.fetchParchmentRoasts).not.toHaveBeenCalled();
	});
});

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
