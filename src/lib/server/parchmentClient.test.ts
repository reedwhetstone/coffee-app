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
	authorizationHeader?: string | null;
	principalAuthenticated?: boolean;
}): RequestEvent {
	const {
		accessToken = null,
		safeGetSessionToken = null,
		includeSafeGetSession = true,
		authorizationHeader = null,
		principalAuthenticated = false
	} = overrides;

	const fetchImpl = vi.fn();

	const headers = new Headers();
	if (authorizationHeader) {
		headers.set('authorization', authorizationHeader);
	}

	const locals = {
		session: accessToken ? { access_token: accessToken } : null,
		principal: { isAuthenticated: principalAuthenticated },
		safeGetSession: includeSafeGetSession
			? vi.fn(async () => ({
					session: safeGetSessionToken ? { access_token: safeGetSessionToken } : null,
					user: null,
					role: 'viewer',
					roles: ['viewer']
				}))
			: undefined
	} as unknown as App.Locals;

	return { locals, fetch: fetchImpl, request: { headers } } as unknown as RequestEvent;
}

describe('createParchmentServerClient', () => {
	beforeEach(() => {
		mockEnv.PARCHMENT_API_BASE_URL = 'https://api.test.purveyors.io';
		createParchmentClient.mockClear();
	});

	afterEach(() => {
		delete mockEnv.PARCHMENT_API_BASE_URL;
		delete mockEnv.PARCHMENT_PUBLIC_DEMO_API_KEY;
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

	it('forwards the authorized Authorization header credential over a cookie session (mixed credentials)', async () => {
		// Authorization API key + Supabase cookie present at the same time. The
		// hook authenticates the header and leaves locals.session null, so the
		// header credential must win over safeGetSession's cookie token.
		const event = makeEvent({
			authorizationHeader: 'Bearer pcsk_authorized_api_key',
			principalAuthenticated: true,
			safeGetSessionToken: 'cookie-user-token'
		});
		await createParchmentServerClient(event);

		expect(createParchmentClient.mock.calls[0][0]).toMatchObject({
			token: 'pcsk_authorized_api_key'
		});
		// The cookie session must never be consulted once a header is present.
		expect(event.locals.safeGetSession as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
	});

	it('forwards no credential for an invalid Authorization header and does not fall back to cookies', async () => {
		// Header present but the principal resolver rejected it. The hook treats
		// this as anonymous and never consults the cookie, so neither do we.
		const event = makeEvent({
			authorizationHeader: 'Bearer not-a-valid-token',
			principalAuthenticated: false,
			safeGetSessionToken: 'cookie-user-token'
		});
		await createParchmentServerClient(event);

		expect(createParchmentClient.mock.calls[0][0]).toMatchObject({ token: undefined });
		expect(event.locals.safeGetSession as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
	});

	it('routes requests through event.fetch', async () => {
		const event = makeEvent({});
		await createParchmentServerClient(event);

		expect(createParchmentClient.mock.calls[0][0]).toMatchObject({ fetch: event.fetch });
	});

	it('defaults to session mode (forwards the session token) when no mode is given', async () => {
		const event = makeEvent({ accessToken: 'direct-token' });
		await createParchmentServerClient(event);

		expect(createParchmentClient.mock.calls[0][0]).toMatchObject({ token: 'direct-token' });
	});
});

describe('createParchmentServerClient credential modes', () => {
	beforeEach(() => {
		mockEnv.PARCHMENT_API_BASE_URL = 'https://api.test.purveyors.io';
		createParchmentClient.mockClear();
	});

	afterEach(() => {
		delete mockEnv.PARCHMENT_API_BASE_URL;
		delete mockEnv.PARCHMENT_PUBLIC_DEMO_API_KEY;
	});

	describe('public-demo mode', () => {
		it('uses PARCHMENT_PUBLIC_DEMO_API_KEY and never reads the user session', async () => {
			mockEnv.PARCHMENT_PUBLIC_DEMO_API_KEY = 'pcsk_demo_key';
			// Populate every session source to prove none of them are consulted.
			const event = makeEvent({
				accessToken: 'session-token',
				safeGetSessionToken: 'cookie-token',
				authorizationHeader: 'Bearer header-token',
				principalAuthenticated: true
			});

			await createParchmentServerClient(event, { mode: 'public-demo' });

			expect(createParchmentClient.mock.calls[0][0]).toMatchObject({ token: 'pcsk_demo_key' });
			expect(event.locals.safeGetSession as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
		});

		it('trims surrounding whitespace from the demo key', async () => {
			mockEnv.PARCHMENT_PUBLIC_DEMO_API_KEY = '   pcsk_demo_key   ';
			const event = makeEvent({});

			await createParchmentServerClient(event, { mode: 'public-demo' });

			expect(createParchmentClient.mock.calls[0][0]).toMatchObject({ token: 'pcsk_demo_key' });
		});

		it('throws a config error when the demo key is missing', async () => {
			const event = makeEvent({});

			await expect(
				createParchmentServerClient(event, { mode: 'public-demo' })
			).rejects.toBeInstanceOf(ParchmentConfigError);
			await expect(createParchmentServerClient(event, { mode: 'public-demo' })).rejects.toThrow(
				/PARCHMENT_PUBLIC_DEMO_API_KEY/
			);
			expect(createParchmentClient).not.toHaveBeenCalled();
		});

		it('treats a blank demo key as unconfigured', async () => {
			mockEnv.PARCHMENT_PUBLIC_DEMO_API_KEY = '   ';
			const event = makeEvent({});

			await expect(
				createParchmentServerClient(event, { mode: 'public-demo' })
			).rejects.toBeInstanceOf(ParchmentConfigError);
		});
	});

	describe('session mode', () => {
		it('forwards the session access token and never uses the demo key as fallback', async () => {
			mockEnv.PARCHMENT_PUBLIC_DEMO_API_KEY = 'pcsk_demo_key';
			const event = makeEvent({ accessToken: 'direct-token' });

			await createParchmentServerClient(event, { mode: 'session' });

			expect(createParchmentClient.mock.calls[0][0]).toMatchObject({ token: 'direct-token' });
		});

		it('forwards the Authorization header credential over a cookie session', async () => {
			const event = makeEvent({
				authorizationHeader: 'Bearer pcsk_authorized_api_key',
				principalAuthenticated: true,
				safeGetSessionToken: 'cookie-user-token'
			});

			await createParchmentServerClient(event, { mode: 'session' });

			expect(createParchmentClient.mock.calls[0][0]).toMatchObject({
				token: 'pcsk_authorized_api_key'
			});
			expect(event.locals.safeGetSession as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
		});

		it('sends no token for an unauthenticated caller and does NOT fall back to the demo key', async () => {
			// Demo key is configured, but session mode must never borrow it for a
			// caller who simply has no session.
			mockEnv.PARCHMENT_PUBLIC_DEMO_API_KEY = 'pcsk_demo_key';
			const event = makeEvent({ accessToken: null, safeGetSessionToken: null });

			await createParchmentServerClient(event, { mode: 'session' });

			expect(createParchmentClient.mock.calls[0][0]).toMatchObject({ token: undefined });
		});
	});

	describe('anonymous mode', () => {
		it('sends no token and never reads the session or the demo key', async () => {
			mockEnv.PARCHMENT_PUBLIC_DEMO_API_KEY = 'pcsk_demo_key';
			const event = makeEvent({
				accessToken: 'session-token',
				safeGetSessionToken: 'cookie-token',
				authorizationHeader: 'Bearer header-token',
				principalAuthenticated: true
			});

			await createParchmentServerClient(event, { mode: 'anonymous' });

			expect(createParchmentClient.mock.calls[0][0]).toMatchObject({ token: undefined });
			expect(event.locals.safeGetSession as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
		});

		it('still requires the base URL to be configured', async () => {
			delete mockEnv.PARCHMENT_API_BASE_URL;
			const event = makeEvent({});

			await expect(
				createParchmentServerClient(event, { mode: 'anonymous' })
			).rejects.toBeInstanceOf(ParchmentConfigError);
		});
	});
});
