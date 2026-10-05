import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiKeyPrincipal, SessionPrincipal } from './principal';

const mockMe = vi.fn();
const mockCreateParchmentPrincipalClient = vi.fn(() => ({ me: mockMe }));

vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentPrincipalClient: mockCreateParchmentPrincipalClient
}));

const {
	getPrimaryUserRole,
	isTrustedMutationRequest,
	principalHasApiPlan,
	principalHasRole,
	principalHasScope,
	requiresSessionOriginCheck,
	resetIdentityReuse,
	resolvePrincipal
} = await import('./principal');

const viewerProjection = {
	authenticated: true,
	authKind: 'session' as const,
	userId: 'user-1',
	appRoles: ['viewer'],
	primaryAppRole: 'viewer',
	apiPlan: 'viewer' as const,
	ppiAccess: false,
	apiScopes: ['catalog:read']
};

function successfulMe(data: typeof viewerProjection | Record<string, unknown>) {
	mockMe.mockResolvedValue({
		data,
		error: undefined,
		response: new Response(null, { status: 200 })
	});
}

function makeCookieSessionEvent(options: { method?: string; path?: string; token?: string } = {}) {
	const url = `https://app.test${options.path ?? '/catalog'}`;
	const token = options.token ?? 'cookie-token';
	return {
		fetch: vi.fn(),
		request: new Request(url, { method: options.method ?? 'GET' }),
		url: new URL(url),
		locals: {
			principal: undefined,
			supabase: {
				auth: {
					getUser: vi.fn(),
					getSession: vi.fn().mockResolvedValue({
						data: {
							session: {
								access_token: token,
								user: { id: 'forged-cookie-id', email: 'forged@example.test' }
							}
						},
						error: null
					})
				}
			},
			safeGetIdentity: vi.fn().mockResolvedValue({
				session: { access_token: token },
				user: { id: 'user-1' }
			})
		}
	} as unknown as Parameters<typeof resolvePrincipal>[0];
}

function makeAuthorizationEvent(token: string) {
	const getUser = vi.fn().mockResolvedValue({
		data: { user: { id: 'user-1' } },
		error: null
	});

	return {
		fetch: vi.fn(),
		request: new Request('https://app.test/catalog', {
			headers: { Authorization: `Bearer ${token}` }
		}),
		url: new URL('https://app.test/catalog'),
		locals: {
			principal: undefined,
			supabase: { auth: { getUser } },
			safeGetIdentity: vi.fn()
		}
	} as unknown as Parameters<typeof resolvePrincipal>[0];
}

function sessionPrincipal(overrides: Partial<SessionPrincipal> = {}): SessionPrincipal {
	return {
		subjectType: 'user',
		authKind: 'session',
		source: 'cookie-session',
		isAuthenticated: true,
		userId: 'user-1',
		user: { id: 'user-1' } as SessionPrincipal['user'],
		session: { access_token: 'cookie-token' } as SessionPrincipal['session'],
		appRoles: ['member'],
		primaryAppRole: 'member',
		apiPlan: 'viewer',
		ppiAccess: false,
		apiScopes: ['catalog:read'],
		...overrides
	};
}

function apiKeyPrincipal(overrides: Partial<ApiKeyPrincipal> = {}): ApiKeyPrincipal {
	return {
		subjectType: 'api-key',
		authKind: 'api-key',
		source: 'api-key',
		isAuthenticated: true,
		userId: 'user-2',
		user: null,
		session: null,
		appRoles: ['viewer'],
		primaryAppRole: 'viewer',
		apiPlan: 'member',
		ppiAccess: false,
		apiScopes: ['catalog:read'],
		...overrides
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	resetIdentityReuse();
	successfulMe(viewerProjection);
});

