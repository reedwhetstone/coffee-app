import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';

// Hoisted so the (also-hoisted) vi.mock factories can reference them safely.
const { mockEnv, createParchmentClient } = vi.hoisted(() => ({
	mockEnv: {} as Record<string, string | undefined>,
	createParchmentClient: vi.fn((options: unknown) => ({ __client: true, options }))
}));

// Mutable env mock so individual tests can toggle the base URL.
vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));

// Mock the SDK so no network calls happen; capture the options passed in.
vi.mock('@purveyors/sdk', () => ({
	createParchmentClient: (options: unknown) => createParchmentClient(options)
}));

import { ParchmentConfigError, createParchmentServerClient } from './parchmentClient';

/** Minimal RequestEvent stub with just the fields the helper touches. */
function makeEvent(overrides: {
	accessToken?: string | null;
	safeGetSessionToken?: string | null;
	includeSafeGetSession?: boolean;
}): RequestEvent {
	const {
		accessToken = null,
		safeGetSessionToken = null,
		includeSafeGetSession = true
	} = overrides;

	const fetchImpl = vi.fn();

	const locals = {
		session: accessToken ? { access_token: accessToken } : null,
		safeGetSession: includeSafeGetSession
			? vi.fn(async () => ({
					session: safeGetSessionToken ? { access_token: safeGetSessionToken } : null,
					user: null,
					role: 'viewer',
					roles: ['viewer']
				}))
			: undefined
	} as unknown as App.Locals;

	return { locals, fetch: fetchImpl } as unknown as RequestEvent;
}

describe('createParchmentServerClient', () => {
	beforeEach(() => {
		mockEnv.PARCHMENT_API_BASE_URL = 'https://api.test.purveyors.io';
		createParchmentClient.mockClear();
	});

	afterEach(() => {
		delete mockEnv.PARCHMENT_API_BASE_URL;
	});

	it('passes the configured base URL through to the SDK', async () => {
		const event = makeEvent({});
		await createParchmentServerClient(event);

		expect(createParchmentClient).toHaveBeenCalledTimes(1);
		expect(createParchmentClient.mock.calls[0][0]).toMatchObject({
			baseUrl: 'https://api.test.purveyors.io'
		});
	});

	it('throws a clear configuration error when the base URL is missing', async () => {
		delete mockEnv.PARCHMENT_API_BASE_URL;
		const event = makeEvent({});

		await expect(createParchmentServerClient(event)).rejects.toBeInstanceOf(ParchmentConfigError);
		await expect(createParchmentServerClient(event)).rejects.toThrow(/PARCHMENT_API_BASE_URL/);
		expect(createParchmentClient).not.toHaveBeenCalled();
	});

	it('treats a blank base URL as unconfigured', async () => {
		mockEnv.PARCHMENT_API_BASE_URL = '   ';
		const event = makeEvent({});

		await expect(createParchmentServerClient(event)).rejects.toBeInstanceOf(ParchmentConfigError);
	});

	it('forwards the session access token from locals.session as a bearer credential', async () => {
		const event = makeEvent({ accessToken: 'direct-token' });
		await createParchmentServerClient(event);

		expect(createParchmentClient.mock.calls[0][0]).toMatchObject({ token: 'direct-token' });
		// The direct token short-circuits safeGetSession.
		expect(event.locals.safeGetSession as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
	});

	it('falls back to safeGetSession when locals.session is absent', async () => {
		const event = makeEvent({ accessToken: null, safeGetSessionToken: 'fallback-token' });
		await createParchmentServerClient(event);

		expect(event.locals.safeGetSession).toHaveBeenCalledTimes(1);
		expect(createParchmentClient.mock.calls[0][0]).toMatchObject({ token: 'fallback-token' });
	});

	it('creates an anonymous client (no token) when there is no session anywhere', async () => {
		const event = makeEvent({ accessToken: null, safeGetSessionToken: null });
		const client = await createParchmentServerClient(event);

		expect(client).toBeDefined();
		expect(createParchmentClient.mock.calls[0][0]).toMatchObject({ token: undefined });
	});

	it('creates an anonymous client when safeGetSession is unavailable', async () => {
		const event = makeEvent({ accessToken: null, includeSafeGetSession: false });
		await createParchmentServerClient(event);

		expect(createParchmentClient.mock.calls[0][0]).toMatchObject({ token: undefined });
	});

	it('routes requests through event.fetch', async () => {
		const event = makeEvent({});
		await createParchmentServerClient(event);

		expect(createParchmentClient.mock.calls[0][0]).toMatchObject({ fetch: event.fetch });
	});
});
