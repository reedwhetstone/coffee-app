import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import type { RequestPrincipal } from './principal';

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

import {
	ParchmentConfigError,
	createParchmentPrincipalClient,
	createParchmentServerClient
} from './parchmentClient';

/** Minimal RequestEvent stub with just the fields the helper touches. */
function makeEvent(overrides: {
	sessionToken?: string | null;
	authorizationHeader?: string | null;
	principalAuthenticated?: boolean;
	preferHeader?: string | null;
}): RequestEvent {
	const {
		sessionToken = null,
		authorizationHeader = null,
		principalAuthenticated = false,
		preferHeader = null
	} = overrides;

	const fetchImpl = vi.fn();

	const headers = new Headers();
	if (authorizationHeader) {
		headers.set('authorization', authorizationHeader);
	}
	if (preferHeader) {
		headers.set('prefer', preferHeader);
	}

	const principal = authorizationHeader
		? ({
				authKind: principalAuthenticated ? 'api-key' : 'anonymous',
				isAuthenticated: principalAuthenticated
			} as RequestPrincipal)
		: sessionToken
			? ({
					subjectType: 'user',
					authKind: 'session',
					source: 'cookie-session',
					isAuthenticated: true,
					userId: 'user-1',
					user: { id: 'user-1' },
					session: { access_token: sessionToken },
					appRoles: ['viewer'],
					primaryAppRole: 'viewer',
					apiPlan: 'viewer',
					ppiAccess: false,
					apiScopes: []
				} as unknown as RequestPrincipal)
			: ({ authKind: 'anonymous', isAuthenticated: false } as RequestPrincipal);

	const locals = { principal } as App.Locals;

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

	it('sends Prefer: handling=lenient on BFF calls (PADR-0013 §7 first-party signal)', async () => {
		const event = makeEvent({});
		await createParchmentServerClient(event);

		const wrappedFetch = (createParchmentClient.mock.calls[0][0] as { fetch: typeof fetch }).fetch;
		const baseFetch = event.fetch as unknown as ReturnType<typeof vi.fn>;
		baseFetch.mockResolvedValue(new Response(null));

		await wrappedFetch('https://api.test.purveyors.io/v1/catalog');

		const init = baseFetch.mock.calls[0][1] as RequestInit;
		expect(new Headers(init.headers).get('prefer')).toBe('handling=lenient');
	});

	it('does not override an explicit per-call Prefer header', async () => {
		const event = makeEvent({});
		await createParchmentServerClient(event);

		const wrappedFetch = (createParchmentClient.mock.calls[0][0] as { fetch: typeof fetch }).fetch;
		const baseFetch = event.fetch as unknown as ReturnType<typeof vi.fn>;
		baseFetch.mockResolvedValue(new Response(null));

		await wrappedFetch('https://api.test.purveyors.io/v1/catalog', {
			headers: { Prefer: 'handling=strict' }
		});

		const init = baseFetch.mock.calls[0][1] as RequestInit;
		expect(new Headers(init.headers).get('prefer')).toBe('handling=strict');
	});

	it('preserves headers on a Request input (openapi-fetch fetch(request) shape)', async () => {
		const event = makeEvent({});
		await createParchmentServerClient(event);

		const wrappedFetch = (createParchmentClient.mock.calls[0][0] as { fetch: typeof fetch }).fetch;
		const baseFetch = event.fetch as unknown as ReturnType<typeof vi.fn>;
		baseFetch.mockResolvedValue(new Response(null));

		// The SDK builds a Request carrying the credential/content-type and calls
		// fetch(request) with no init. The wrapper must not drop those headers.
		const request = new Request('https://api.test.purveyors.io/v1/catalog', {
			method: 'POST',
			headers: { Authorization: 'Bearer session-jwt', 'Content-Type': 'application/json' }
		});
		await wrappedFetch(request);

		const init = baseFetch.mock.calls[0][1] as RequestInit;
		const forwarded = new Headers(init.headers);
		expect(forwarded.get('authorization')).toBe('Bearer session-jwt');
		expect(forwarded.get('content-type')).toBe('application/json');
		expect(forwarded.get('prefer')).toBe('handling=lenient');
	});

	it('does not inject a lenient default in preferHandling=inherit mode (public API proxy)', async () => {
		const event = makeEvent({});
		await createParchmentServerClient(event, { preferHandling: 'inherit' });

		const wrappedFetch = (createParchmentClient.mock.calls[0][0] as { fetch: typeof fetch }).fetch;
		const baseFetch = event.fetch as unknown as ReturnType<typeof vi.fn>;
		baseFetch.mockResolvedValue(new Response(null));

		await wrappedFetch('https://api.test.purveyors.io/v1/catalog');

		const init = baseFetch.mock.calls[0][1] as RequestInit;
		// No first-party default: Parchment applies its documented strict default,
		// so a gated failure surfaces as a real 4xx instead of a degraded 2xx.
		expect(new Headers(init.headers).get('prefer')).toBeNull();
	});

	it('forwards the external caller Prefer header in preferHandling=inherit mode', async () => {
		const event = makeEvent({ preferHeader: 'handling=lenient' });
		await createParchmentServerClient(event, { preferHandling: 'inherit' });

		const wrappedFetch = (createParchmentClient.mock.calls[0][0] as { fetch: typeof fetch }).fetch;
		const baseFetch = event.fetch as unknown as ReturnType<typeof vi.fn>;
		baseFetch.mockResolvedValue(new Response(null));

		await wrappedFetch('https://api.test.purveyors.io/v1/catalog');

		const init = baseFetch.mock.calls[0][1] as RequestInit;
		// The external caller opted into lenient itself; honor their preference.
		expect(new Headers(init.headers).get('prefer')).toBe('handling=lenient');
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

	it('forwards the canonical cookie-session principal credential', async () => {
		const event = makeEvent({ sessionToken: 'cookie-session-token' });
		await createParchmentServerClient(event);

		expect(createParchmentClient.mock.calls[0][0]).toMatchObject({
			token: 'cookie-session-token'
		});
	});

	it('creates an anonymous client (no token) when there is no session anywhere', async () => {
		const event = makeEvent({ sessionToken: null });
		const client = await createParchmentServerClient(event);

		expect(client).toBeDefined();
		expect(createParchmentClient.mock.calls[0][0]).toMatchObject({ token: undefined });
	});

	it('forwards the authorized Authorization header credential over a cookie session (mixed credentials)', async () => {
		// Authorization API key + Supabase cookie present at the same time. The
		// hook authenticates the header as the canonical principal, so the header
		// credential must win over the cookie token.
		const event = makeEvent({
			authorizationHeader: 'Bearer pcsk_authorized_api_key',
			principalAuthenticated: true,
			sessionToken: 'cookie-user-token'
		});
		await createParchmentServerClient(event);

		expect(createParchmentClient.mock.calls[0][0]).toMatchObject({
			token: 'pcsk_authorized_api_key'
		});
	});

	it('forwards no credential for an invalid Authorization header and does not fall back to cookies', async () => {
		// Header present but the principal resolver rejected it. The hook treats
		// this as anonymous and never consults the cookie, so neither do we.
		const event = makeEvent({
			authorizationHeader: 'Bearer not-a-valid-token',
			principalAuthenticated: false,
			sessionToken: 'cookie-user-token'
		});
		await createParchmentServerClient(event);

		expect(createParchmentClient.mock.calls[0][0]).toMatchObject({ token: undefined });
	});

	it('routes requests through event.fetch (via the Prefer-injecting wrapper)', async () => {
		const event = makeEvent({});
		await createParchmentServerClient(event);

		const wrappedFetch = (createParchmentClient.mock.calls[0][0] as { fetch: typeof fetch }).fetch;
		const baseFetch = event.fetch as unknown as ReturnType<typeof vi.fn>;
		baseFetch.mockResolvedValue(new Response(null));

		await wrappedFetch('https://api.test.purveyors.io/v1/catalog');

		expect(baseFetch).toHaveBeenCalledTimes(1);
	});

	it('defaults to session mode (forwards the session token) when no mode is given', async () => {
		const event = makeEvent({ sessionToken: 'direct-token' });
		await createParchmentServerClient(event);

		expect(createParchmentClient.mock.calls[0][0]).toMatchObject({ token: 'direct-token' });
	});
});

describe('createParchmentPrincipalClient', () => {
	beforeEach(() => {
		mockEnv.PARCHMENT_API_BASE_URL = 'https://api.test.purveyors.io';
		createParchmentClient.mockClear();
	});

	afterEach(() => {
		delete mockEnv.PARCHMENT_API_BASE_URL;
	});

	it('uses the exact credential chosen by auth bootstrap without reading session state', () => {
		const event = makeEvent({
			sessionToken: 'different-cookie-token',
			authorizationHeader: 'Bearer different-header-token',
			principalAuthenticated: false
		});

		createParchmentPrincipalClient(event, 'canonical-bootstrap-token');

		expect(createParchmentClient.mock.calls[0][0]).toMatchObject({
			baseUrl: 'https://api.test.purveyors.io',
			token: 'canonical-bootstrap-token'
		});
	});

	it('does not request lenient handling for the authorization decision', async () => {
		const event = makeEvent({});
		createParchmentPrincipalClient(event, 'canonical-bootstrap-token');
		const wrappedFetch = (createParchmentClient.mock.calls[0][0] as { fetch: typeof fetch }).fetch;
		const baseFetch = event.fetch as unknown as ReturnType<typeof vi.fn>;
		baseFetch.mockResolvedValue(new Response(null));

		await wrappedFetch('https://api.test.purveyors.io/v1/me');

		const init = baseFetch.mock.calls[0][1] as RequestInit;
		expect(new Headers(init.headers).get('prefer')).toBeNull();
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
				sessionToken: 'cookie-token',
				authorizationHeader: 'Bearer header-token',
				principalAuthenticated: true
			});

			await createParchmentServerClient(event, { mode: 'public-demo' });

			expect(createParchmentClient.mock.calls[0][0]).toMatchObject({ token: 'pcsk_demo_key' });
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
			const event = makeEvent({ sessionToken: 'direct-token' });

			await createParchmentServerClient(event, { mode: 'session' });

			expect(createParchmentClient.mock.calls[0][0]).toMatchObject({ token: 'direct-token' });
		});

		it('forwards the Authorization header credential over a cookie session', async () => {
			const event = makeEvent({
				authorizationHeader: 'Bearer pcsk_authorized_api_key',
				principalAuthenticated: true,
				sessionToken: 'cookie-user-token'
			});

			await createParchmentServerClient(event, { mode: 'session' });

			expect(createParchmentClient.mock.calls[0][0]).toMatchObject({
				token: 'pcsk_authorized_api_key'
			});
		});

		it('sends no token for an unauthenticated caller and does NOT fall back to the demo key', async () => {
			// Demo key is configured, but session mode must never borrow it for a
			// caller who simply has no session.
			mockEnv.PARCHMENT_PUBLIC_DEMO_API_KEY = 'pcsk_demo_key';
			const event = makeEvent({ sessionToken: null });

			await createParchmentServerClient(event, { mode: 'session' });

			expect(createParchmentClient.mock.calls[0][0]).toMatchObject({ token: undefined });
		});
	});

	describe('anonymous mode', () => {
		it('sends no token and never reads the session or the demo key', async () => {
			mockEnv.PARCHMENT_PUBLIC_DEMO_API_KEY = 'pcsk_demo_key';
			const event = makeEvent({
				sessionToken: 'cookie-token',
				authorizationHeader: 'Bearer header-token',
				principalAuthenticated: true
			});

			await createParchmentServerClient(event, { mode: 'anonymous' });

			expect(createParchmentClient.mock.calls[0][0]).toMatchObject({ token: undefined });
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
