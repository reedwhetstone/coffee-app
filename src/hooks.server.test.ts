import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateServerClient = vi.fn();
const mockResolvePrincipal = vi.fn();
const mockGetSession = vi.fn();
const mockGetUser = vi.fn();

vi.mock('$env/static/public', () => ({
	PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
	PUBLIC_SUPABASE_ANON_KEY: 'anon'
}));

vi.mock('@supabase/ssr', () => ({
	createServerClient: mockCreateServerClient
}));

type TestResolve = (event: unknown) => Promise<Response> | Response;
type TestHandle = (input: { event: unknown; resolve: TestResolve }) => Promise<Response> | Response;

vi.mock('@sveltejs/kit/hooks', () => ({
	sequence:
		(...handles: TestHandle[]) =>
		async ({ event, resolve }: { event: unknown; resolve: TestResolve }) => {
			let index = -1;

			const run = async (i: number, currentEvent: unknown): Promise<Response> => {
				if (i <= index) {
					throw new Error('next() called multiple times');
				}

				index = i;
				const handle = handles[i];
				if (!handle) {
					return resolve(currentEvent);
				}

				return Promise.resolve(
					handle({
						event: currentEvent,
						resolve: (nextEvent: unknown) => run(i + 1, nextEvent)
					})
				);
			};

			return run(0, event);
		}
}));

vi.mock('$lib/server/principal', () => ({
	resolvePrincipal: mockResolvePrincipal,
	isCookieSessionPrincipal: (principal: {
		authKind?: string;
		source?: string;
		session?: unknown;
	}) =>
		principal.authKind === 'session' &&
		principal.source === 'cookie-session' &&
		Boolean(principal.session),
	principalHasRole: (principal: { appRoles?: string[] }, role: string) =>
		principal.appRoles?.includes(role) ?? false
}));

let handle: typeof import('./hooks.server').handle;

function makeEvent(path: string, headers: HeadersInit = {}) {
	return {
		url: new URL(`https://app.test${path}`),
		request: new Request(`https://app.test${path}`, { headers }),
		cookies: {
			getAll: vi.fn().mockReturnValue([]),
			set: vi.fn()
		},
		locals: {}
	} as unknown as Parameters<typeof handle>[0]['event'];
}

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();

	mockGetSession.mockResolvedValue({ data: { session: { access_token: 'cookie-token' } } });
	mockGetUser.mockResolvedValue({
		data: {
			user: { id: 'cookie-user', email: 'cookie@app.test', role: 'authenticated' }
		},
		error: null
	});
	mockCreateServerClient.mockReturnValue({
		auth: {
			getSession: mockGetSession,
			getUser: mockGetUser
		}
	});

	({ handle } = await import('./hooks.server'));
});

