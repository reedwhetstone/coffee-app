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
	deleteParchmentRoast: vi.fn(),
	deleteParchmentRoastBatch: vi.fn()
}));

const parchmentMocks = vi.hoisted(() => ({
	createParchmentServerClient: vi.fn(),
	fetchParchmentRoasts: vi.fn()
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
	fetchParchmentRoasts: parchmentMocks.fetchParchmentRoasts
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
						: cookieSessionPrincipal('viewer')
		}
	};
}

describe('/api/roast-profiles thin Parchment adapter', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		parchmentMocks.createParchmentServerClient.mockResolvedValue({ kind: 'session-client' });
		principalMocks.isTrustedMutationRequest.mockReturnValue(true);
	});

	it('lists every owner roast from the session Parchment client', async () => {
		parchmentMocks.fetchParchmentRoasts.mockResolvedValue([profile]);
		const event = makeEvent();

		const response = await GET(event as never);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ data: [profile] });
		expect(parchmentMocks.createParchmentServerClient).toHaveBeenCalledWith(event, {
			mode: 'session'
		});
		expect(parchmentMocks.fetchParchmentRoasts).toHaveBeenCalledWith({ kind: 'session-client' });
	});

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

	it('deletes either one roast or one exact named batch through Parchment', async () => {
		const single = await DELETE(
			makeEvent({
				method: 'DELETE',
				url: 'https://app.test/api/roast-profiles?id=41'
			}) as never
		);
		const batch = await DELETE(
			makeEvent({
				method: 'DELETE',
				url: 'https://app.test/api/roast-profiles?name=Tuesday%20batch'
			}) as never
		);

		expect(single.status).toBe(200);
		expect(batch.status).toBe(200);
		expect(mutationMocks.deleteParchmentRoast).toHaveBeenCalledWith({ kind: 'session-client' }, 41);
		expect(mutationMocks.deleteParchmentRoastBatch).toHaveBeenCalledWith(
			{ kind: 'session-client' },
			'Tuesday batch'
		);
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
