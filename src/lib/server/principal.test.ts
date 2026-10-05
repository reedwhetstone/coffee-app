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

function makeCookieSessionEvent(
	options: { method?: string; path?: string; token?: string; cookies?: Record<string, string> } = {}
) {
	const url = `https://app.test${options.path ?? '/catalog'}`;
	const token = options.token ?? 'cookie-token';
	return {
		fetch: vi.fn(),
		request: new Request(url, { method: options.method ?? 'GET' }),
		url: new URL(url),
		cookies: { get: vi.fn((name: string) => options.cookies?.[name]), set: vi.fn() },
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

function makeAuthorizationEvent(token: string, options: { method?: string } = {}) {
	const getUser = vi.fn().mockResolvedValue({
		data: { user: { id: 'user-1' } },
		error: null
	});

	return {
		fetch: vi.fn(),
		request: new Request('https://app.test/catalog', {
			method: options.method ?? 'GET',
			headers: { Authorization: `Bearer ${token}` }
		}),
		url: new URL('https://app.test/catalog'),
		cookies: { get: vi.fn(), set: vi.fn() },
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
			{ request: 'the sign-in callback', options: { path: '/auth/callback' } },
			// SvelteKit decodes the path before routing, so these reach the same pages.
			{ request: 'the sign-in page spelled /%61uth', options: { path: '/%61uth' } },
			{ request: 'CLI approval spelled /%61uth/cli', options: { path: '/%61uth/cli' } },
			{ request: 'CLI approval spelled /a%75th/cl%69', options: { path: '/a%75th/cl%69' } },
			{ request: 'a path that cannot be decoded', options: { path: '/%E0%A4%A' } }
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

		describe('after a write', () => {
			const member = {
				...verified,
				appRoles: ['member'],
				primaryAppRole: 'member',
				ppiAccess: true
			};
			const recheckCookie = 'purveyors_identity_recheck';

			it('draws the next page from a new check, so a purchase shows at once', async () => {
				successfulMe(verified);
				await resolvePrincipal(makeCookieSessionEvent({ path: '/subscription/success' }));
				// The checkout is settled by this request, after its own identity check.
				await resolvePrincipal(
					makeCookieSessionEvent({ method: 'POST', path: '/api/billing/checkout-sessions/a1' })
				);

				successfulMe(member);
				const refreshed = await resolvePrincipal(
					makeCookieSessionEvent({ path: '/subscription/success' })
				);

				expect(refreshed.primaryAppRole).toBe('member');
				expect(refreshed.ppiAccess).toBe(true);
				expect(mockMe).toHaveBeenCalledTimes(3);
			});

			it('does the same for a bearer session', async () => {
				successfulMe(verified);
				await resolvePrincipal(makeAuthorizationEvent('session-token', { method: 'POST' }));

				successfulMe(member);
				const next = await resolvePrincipal(makeAuthorizationEvent('session-token'));

				expect(next.primaryAppRole).toBe('member');
				expect(mockMe).toHaveBeenCalledTimes(2);
			});

			it('tells the browser to have its next reads verified, for longer than an answer is reused', async () => {
				successfulMe(verified);
				const write = makeCookieSessionEvent({ method: 'POST', path: '/api/beans' });
				await resolvePrincipal(write);

				expect(write.cookies.set).toHaveBeenCalledTimes(1);
				const [name, value, options] = vi.mocked(write.cookies.set).mock.calls[0];
				expect([name, value]).toEqual([recheckCookie, '1']);
				expect(options).toMatchObject({ httpOnly: true, path: '/', sameSite: 'lax', secure: true });
				expect(options.maxAge).toBeGreaterThan(10);
			});

			it('verifies a read from that browser even where an earlier answer is still remembered', async () => {
				// Another server instance never saw the write and still remembers this.
				successfulMe(verified);
				await resolvePrincipal(makeCookieSessionEvent());

				successfulMe(member);
				const marked = { cookies: { [recheckCookie]: '1' } };
				const first = await resolvePrincipal(makeCookieSessionEvent(marked));
				const second = await resolvePrincipal(
					makeCookieSessionEvent({ ...marked, path: '/api/roast-profiles' })
				);

				expect([first.primaryAppRole, second.primaryAppRole]).toEqual(['member', 'member']);
				expect(mockMe).toHaveBeenCalledTimes(3);
			});

			it.each([
				{ request: 'a read', event: () => makeCookieSessionEvent() },
				{ request: 'a HEAD request', event: () => makeCookieSessionEvent({ method: 'HEAD' }) },
				{
					request: 'a write that is not signed in',
					event: () => makeCookieSessionEvent({ method: 'POST' }),
					me: revoked
				},
				{
					request: 'a write made with an Authorization header',
					event: () => makeAuthorizationEvent('session-token', { method: 'POST' })
				}
			])('does not mark the browser for $request', async ({ event, me }) => {
				successfulMe(me ?? verified);
				const request = event();
				await resolvePrincipal(request);

				expect(request.cookies.set).not.toHaveBeenCalled();
			});
		});

		it('never remembers a caller who was not signed in, so signing in takes effect at once', async () => {
			successfulMe(revoked);
			expect((await resolvePrincipal(makeCookieSessionEvent())).isAuthenticated).toBe(false);

			successfulMe(verified);
			expect((await resolvePrincipal(makeCookieSessionEvent())).isAuthenticated).toBe(true);
			expect(mockMe).toHaveBeenCalledTimes(2);
		});

		it.each([
			{ answer: 'a missing identity', me: { ...verified, sessionIdentity: null } },
			{
				answer: 'an identity for another user',
				me: { ...verified, sessionIdentity: { id: 'other-user', email: null } }
			},
			{ answer: 'a malformed identity', me: { ...verified, sessionIdentity: { id: 'user-1' } } },
			{ answer: 'an API key in a session cookie', me: { ...verified, authKind: 'api-key' } }
		])('never remembers $answer, so a corrected answer signs the next read in', async ({ me }) => {
			successfulMe(me);
			expect((await resolvePrincipal(makeCookieSessionEvent())).isAuthenticated).toBe(false);

			successfulMe(verified);
			expect((await resolvePrincipal(makeCookieSessionEvent())).isAuthenticated).toBe(true);
			expect(mockMe).toHaveBeenCalledTimes(2);
		});

		it.each([
			{ answer: 'a missing identity', me: { ...verified, sessionIdentity: null } },
			{ answer: 'an unknown kind of sign-in', me: { ...verified, authKind: 'service' } }
		])('never remembers $answer for a bearer session', async ({ me }) => {
			successfulMe(me);
			expect(
				(await resolvePrincipal(makeAuthorizationEvent('session-token'))).isAuthenticated
			).toBe(false);

			successfulMe(verified);
			expect(
				(await resolvePrincipal(makeAuthorizationEvent('session-token'))).isAuthenticated
			).toBe(true);
			expect(mockMe).toHaveBeenCalledTimes(2);
		});

		it('never remembers an answer the older-API identity check then rejects', async () => {
			// viewerProjection has no sessionIdentity, so identity comes from Supabase Auth.
			const rejected = makeCookieSessionEvent();
			vi.mocked(rejected.locals.safeGetIdentity).mockResolvedValue({ session: null, user: null });
			expect((await resolvePrincipal(rejected)).isAuthenticated).toBe(false);

			expect((await resolvePrincipal(makeCookieSessionEvent())).isAuthenticated).toBe(true);
			expect(mockMe).toHaveBeenCalledTimes(2);
		});

		it('gives every request sharing one check the same rejection, and remembers none of it', async () => {
			let answer!: (value: unknown) => void;
			mockMe.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));

			const both = Promise.all([
				resolvePrincipal(makeCookieSessionEvent()),
				resolvePrincipal(makeCookieSessionEvent({ path: '/api/catalog' }))
			]);
			await Promise.resolve();
			answer({
				data: { ...verified, sessionIdentity: null },
				error: undefined,
				response: new Response(null, { status: 200 })
			});
			expect((await both).map((principal) => principal.isAuthenticated)).toEqual([false, false]);

			successfulMe(verified);
			expect((await resolvePrincipal(makeCookieSessionEvent())).isAuthenticated).toBe(true);
			expect(mockMe).toHaveBeenCalledTimes(2);
		});

		it('returns the user ID and email from the last check, and nothing newer, while reusing it', async () => {
			successfulMe({ ...verified, sessionIdentity: { id: 'user-1', email: 'first@example.test' } });
			await resolvePrincipal(makeCookieSessionEvent());

			successfulMe({ ...verified, sessionIdentity: { id: 'user-1', email: 'later@example.test' } });
			const reused = await resolvePrincipal(makeCookieSessionEvent({ path: '/account' }));

			expect(reused.user).toEqual({ id: 'user-1', email: 'first@example.test' });
			expect(mockMe).toHaveBeenCalledTimes(1);
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
