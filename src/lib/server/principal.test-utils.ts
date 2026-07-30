import type { Session, User } from '@supabase/supabase-js';
import type {
	AnonymousPrincipal,
	ApiKeyPrincipal,
	RequestPrincipal,
	SessionPrincipal
} from './principal';
import type { UserRole } from '$lib/types/auth.types';

export function anonymousPrincipal(): AnonymousPrincipal {
	return {
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
		user: null,
		session: null
	};
}

export function cookieSessionPrincipal(
	role: UserRole = 'viewer',
	overrides: Partial<SessionPrincipal> = {}
): SessionPrincipal {
	const user = (overrides.user ?? {
		id: 'user-1',
		email: 'user@example.com'
	}) as User;
	const session = (overrides.session ?? {
		access_token: 'session-token',
		user
	}) as Session;

	return {
		subjectType: 'user',
		authKind: 'session',
		source: 'cookie-session',
		isAuthenticated: true,
		userId: user.id,
		user,
		session,
		appRoles: [role],
		primaryAppRole: role,
		apiPlan: role === 'viewer' ? 'viewer' : 'member',
		ppiAccess: false,
		apiScopes: [],
		...overrides
	};
}

export function apiKeyPrincipal(overrides: Partial<ApiKeyPrincipal> = {}): ApiKeyPrincipal {
	return {
		subjectType: 'api-key',
		authKind: 'api-key',
		source: 'api-key',
		isAuthenticated: true,
		userId: 'api-user-1',
		user: null,
		session: null,
		appRoles: ['viewer'],
		primaryAppRole: 'viewer',
		apiPlan: 'viewer',
		ppiAccess: false,
		apiScopes: [],
		...overrides
	};
}

export function requestPrincipal(authenticated: boolean): RequestPrincipal {
	return authenticated ? cookieSessionPrincipal() : anonymousPrincipal();
}
