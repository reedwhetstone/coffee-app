import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	anonymousPrincipal,
	apiKeyPrincipal,
	cookieSessionPrincipal
} from '$lib/server/principal.test-utils';

const testClasses = vi.hoisted(() => ({
	ParchmentConfigError: class ParchmentConfigError extends Error {},
	ParchmentRoastMutationError: class ParchmentRoastMutationError extends Error {
		constructor(
			public status: number,
			public body: unknown
		) {
			super('Parchment roast mutation failed');
		}
	}
}));

const mutationMocks = vi.hoisted(() => ({
	createParchmentRoasts: vi.fn(),
	updateParchmentRoast: vi.fn(),
	deleteParchmentRoast: vi.fn()
}));

const parchmentMocks = vi.hoisted(() => ({
	createParchmentServerClient: vi.fn(),
	fetchParchmentRoastList: vi.fn(),
	fetchParchmentRoastPage: vi.fn(),
	ParchmentRoastListError: class ParchmentRoastListError extends Error {
		constructor(
			public status: number,
			public code: string,
			message: string
		) {
			super(message);
		}
	}
}));

const principalMocks = vi.hoisted(() => ({
	isTrustedMutationRequest: vi.fn()
}));

vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: parchmentMocks.createParchmentServerClient,
	ParchmentConfigError: testClasses.ParchmentConfigError
}));

vi.mock('$lib/server/parchmentRoastMutations', () => ({
	...mutationMocks,
	ParchmentRoastMutationError: testClasses.ParchmentRoastMutationError
}));

vi.mock('$lib/server/parchmentRoasts', () => ({
	fetchParchmentRoastList: parchmentMocks.fetchParchmentRoastList,
	fetchParchmentRoastPage: parchmentMocks.fetchParchmentRoastPage,
	ParchmentRoastListError: parchmentMocks.ParchmentRoastListError,
	ROAST_PAGE_LIMIT: 200
}));

vi.mock('$lib/server/principal', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/server/principal')>()),
	isTrustedMutationRequest: principalMocks.isTrustedMutationRequest
}));

import { DELETE, GET, POST, PUT } from './+server';

const profile = {
	roast_id: 41,
	coffee_id: 7,
	coffee_name: 'Ethiopia Test',
	batch_name: 'Tuesday batch',
	last_updated: '2026-09-01T18:00:00Z',
	user: 'owner-1'
};

function makeEvent(
	options: {
		method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
		url?: string;
		body?: unknown;
		origin?: string | null;
		principal?: 'cookie' | 'api-key' | 'anonymous';
		idempotencyKey?: string;
		ifMatch?: string;
	} = {}
) {
	const method = options.method ?? 'GET';
	const url = options.url ?? 'https://app.test/api/roast-profiles';
	const headers = new Headers();
	if (method !== 'GET' && options.origin !== null) {
		headers.set('Origin', options.origin ?? 'https://app.test');
	}
	if (options.body !== undefined) headers.set('Content-Type', 'application/json');
	if (options.idempotencyKey) headers.set('Idempotency-Key', options.idempotencyKey);
	if (options.ifMatch) headers.set('If-Match', options.ifMatch);

	return {
		request: new Request(url, {
			method,
			headers,
			body: options.body === undefined ? undefined : JSON.stringify(options.body)
		}),
		url: new URL(url),
		fetch: vi.fn(),
		locals: {
			principal:
				options.principal === 'api-key'
					? apiKeyPrincipal()
					: options.principal === 'anonymous'
						? anonymousPrincipal()
						: cookieSessionPrincipal('member')
		}
	};
}

