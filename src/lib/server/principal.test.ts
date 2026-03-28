import { describe, expect, it, vi } from 'vitest';
import type { ApiKeyPrincipal, SessionPrincipal } from './principal';

vi.mock('$lib/supabase', () => ({
	createClient: () => ({
		auth: {
			getUser: vi.fn()
		}
	})
}));

vi.mock('$lib/supabase-admin', () => ({
	createAdminClient: () => ({
		from: vi.fn()
	})
}));

const {
	getLegacyAuthState,
	getPrimaryUserRole,
	isTrustedMutationRequest,
	normalizeApiScopes,
	normalizeUserRoles,
	principalHasApiPlan,
	principalHasRole,
	principalHasScope,
	requiresSessionOriginCheck
} = await import('./principal');

describe('principal helpers', () => {
	it('normalizes user roles — pseudo-roles are dropped, clean app roles are preserved', () => {
		// api and api-member pseudo-roles no longer map to a UserRole
		expect(normalizeUserRoles(['member', 'member'])).toEqual(['member']);
		expect(normalizeUserRoles(['api_viewer', 'member'])).toEqual(['viewer', 'member']);
		// ppi-member and api-member/api-enterprise are pseudo-roles — they drop from appRoles
		expect(normalizeUserRoles(['viewer', 'api-member', 'ppi-member'])).toEqual(['viewer']);
		expect(normalizeUserRoles(['admin', 'api-enterprise'])).toEqual(['admin']);
		expect(normalizeUserRoles('nope')).toEqual(['viewer']);
	});

	it('selects the highest-priority primary app role', () => {
		expect(getPrimaryUserRole(['viewer', 'member'])).toBe('member');
		expect(getPrimaryUserRole(['viewer', 'admin'])).toBe('admin');
		expect(getPrimaryUserRole(['member', 'admin'])).toBe('admin');
	});

	it('parses explicit API scopes from permissions payloads', () => {
		expect(normalizeApiScopes({ scopes: ['catalog:read', 'catalog:read'] })).toEqual([
			'catalog:read'
		]);
		expect(normalizeApiScopes({ scope: 'catalog:read catalog:write' })).toEqual([
			'catalog:read',
			'catalog:write'
		]);
	});

	it('authorizes by explicit roles, plans, and scopes', () => {
		const principal: ApiKeyPrincipal = {
			subjectType: 'api-key',
			authKind: 'api-key',
			source: 'api-key',
			isAuthenticated: true,
			userId: 'user-1',
			user: null,
			session: null,
			appRoles: ['viewer'],
			primaryAppRole: 'viewer',
			apiPlan: 'enterprise',
			ppiAccess: false,
			apiScopes: ['catalog:*'],
			apiKeyId: 'key-1',
			apiKeyName: 'Test key',
			apiKeyPermissions: null
		};

		expect(principalHasRole(principal, 'member')).toBe(false);
		expect(
			principalHasRole({ ...principal, appRoles: ['admin'], primaryAppRole: 'admin' }, 'member')
		).toBe(true);
		expect(principalHasApiPlan(principal, 'member')).toBe(true);
		expect(principalHasApiPlan(principal, 'enterprise')).toBe(true);
		expect(principalHasScope(principal, 'catalog:read')).toBe(true);
		expect(principalHasScope(principal, 'usage:read')).toBe(false);
	});

	it('api plan hierarchy: enterprise > member > viewer', () => {
		const memberPrincipal: ApiKeyPrincipal = {
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
			apiKeyId: 'key-2',
			apiKeyName: null,
			apiKeyPermissions: null
		};
		expect(principalHasApiPlan(memberPrincipal, 'viewer')).toBe(true);
		expect(principalHasApiPlan(memberPrincipal, 'member')).toBe(true);
		expect(principalHasApiPlan(memberPrincipal, 'enterprise')).toBe(false);
	});

	it('derives legacy locals from the authoritative principal state', () => {
		const cookieSessionPrincipal: SessionPrincipal = {
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
			apiKeyId: null,
			apiKeyName: null,
			apiKeyPermissions: null
		};
		const bearerSessionPrincipal: SessionPrincipal = {
			...cookieSessionPrincipal,
			source: 'bearer-session',
			session: null
		};
		const apiKeyPrincipal: ApiKeyPrincipal = {
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
			apiKeyId: 'key-1',
			apiKeyName: 'Test key',
			apiKeyPermissions: null
		};

		expect(getLegacyAuthState(cookieSessionPrincipal)).toMatchObject({
			session: { access_token: 'cookie-token' },
			user: { id: 'user-1' },
			role: 'member',
			roles: ['member']
		});
		expect(getLegacyAuthState(bearerSessionPrincipal)).toMatchObject({
			session: null,
			user: { id: 'user-1' },
			role: 'member',
			roles: ['member']
		});
		expect(getLegacyAuthState(apiKeyPrincipal)).toEqual({
			session: null,
			user: null,
			role: 'viewer',
			roles: ['viewer']
		});
		expect(
			getLegacyAuthState({
				subjectType: 'anonymous',
				authKind: 'anonymous',
				source: 'none',
				isAuthenticated: false,
				userId: null,
				appRoles: [],
				primaryAppRole: null,
				apiPlan: null,
				ppiAccess: false,
				apiScopes: [],
				apiKeyId: null,
				apiKeyName: null,
				apiKeyPermissions: null,
				user: null,
				session: null
			})
		).toEqual({
			session: null,
			user: null,
			role: 'viewer',
			roles: ['viewer']
		});
	});

	it('enforces trusted origins for session-backed mutations only', () => {
		const principal: SessionPrincipal = {
			subjectType: 'user',
			authKind: 'session',
			source: 'cookie-session',
			isAuthenticated: true,
			userId: 'user-1',
			user: { id: 'user-1' } as SessionPrincipal['user'],
			session: null,
			appRoles: ['member'],
			primaryAppRole: 'member',
			apiPlan: 'viewer',
			ppiAccess: false,
			apiScopes: ['catalog:read'],
			apiKeyId: null,
			apiKeyName: null,
			apiKeyPermissions: null
		};
		const sameOriginEvent = {
			request: {
				method: 'POST',
				headers: {
					get: (name: string) => (name.toLowerCase() === 'origin' ? 'https://app.test' : null)
				}
			},
			url: new URL('https://app.test/v1/catalog')
		} as Parameters<typeof isTrustedMutationRequest>[0];
		const crossOriginEvent = {
			request: {
				method: 'POST',
				headers: {
					get: (name: string) => (name.toLowerCase() === 'origin' ? 'https://evil.test' : null)
				}
			},
			url: new URL('https://app.test/v1/catalog')
		} as Parameters<typeof isTrustedMutationRequest>[0];
		const apiKeyPrincipal: ApiKeyPrincipal = {
			subjectType: 'api-key',
			authKind: 'api-key',
			source: 'api-key',
			isAuthenticated: true,
			userId: 'user-1',
			user: null,
			session: null,
			appRoles: ['viewer'],
			primaryAppRole: 'viewer',
			apiPlan: 'member',
			ppiAccess: false,
			apiScopes: ['catalog:read'],
			apiKeyId: 'key-1',
			apiKeyName: 'Test key',
			apiKeyPermissions: null
		};

		expect(requiresSessionOriginCheck(principal, sameOriginEvent.request)).toBe(true);
		expect(isTrustedMutationRequest(sameOriginEvent, principal)).toBe(true);
		expect(isTrustedMutationRequest(crossOriginEvent, principal)).toBe(false);
		expect(isTrustedMutationRequest(crossOriginEvent, apiKeyPrincipal)).toBe(true);
	});
});
