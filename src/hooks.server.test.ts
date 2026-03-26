import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateServerClient = vi.fn();
const mockResolvePrincipal = vi.fn();
const mockGetLegacyAuthState = vi.fn();
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

vi.mock('$lib/middleware/cookieCheck', () => ({
	handleCookieCheck: async ({
		event,
		resolve
	}: {
		event: unknown;
		resolve: (event: unknown) => Promise<Response> | Response;
	}) => resolve(event)
}));

vi.mock('$lib/server/principal', () => ({
	resolvePrincipal: mockResolvePrincipal,
	getLegacyAuthState: mockGetLegacyAuthState,
	getUserRoles: vi.fn(),
	getPrimaryUserRole: vi.fn()
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
	it('rejects invalid Authorization headers on dashboard routes even if a cookie session exists', async () => {
		mockResolvePrincipal.mockResolvedValue({ isAuthenticated: false });
		mockGetLegacyAuthState.mockReturnValue({
			session: null,
			user: null,
			role: 'viewer',
			roles: ['viewer']
		});

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
		mockGetLegacyAuthState.mockReturnValue({
			session: null,
			user: { id: 'bearer-user' },
			role: 'member',
			roles: ['member']
		});

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

	it('allows cookie-backed member page requests through with normalized locals', async () => {
		mockResolvePrincipal.mockResolvedValue({ isAuthenticated: true, authKind: 'session' });
		mockGetLegacyAuthState.mockReturnValue({
			session: { access_token: 'cookie-token' },
			user: { id: 'cookie-user' },
			role: 'member',
			roles: ['member']
		});

		const response = await handle({
			event: makeEvent('/beans'),
			resolve: vi.fn(
				(event) =>
					new Response(
						JSON.stringify({
							hasSession: Boolean(event.locals.session),
							role: event.locals.role
						}),
						{ status: 200, headers: { 'Content-Type': 'application/json' } }
					)
			)
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ hasSession: true, role: 'member' });
		expect(mockGetSession).not.toHaveBeenCalled();
	});
});