describe('/api/roast-profiles thin Parchment adapter', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		parchmentMocks.createParchmentServerClient.mockResolvedValue({ kind: 'session-client' });
		principalMocks.isTrustedMutationRequest.mockReturnValue(true);
	});

	const BATCH = 'aaaaaaaa-0000-4000-8000-000000000001';
	const totals = { roasts: 87, batches: 59, average_loss_percent: 15.289 };
	const get = (query = '') =>
		GET(makeEvent({ url: `https://app.test/api/roast-profiles${query}` }) as never);

	it('lists every owner roast from the session Parchment client when no page is named', async () => {
		parchmentMocks.fetchParchmentRoastList.mockResolvedValue({ data: [profile], totals });
		const event = makeEvent();

		const response = await GET(event as never);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ data: [profile], totals });
		expect(parchmentMocks.createParchmentServerClient).toHaveBeenCalledWith(event, {
			mode: 'session'
		});
		expect(parchmentMocks.fetchParchmentRoastList).toHaveBeenCalledWith(
			{ kind: 'session-client' },
			{}
		);
		expect(parchmentMocks.fetchParchmentRoastPage).not.toHaveBeenCalled();
	});

	it("forwards ?coffee_id= so the list holds one portfolio coffee's roasts", async () => {
		parchmentMocks.fetchParchmentRoastList.mockResolvedValue({ data: [profile], totals });

		const response = await get('?coffee_id=7');

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ data: [profile], totals });
		expect(parchmentMocks.fetchParchmentRoastList).toHaveBeenCalledWith(
			{ kind: 'session-client' },
			{ coffeeId: 7 }
		);
	});

	it('asks Parchment for one page, with every filter, and returns its totals', async () => {
		parchmentMocks.fetchParchmentRoastPage.mockResolvedValue({ data: [profile], totals });

		const response = await get(
			`?coffee_id=7&batch_id=${BATCH}&date_start=2026-09-01&date_end=2026-09-30` +
				'&q=%20guji%20&is_wholesale=false&limit=50&offset=100'
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ data: [profile], totals });
		expect(parchmentMocks.fetchParchmentRoastPage).toHaveBeenCalledWith(
			{ kind: 'session-client' },
			{
				coffeeId: 7,
				batchId: BATCH,
				dateStart: '2026-09-01',
				dateEnd: '2026-09-30',
				q: 'guji',
				isWholesale: false
			},
			{ limit: 50, offset: 100 }
		);
		// A page is one request: the route does not read every roast to answer it.
		expect(parchmentMocks.fetchParchmentRoastList).not.toHaveBeenCalled();
	});

	it('starts a page at the first roast when no offset is given', async () => {
		parchmentMocks.fetchParchmentRoastPage.mockResolvedValue({ data: [], totals });

		await get('?limit=50&is_wholesale=true');

		expect(parchmentMocks.fetchParchmentRoastPage).toHaveBeenCalledWith(
			{ kind: 'session-client' },
			{ isWholesale: true },
			{ limit: 50, offset: 0 }
		);
	});

	it('reads one roast by its number and one batch by its ID', async () => {
		parchmentMocks.fetchParchmentRoastList.mockResolvedValue({ data: [profile], totals });

		await get('?roast_id=41');
		await get(`?batch_id=${BATCH.toUpperCase()}`);

		expect(parchmentMocks.fetchParchmentRoastList).toHaveBeenNthCalledWith(
			1,
			{ kind: 'session-client' },
			{ roastId: 41 }
		);
		expect(parchmentMocks.fetchParchmentRoastList).toHaveBeenNthCalledWith(
			2,
			{ kind: 'session-client' },
			{ batchId: BATCH }
		);
	});

	it('treats a blank search as no search', async () => {
		parchmentMocks.fetchParchmentRoastPage.mockResolvedValue({ data: [], totals });

		await get('?q=%20%20&limit=50');

		expect(parchmentMocks.fetchParchmentRoastPage).toHaveBeenCalledWith(
			{ kind: 'session-client' },
			{},
			{ limit: 50, offset: 0 }
		);
	});

	it.each(['0', '-3', '7.5', 'abc', '', '2147483648'])(
		'rejects ?coffee_id=%s without asking Parchment for roasts',
		async (coffeeId) => {
			const response = await get(`?coffee_id=${coffeeId}`);

			expect(response.status).toBe(400);
			expect(await response.json()).toEqual({ error: 'Invalid coffee id' });
			expect(parchmentMocks.fetchParchmentRoastList).not.toHaveBeenCalled();
		}
	);

	it.each([
		['roast_id=abc', 'Invalid roast id'],
		['roast_id=2147483648', 'Invalid roast id'],
		['batch_id=wednesday', 'Invalid batch id'],
		['date_start=09/01/2026', 'Invalid date'],
		['date_end=2026-02-30', 'Invalid date'],
		['is_wholesale=yes', 'Invalid wholesale filter'],
		['limit=0', 'Invalid limit'],
		['limit=201', 'Invalid limit'],
		['limit=fifty', 'Invalid limit'],
		['limit=50&offset=-1', 'Invalid offset'],
		['limit=50&offset=1.5', 'Invalid offset'],
		['offset=50', 'An offset needs a limit']
	])('rejects ?%s without asking Parchment for roasts', async (query, error) => {
		const response = await get(`?${query}`);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error });
		expect(parchmentMocks.fetchParchmentRoastList).not.toHaveBeenCalled();
		expect(parchmentMocks.fetchParchmentRoastPage).not.toHaveBeenCalled();
	});

	it('answers a search Parchment cannot use with its own code, not a failure', async () => {
		parchmentMocks.fetchParchmentRoastPage.mockRejectedValue(
			new parchmentMocks.ParchmentRoastListError(400, 'invalid_query', 'q is too long')
		);

		const response = await get(`?q=${'x'.repeat(101)}&limit=50`);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: 'Invalid search term', code: 'invalid_search' });
	});

	it('reports any other Parchment failure as a failure to load', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		parchmentMocks.fetchParchmentRoastPage.mockRejectedValue(
			new parchmentMocks.ParchmentRoastListError(503, 'unavailable', 'roasts unavailable')
		);
		expect((await get('?q=guji&limit=50')).status).toBe(500);

		// With no search sent, a 400 from Parchment is not about a search.
		parchmentMocks.fetchParchmentRoastPage.mockRejectedValue(
			new parchmentMocks.ParchmentRoastListError(400, 'invalid_query', 'bad query')
		);
		const response = await get('?limit=50');
		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({ error: 'Failed to fetch roast profiles' });
	});

	it.each(['anonymous', 'api-key'] as const)(
		'answers 401 to a roast list read from %s, before any filter is read',
		async (principal) => {
			const response = await GET(
				makeEvent({
					url: 'https://app.test/api/roast-profiles?limit=50&q=guji',
					principal
				}) as never
			);

			expect(response.status).toBe(401);
			expect(parchmentMocks.createParchmentServerClient).not.toHaveBeenCalled();
			expect(parchmentMocks.fetchParchmentRoastPage).not.toHaveBeenCalled();
		}
	);

	it.each(['anonymous', 'api-key'] as const)(
		'rejects %s principals from the cookie-session BFF',
		async (principal) => {
			const response = await POST(
				makeEvent({ method: 'POST', body: { coffee_id: 7 }, principal }) as never
			);

			expect(response.status).toBe(401);
			expect(mutationMocks.createParchmentRoasts).not.toHaveBeenCalled();
		}
	);

	it('blocks cross-site cookie mutations before constructing a client', async () => {
		principalMocks.isTrustedMutationRequest.mockReturnValue(false);
		const event = makeEvent({
			method: 'POST',
			body: { coffee_id: 7 },
			origin: 'https://attacker.test'
		});
		const response = await POST(event as never);

		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({ error: 'Cross-site session mutation blocked' });
		expect(principalMocks.isTrustedMutationRequest).toHaveBeenCalledWith(
			event,
			event.locals.principal
		);
		expect(parchmentMocks.createParchmentServerClient).not.toHaveBeenCalled();
	});

	it('creates a named batch through the session SDK and preserves the browser envelope', async () => {
		mutationMocks.createParchmentRoasts.mockResolvedValue({
			isBatch: true,
			profiles: [profile, { ...profile, roast_id: 42 }]
		});
		const body = {
			batch_name: 'Tuesday batch',
			batch_beans: [{ coffee_id: 7 }, { coffee_id: 8 }]
		};
		const event = makeEvent({
			method: 'POST',
			body,
			idempotencyKey: 'batch-create-1'
		});

		const response = await POST(event as never);

		expect(response.status).toBe(200);
		expect(mutationMocks.createParchmentRoasts).toHaveBeenCalledWith(
			{ kind: 'session-client' },
			body,
			'batch-create-1'
		);
		expect(await response.json()).toEqual({
			profiles: [profile, { ...profile, roast_id: 42 }],
			roast_ids: [41, 42]
		});
	});

	it('preserves the legacy array envelope for a single create', async () => {
		mutationMocks.createParchmentRoasts.mockResolvedValue({
			isBatch: false,
			profiles: [profile]
		});

		const response = await POST(
			makeEvent({ method: 'POST', body: { coffee_id: 7 }, idempotencyKey: 'single-1' }) as never
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual([profile]);
	});

	it('routes metadata updates through Parchment with an optional If-Match', async () => {
		mutationMocks.updateParchmentRoast.mockResolvedValue(profile);
		const body = { oz_in: null, roast_notes: null };

		const response = await PUT(
			makeEvent({
				method: 'PUT',
				url: 'https://app.test/api/roast-profiles?id=41',
				body,
				ifMatch: '2026-09-01T18:00:00Z'
			}) as never
		);

		expect(response.status).toBe(200);
		expect(mutationMocks.updateParchmentRoast).toHaveBeenCalledWith(
			{ kind: 'session-client' },
			41,
			body,
			'2026-09-01T18:00:00Z'
		);
		expect(await response.json()).toEqual(profile);
	});

	it('deletes one roast by ID through Parchment', async () => {
		const single = await DELETE(
			makeEvent({
				method: 'DELETE',
				url: 'https://app.test/api/roast-profiles?id=41'
			}) as never
		);

		expect(single.status).toBe(200);
		expect(mutationMocks.deleteParchmentRoast).toHaveBeenCalledWith({ kind: 'session-client' }, 41);
	});

	it('no longer deletes a batch by its name, which more than one batch can carry', async () => {
		const byName = await DELETE(
			makeEvent({
				method: 'DELETE',
				url: 'https://app.test/api/roast-profiles?name=Tuesday%20batch'
			}) as never
		);

		expect(byName.status).toBe(400);
		expect(await byName.json()).toEqual({ error: 'A positive roast ID is required' });
		expect(mutationMocks.deleteParchmentRoast).not.toHaveBeenCalled();
		expect(parchmentMocks.createParchmentServerClient).not.toHaveBeenCalled();
	});

	it('relays Parchment status and structured errors', async () => {
		mutationMocks.updateParchmentRoast.mockRejectedValue(
			new testClasses.ParchmentRoastMutationError(409, {
				error: { code: 'write_conflict', message: 'Roast changed' }
			})
		);

		const response = await PUT(
			makeEvent({
				method: 'PUT',
				url: 'https://app.test/api/roast-profiles?id=41',
				body: { roast_notes: 'new' }
			}) as never
		);

		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({ error: 'Roast changed', code: 'write_conflict' });
	});

	it('rejects malformed positive IDs before calling Parchment', async () => {
		const response = await DELETE(
			makeEvent({
				method: 'DELETE',
				url: 'https://app.test/api/roast-profiles?id=41abc'
			}) as never
		);

		expect(response.status).toBe(400);
		expect(mutationMocks.deleteParchmentRoast).not.toHaveBeenCalled();
	});
});