describe('principal helpers', () => {
	it('selects the highest-priority primary app role', () => {
		expect(getPrimaryUserRole(['viewer', 'member'])).toBe('member');
		expect(getPrimaryUserRole(['viewer', 'admin'])).toBe('admin');
	});

	it('authorizes by the canonical roles, plans, and scopes', () => {
		const principal = apiKeyPrincipal({
			apiPlan: 'enterprise',
			apiScopes: ['catalog:*']
		});

		expect(principalHasRole(principal, 'member')).toBe(false);
		expect(
			principalHasRole({ ...principal, appRoles: ['admin'], primaryAppRole: 'admin' }, 'member')
		).toBe(true);
		expect(principalHasApiPlan(principal, 'member')).toBe(true);
		expect(principalHasApiPlan(principal, 'enterprise')).toBe(true);
		expect(principalHasScope(principal, 'catalog:read')).toBe(true);
		expect(principalHasScope(principal, 'usage:read')).toBe(false);
	});

	it('resolves cookie-session entitlements through Parchment', async () => {
		successfulMe({
			...viewerProjection,
			appRoles: ['member'],
			primaryAppRole: 'member',
			apiPlan: 'member',
			ppiAccess: true
		});
		const event = makeCookieSessionEvent();

		const principal = await resolvePrincipal(event);

		expect(mockCreateParchmentPrincipalClient).toHaveBeenCalledWith(event, 'cookie-token');
		expect(principal).toMatchObject({
			subjectType: 'user',
			source: 'cookie-session',
			userId: 'user-1',
			appRoles: ['member'],
			primaryAppRole: 'member',
			apiPlan: 'member',
			ppiAccess: true
		});
		expect(event.locals.supabase.auth.getUser).not.toHaveBeenCalled();
	});

	it('never grants a projected primary role that is absent from canonical roles', async () => {
		successfulMe({
			...viewerProjection,
			appRoles: ['viewer'],
			primaryAppRole: 'admin',
			apiPlan: 'viewer'
		});

		const principal = await resolvePrincipal(makeCookieSessionEvent());

		expect(principal).toMatchObject({
			appRoles: ['viewer'],
			primaryAppRole: 'viewer'
		});
	});

	it.each([
		{
			name: 'cookie session',
			authKind: 'session',
			userId: 'user-1',
			makeEvent: makeCookieSessionEvent
		},
		{
			name: 'API key',
			authKind: 'api-key',
			userId: 'api-user',
			makeEvent: () => makeAuthorizationEvent('pk_live_admin-key')
		}
	])('defaults a canonical null API plan to viewer for an admin $name', async (testCase) => {
		successfulMe({
			authenticated: true,
			authKind: testCase.authKind,
			userId: testCase.userId,
			appRoles: ['admin'],
			primaryAppRole: 'admin',
			apiPlan: null,
			ppiAccess: false,
			apiScopes: []
		});

		const principal = await resolvePrincipal(testCase.makeEvent());

		expect(principal).toMatchObject({
			isAuthenticated: true,
			primaryAppRole: 'admin',
			apiPlan: 'viewer'
		});
	});

	it('fails closed when Parchment is unavailable for a valid cookie user', async () => {
		mockMe.mockRejectedValue(new TypeError('fetch failed'));
		const event = makeCookieSessionEvent();

		await expect(resolvePrincipal(event)).rejects.toMatchObject({
			name: 'PrincipalResolutionError',
			message: 'Parchment principal resolution failed'
		});
		expect(event.locals.principal).toBeUndefined();
	});

	it('fails closed when Parchment returns a non-success response', async () => {
		mockMe.mockResolvedValue({
			data: undefined,
			error: { error: { code: 'internal_error', message: 'Unavailable' } },
			response: new Response(null, { status: 503 })
		});
		const event = makeCookieSessionEvent();

		await expect(resolvePrincipal(event)).rejects.toMatchObject({
			name: 'PrincipalResolutionError',
			status: 503
		});
		expect(event.locals.principal).toBeUndefined();
	});

	it('resolves API keys only through the canonical Parchment principal', async () => {
		successfulMe({
			authenticated: true,
			authKind: 'api-key',
			userId: 'api-user',
			appRoles: ['viewer'],
			primaryAppRole: 'viewer',
			apiPlan: 'enterprise',
			ppiAccess: true,
			apiScopes: ['catalog:*', 'usage:read']
		});
		const event = makeAuthorizationEvent('pk_live_valid-key');

		const principal = await resolvePrincipal(event);

		expect(principal).toMatchObject({
			subjectType: 'api-key',
			source: 'api-key',
			userId: 'api-user',
			apiPlan: 'enterprise',
			apiScopes: ['catalog:*', 'usage:read']
		});
		expect(event.locals.supabase.auth.getUser).not.toHaveBeenCalled();
		expect(event.locals.safeGetIdentity).not.toHaveBeenCalled();
	});

	it('hydrates a Parchment-authenticated bearer session through request-local Supabase Auth', async () => {
		successfulMe({
			...viewerProjection,
			userId: 'user-1',
			appRoles: ['admin'],
			primaryAppRole: 'admin',
			apiPlan: 'enterprise'
		});
		const event = makeAuthorizationEvent('session-token');

		const principal = await resolvePrincipal(event);

		expect(event.locals.supabase.auth.getUser).toHaveBeenCalledWith('session-token');
		expect(principal).toMatchObject({
			subjectType: 'user',
			source: 'bearer-session',
			userId: 'user-1',
			primaryAppRole: 'admin',
			session: null
		});
	});

	it('rejects a bearer session when Parchment identity and Supabase Auth disagree', async () => {
		successfulMe({ ...viewerProjection, userId: 'different-user' });
		const event = makeAuthorizationEvent('session-token');

		const principal = await resolvePrincipal(event);

		expect(principal).toMatchObject({
			subjectType: 'anonymous',
			isAuthenticated: false
		});
	});

	it('does not fall back to a cookie when an Authorization header is malformed', async () => {
		const event = makeCookieSessionEvent();
		event.request = new Request('https://app.test/catalog', {
			headers: { Authorization: 'Basic bad' }
		});

		const principal = await resolvePrincipal(event);

		expect(principal.isAuthenticated).toBe(false);
		expect(mockCreateParchmentPrincipalClient).not.toHaveBeenCalled();
		expect(event.locals.safeGetIdentity).not.toHaveBeenCalled();
	});

	it('treats an unauthenticated Parchment projection as anonymous', async () => {
		successfulMe({
			authenticated: false,
			authKind: 'anonymous',
			userId: null,
			appRoles: [],
			primaryAppRole: null,
			apiPlan: null,
			ppiAccess: false,
			apiScopes: []
		});

		const principal = await resolvePrincipal(makeAuthorizationEvent('invalid-token'));

		expect(principal).toMatchObject({
			subjectType: 'anonymous',
			isAuthenticated: false,
			appRoles: []
		});
	});

	it('caches the resolved principal on request locals', async () => {
		const event = makeCookieSessionEvent();
		const first = await resolvePrincipal(event);
		const second = await resolvePrincipal(event);

		expect(second).toBe(first);
		expect(mockMe).toHaveBeenCalledTimes(1);
	});

	it.each(['cookie', 'bearer'])(
		'uses live canonical identity without a duplicate Auth read for %s',
		async (source) => {
			successfulMe({
				...viewerProjection,
				sessionIdentity: { id: 'user-1', email: 'verified@example.test' }
			});
			const event =
				source === 'cookie' ? makeCookieSessionEvent() : makeAuthorizationEvent('session-token');
			const p = await resolvePrincipal(event);
			expect(p.user).toEqual({ id: 'user-1', email: 'verified@example.test' });
			expect(event.locals.safeGetIdentity).not.toHaveBeenCalled();
			expect(event.locals.supabase.auth.getUser).not.toHaveBeenCalled();
			expect(mockMe).toHaveBeenCalledTimes(1);
		}
	);

	it.each([null, { id: 'other-user', email: null }, { id: 'user-1' }, { id: 'user-1', email: 1 }])(
		'rejects malformed or mismatched canonical identity without fallback: %j',
		async (sessionIdentity) => {
			successfulMe({ ...viewerProjection, sessionIdentity });
			const event = makeCookieSessionEvent();
			expect((await resolvePrincipal(event)).isAuthenticated).toBe(false);
			expect(event.locals.safeGetIdentity).not.toHaveBeenCalled();
		}
	);

	describe('reusing a verified identity for a few seconds', () => {
		const verified = { ...viewerProjection, sessionIdentity: { id: 'user-1', email: null } };
		const revoked = {
			...viewerProjection,
			authenticated: false,
			authKind: 'anonymous',
			userId: null
		};

		it('asks Parchment once for the read requests of one page view', async () => {
			successfulMe(verified);

			const page = await resolvePrincipal(makeCookieSessionEvent({ path: '/roast' }));
			const data = await resolvePrincipal(makeCookieSessionEvent({ path: '/api/roast-profiles' }));
			const head = await resolvePrincipal(makeCookieSessionEvent({ method: 'HEAD' }));

			expect(page.isAuthenticated && data.isAuthenticated && head.isAuthenticated).toBe(true);
			expect(data.userId).toBe('user-1');
			expect(mockMe).toHaveBeenCalledTimes(1);
		});

		it('shares one check between read requests that arrive together', async () => {
			let answer!: (value: unknown) => void;
			mockMe.mockReturnValue(new Promise((resolve) => (answer = resolve)));

			const both = Promise.all([
				resolvePrincipal(makeCookieSessionEvent()),
				resolvePrincipal(makeCookieSessionEvent({ path: '/api/catalog' }))
			]);
			await Promise.resolve();
			answer({ data: verified, error: undefined, response: new Response(null, { status: 200 }) });

			expect((await both).map((principal) => principal.isAuthenticated)).toEqual([true, true]);
			expect(mockMe).toHaveBeenCalledTimes(1);
		});

		it('verifies again once ten seconds have passed, so a revoked session stops being accepted', async () => {
			vi.useFakeTimers();
			try {
				successfulMe(verified);
				expect((await resolvePrincipal(makeCookieSessionEvent())).isAuthenticated).toBe(true);

				successfulMe(revoked);
				vi.advanceTimersByTime(9_999);
				expect((await resolvePrincipal(makeCookieSessionEvent())).isAuthenticated).toBe(true);
				expect(mockMe).toHaveBeenCalledTimes(1);

				vi.advanceTimersByTime(1);
				expect((await resolvePrincipal(makeCookieSessionEvent())).isAuthenticated).toBe(false);
				expect(mockMe).toHaveBeenCalledTimes(2);
			} finally {
				vi.useRealTimers();
			}
		});

		it.each([
			{ request: 'a write', options: { method: 'POST', path: '/api/roast-profiles' } },
			{ request: 'a delete', options: { method: 'DELETE', path: '/api/roast-profiles' } },
			{ request: 'the CLI approval page', options: { path: '/auth/cli' } },
			{ request: 'the sign-in callback', options: { path: '/auth/callback' } }
		])('always verifies $request with Parchment', async ({ options }) => {
			successfulMe(verified);
			await resolvePrincipal(makeCookieSessionEvent());

			successfulMe(revoked);
			expect((await resolvePrincipal(makeCookieSessionEvent(options))).isAuthenticated).toBe(false);
			expect(mockMe).toHaveBeenCalledTimes(2);
		});

		it('stops reusing an identity as soon as any check finds it revoked', async () => {
			successfulMe(verified);
			await resolvePrincipal(makeCookieSessionEvent());

			successfulMe(revoked);
			await resolvePrincipal(makeCookieSessionEvent({ method: 'POST', path: '/api/beans' }));

			expect((await resolvePrincipal(makeCookieSessionEvent())).isAuthenticated).toBe(false);
		});

		it('never remembers a caller who was not signed in, so signing in takes effect at once', async () => {
			successfulMe(revoked);
			expect((await resolvePrincipal(makeCookieSessionEvent())).isAuthenticated).toBe(false);

			successfulMe(verified);
			expect((await resolvePrincipal(makeCookieSessionEvent())).isAuthenticated).toBe(true);
			expect(mockMe).toHaveBeenCalledTimes(2);
		});

		it('never remembers a failed check', async () => {
			mockMe.mockRejectedValueOnce(new Error('network down'));
			await expect(resolvePrincipal(makeCookieSessionEvent())).rejects.toThrow();

			successfulMe(verified);
			expect((await resolvePrincipal(makeCookieSessionEvent())).isAuthenticated).toBe(true);
			expect(mockMe).toHaveBeenCalledTimes(2);
		});

		it('keeps each credential separate', async () => {
			successfulMe(verified);
			await resolvePrincipal(makeCookieSessionEvent({ token: 'first-token' }));
			await resolvePrincipal(makeCookieSessionEvent({ token: 'second-token' }));

			expect(mockMe).toHaveBeenCalledTimes(2);
			expect(mockCreateParchmentPrincipalClient).toHaveBeenNthCalledWith(
				2,
				expect.anything(),
				'second-token'
			);
		});

		it('reuses a verified API key the same way, for reads only', async () => {
			const key = {
				...viewerProjection,
				authKind: 'api-key' as const,
				userId: 'user-2',
				apiPlan: 'member' as const
			};
			successfulMe(key);

			await resolvePrincipal(makeAuthorizationEvent('pk_live_key'));
			const again = await resolvePrincipal(makeAuthorizationEvent('pk_live_key'));

			expect(again.authKind).toBe('api-key');
			expect(mockMe).toHaveBeenCalledTimes(1);
		});
	});

	it('retains live identity verification with an older API', async () => {
		const event = makeCookieSessionEvent();
		expect((await resolvePrincipal(event)).isAuthenticated).toBe(true);
		expect(event.locals.safeGetIdentity).toHaveBeenCalledTimes(1);
	});

	it('enforces trusted origins for session-backed mutations only', () => {
		const principal = sessionPrincipal();
		const sameOriginEvent = {
			request: {
				method: 'POST',
				headers: { get: () => 'https://app.test' }
			},
			url: new URL('https://app.test/v1/catalog')
		} as unknown as Parameters<typeof isTrustedMutationRequest>[0];
		const crossOriginEvent = {
			request: {
				method: 'POST',
				headers: { get: () => 'https://evil.test' }
			},
			url: new URL('https://app.test/v1/catalog')
		} as unknown as Parameters<typeof isTrustedMutationRequest>[0];

		expect(requiresSessionOriginCheck(principal, sameOriginEvent.request)).toBe(true);
		expect(isTrustedMutationRequest(sameOriginEvent, principal)).toBe(true);
		expect(isTrustedMutationRequest(crossOriginEvent, principal)).toBe(false);
		expect(isTrustedMutationRequest(crossOriginEvent, apiKeyPrincipal())).toBe(true);
	});
});
