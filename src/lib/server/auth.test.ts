import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockBearerGetUser = vi.fn();
const mockValidateApiKey = vi.fn();
const mockUserRolesSingle = vi.fn();

vi.mock('$lib/supabase', () => ({
	createClient: () => ({
		auth: {
			getUser: mockBearerGetUser
		}
	})
}));

vi.mock('$lib/supabase-admin', () => ({
	createAdminClient: () => ({
		from: (table: string) => {
			if (table !== 'user_roles') {
				throw new Error(`Unexpected table lookup in auth test: ${table}`);
			}

			return {
				select: () => ({
					eq: () => ({
						single: mockUserRolesSingle
					})
				})
			};
		}
	})
}));

vi.mock('$lib/server/apiAuth', () => ({
	API_KEY_PREFIX: 'pk_live_',
	getUserApiTier: (role: string | string[] | null) => {
		const roles = Array.isArray(role) ? role : role ? [role] : [];

		if (roles.includes('admin') || roles.includes('api-enterprise')) {
			return 'api-enterprise';
		}

		if (roles.includes('api-member')) {
			return 'api-member';
		}

		return 'viewer';
	},
	validateApiKey: mockValidateApiKey
}));

const { AuthError, requireApiKeyAccess, requireUserAuth, validateAdminAccess } = await import(
	'./auth'
);

type EventOptions = {
	method?: string;
	url?: string;
	authHeader?: string;
	origin?: string;
	sessionContext?: {
		session: unknown;
		user: unknown;
		role: 'viewer' | 'member' | 'admin';
		roles: ('viewer' | 'member' | 'admin' | 'api-member' | 'api-enterprise')[];
	};
	principal?: {
		subjectType: 'user';
		authKind: 'session';
		source: 'cookie-session' | 'bearer-session';
		isAuthenticated: true;
		userId: string;
		user: { id: string };
		session: unknown;
		appRoles: ('viewer' | 'member' | 'admin' | 'api-member' | 'api-enterprise')[];
		primaryAppRole: 'viewer' | 'member' | 'admin' | 'api-member' | 'api-enterprise';
		apiPlan: 'viewer' | 'api-member' | 'api-enterprise';
		apiScopes: string[];
		apiKeyId: null;
		apiKeyName: null;
		apiKeyPermissions: null;
	};
};

function makeEvent(options: EventOptions = {}) {
	const headers = new Headers();
	if (options.authHeader) {
		headers.set('Authorization', options.authHeader);
	}
	if (options.origin) {
		headers.set('origin', options.origin);
	}

	const url = options.url ?? 'https://app.test/api/catalog-api';
	const sessionContext =
		options.sessionContext ??
		({
			session: null,
			user: null,
			role: 'viewer',
			roles: ['viewer']
		} as const);

	return {
		request: {
			method: options.method ?? 'GET',
			headers
		},
		url: new URL(url),
		locals: {
			principal: options.principal,
			safeGetSession: vi.fn().mockResolvedValue(sessionContext)
		}
	} as unknown as Parameters<typeof requireUserAuth>[0];
}

function makeAdminPrincipal(): NonNullable<EventOptions['principal']> {
	return {
		subjectType: 'user' as const,
		authKind: 'session' as const,
		source: 'cookie-session' as const,
		isAuthenticated: true as const,
		userId: 'admin-user',
		user: { id: 'admin-user' },
		session: { access_token: 'cookie-token' },
		appRoles: ['admin'],
		primaryAppRole: 'admin' as const,
		apiPlan: 'api-enterprise' as const,
		apiScopes: ['catalog:read'],
		apiKeyId: null,
		apiKeyName: null,
		apiKeyPermissions: null
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	mockBearerGetUser.mockResolvedValue({
		data: { user: null },
		error: { message: 'Invalid token' }
	});
	mockValidateApiKey.mockResolvedValue({
		valid: false,
		error: 'Invalid API key'
	});
	mockUserRolesSingle.mockResolvedValue({
		data: { user_role: ['viewer'] },
		error: null
	});
});

describe('auth integration', () => {
	it('fails closed for API keys when user role lookup fails', async () => {
		mockValidateApiKey.mockResolvedValue({
			valid: true,
			userId: 'user-1',
			keyId: 'key-1'
		});
		mockUserRolesSingle.mockResolvedValue({
			data: null,
			error: { message: 'lookup failed' }
		});

		const event = makeEvent({
			authHeader: 'Bearer pk_live_valid-key',
			sessionContext: {
				session: { access_token: 'cookie-token' },
				user: { id: 'cookie-user' },
				role: 'member',
				roles: ['member']
			}
		});

		await expect(requireApiKeyAccess(event)).rejects.toMatchObject({
			message: 'API key authentication required',
			status: 401
		});
		expect(event.locals.safeGetSession).not.toHaveBeenCalled();
	});

	it('treats an explicit invalid Authorization header as authoritative over cookies', async () => {
		const event = makeEvent({
			authHeader: 'Bearer definitely-not-a-valid-session-token',
			sessionContext: {
				session: { access_token: 'cookie-token' },
				user: { id: 'cookie-user' },
				role: 'member',
				roles: ['member']
			}
		});

		await expect(requireUserAuth(event)).rejects.toMatchObject({
			message: 'Authentication required',
			status: 401
		});
		expect(event.locals.safeGetSession).not.toHaveBeenCalled();
	});

	it('blocks cross-origin admin mutations but allows same-origin ones', async () => {
		const crossOriginEvent = makeEvent({
			method: 'POST',
			origin: 'https://evil.test',
			url: 'https://app.test/api/admin/stripe-role-discrepancies',
			principal: makeAdminPrincipal()
		});

		await expect(validateAdminAccess(crossOriginEvent)).rejects.toMatchObject({
			message: 'Cross-site session mutation blocked',
			status: 403
		});

		const sameOriginEvent = makeEvent({
			method: 'POST',
			origin: 'https://app.test',
			url: 'https://app.test/api/admin/stripe-role-discrepancies',
			principal: makeAdminPrincipal()
		});

		await expect(validateAdminAccess(sameOriginEvent)).resolves.toMatchObject({
			user: { id: 'admin-user' },
			role: 'admin'
		});
	});

	it('returns AuthError instances for auth failures', async () => {
		await expect(requireApiKeyAccess(makeEvent())).rejects.toBeInstanceOf(AuthError);
	});
});