describe('hooks auth guard integration', () => {
	it('does not downgrade an authenticated request when canonical principal resolution is unavailable', async () => {
		mockResolvePrincipal.mockRejectedValue(
			Object.assign(new Error('Parchment principal resolution failed'), {
				name: 'PrincipalResolutionError'
			})
		);
		const resolve = vi.fn();

		await expect(
			handle({
				event: makeEvent('/dashboard'),
				resolve
			})
		).rejects.toMatchObject({ name: 'PrincipalResolutionError' });

		expect(resolve).not.toHaveBeenCalled();
	});

	it.each([
		{
			name: 'API key',
			principal: { isAuthenticated: true, authKind: 'api-key', source: 'api-key' }
		},
		{
			name: 'bearer session',
			principal: { isAuthenticated: true, authKind: 'session', source: 'bearer-session' }
		},
		{
			name: 'invalid Authorization header',
			principal: { isAuthenticated: false, authKind: 'anonymous', source: 'none' }
		}
	])('does not recover the cookie identity after a $name wins', async ({ principal }) => {
		mockResolvePrincipal.mockResolvedValue(principal);
		const response = await handle({
			event: makeEvent('/api/share', {
				Authorization: 'Bearer authoritative-header'
			}),
			resolve: vi.fn(async (event) => Response.json({ principal: event.locals.principal.authKind }))
		});

		expect(await response.json()).toEqual({ principal: principal.authKind });
		expect(mockGetSession).not.toHaveBeenCalled();
	});

	it('exposes the canonical cookie identity only through the principal', async () => {
		const principal = {
			isAuthenticated: true,
			authKind: 'session',
			source: 'cookie-session',
			session: { access_token: 'canonical-cookie-token' },
			user: { id: 'canonical-cookie-user' },
			primaryAppRole: 'member',
			appRoles: ['member']
		};
		mockResolvePrincipal.mockResolvedValue(principal);
		const response = await handle({
			event: makeEvent('/dashboard'),
			resolve: vi.fn(async (event) => Response.json(event.locals.principal))
		});

		expect(await response.json()).toMatchObject({
			session: { access_token: 'canonical-cookie-token' },
			user: { id: 'canonical-cookie-user' },
			primaryAppRole: 'member',
			appRoles: ['member']
		});
	});

	it('rejects invalid Authorization headers on dashboard routes even if a cookie session exists', async () => {
		mockResolvePrincipal.mockResolvedValue({ isAuthenticated: false });
		await expect(
			handle({
				event: makeEvent('/dashboard', {
					Authorization: 'Bearer definitely-invalid'
				}),
				resolve: vi.fn()
			})
		).rejects.toMatchObject({ status: 303, location: '/auth' });

		expect(mockGetSession).not.toHaveBeenCalled();
	});

	it('treats bearer-session page requests as non-cookie page auth and redirects protected routes', async () => {
		mockResolvePrincipal.mockResolvedValue({ isAuthenticated: true, authKind: 'session' });
		await expect(
			handle({
				event: makeEvent('/beans', {
					Authorization: 'Bearer sb_session_token'
				}),
				resolve: vi.fn()
			})
		).rejects.toMatchObject({ status: 303, location: '/catalog' });

		expect(mockGetSession).not.toHaveBeenCalled();
	});

	it('preserves upstream status and headers for no-cookie public API responses', async () => {
		mockResolvePrincipal.mockResolvedValue({ isAuthenticated: false });

		const response = await handle({
			event: makeEvent('/v1/catalog', {
				Authorization: 'Bearer definitely-invalid'
			}),
			resolve: vi.fn(
				() =>
					new Response(
						JSON.stringify({
							error: 'Authentication required',
							message: 'Authentication required'
						}),
						{
							status: 401,
							headers: {
								'Content-Type': 'application/json; charset=utf-8',
								'X-RateLimit-Limit': '200',
								Deprecation: 'true'
							}
						}
					)
			)
		});

		expect(response.status).toBe(401);
		expect(response.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
		expect(response.headers.get('X-RateLimit-Limit')).toBe('200');
		expect(response.headers.get('Deprecation')).toBe('true');
		expect(response.headers.get('X-Cookies-Disabled')).toBeNull();
		expect(await response.json()).toEqual({
			error: 'Authentication required',
			message: 'Authentication required'
		});
		expect(mockGetSession).not.toHaveBeenCalled();
	});

	it('allows cookie-backed member page requests through with a normalized principal', async () => {
		mockResolvePrincipal.mockResolvedValue({
			isAuthenticated: true,
			authKind: 'session',
			source: 'cookie-session',
			session: { access_token: 'cookie-token' },
			user: { id: 'cookie-user' },
			appRoles: ['member'],
			primaryAppRole: 'member',
			ppiAccess: false
		});

		const response = await handle({
			event: makeEvent('/beans'),
			resolve: vi.fn(
				(event) =>
					new Response(
						JSON.stringify({
							hasSession: Boolean(event.locals.principal.session),
							role: event.locals.principal.primaryAppRole
						}),
						{ status: 200, headers: { 'Content-Type': 'application/json' } }
					)
			)
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ hasSession: true, role: 'member' });
		expect(mockGetSession).not.toHaveBeenCalled();
	});

	it('allows Parchment Intelligence users through /chat without member role', async () => {
		mockResolvePrincipal.mockResolvedValue({
			isAuthenticated: true,
			authKind: 'session',
			source: 'cookie-session',
			session: { access_token: 'cookie-token' },
			user: { id: 'ppi-user' },
			appRoles: ['viewer'],
			primaryAppRole: 'viewer',
			ppiAccess: true
		});

		const response = await handle({
			event: makeEvent('/chat'),
			resolve: vi.fn(
				(event) =>
					new Response(
						JSON.stringify({
							hasSession: Boolean(event.locals.principal.session),
							role: event.locals.principal.primaryAppRole,
							ppiAccess: event.locals.principal.ppiAccess
						}),
						{ status: 200, headers: { 'Content-Type': 'application/json' } }
					)
			)
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ hasSession: true, role: 'viewer', ppiAccess: true });
	});

	it('allows Parchment Intelligence users through /beans portfolio without member role', async () => {
		mockResolvePrincipal.mockResolvedValue({
			isAuthenticated: true,
			authKind: 'session',
			source: 'cookie-session',
			session: { access_token: 'cookie-token' },
			user: { id: 'ppi-user' },
			appRoles: ['viewer'],
			primaryAppRole: 'viewer',
			ppiAccess: true
		});

		const response = await handle({
			event: makeEvent('/beans'),
			resolve: vi.fn(
				(event) =>
					new Response(
						JSON.stringify({
							hasSession: Boolean(event.locals.principal.session),
							role: event.locals.principal.primaryAppRole,
							ppiAccess: event.locals.principal.ppiAccess
						}),
						{ status: 200, headers: { 'Content-Type': 'application/json' } }
					)
			)
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ hasSession: true, role: 'viewer', ppiAccess: true });
	});

	it('still blocks viewer accounts without Parchment Intelligence from /chat and /beans', async () => {
		mockResolvePrincipal.mockResolvedValue({
			isAuthenticated: true,
			authKind: 'session',
			source: 'cookie-session',
			session: { access_token: 'cookie-token' },
			user: { id: 'viewer-user' },
			appRoles: ['viewer'],
			primaryAppRole: 'viewer',
			ppiAccess: false
		});

		await expect(
			handle({
				event: makeEvent('/chat'),
				resolve: vi.fn()
			})
		).rejects.toMatchObject({ status: 303, location: '/dashboard' });

		await expect(
			handle({
				event: makeEvent('/beans'),
				resolve: vi.fn()
			})
		).rejects.toMatchObject({ status: 303, location: '/dashboard' });
	});
});
