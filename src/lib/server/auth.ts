import {
	getPrimaryUserRole,
	getUserRoles,
	isApiKeyPrincipal,
	isSessionPrincipal,
	isTrustedMutationRequest,
	principalHasApiPlan,
	principalHasRole,
	principalHasScope,
	resolvePrincipal,
	type ApiKeyPrincipal,
	type SessionPrincipal
} from '$lib/server/principal';
import type { ApiPlan } from '$lib/server/apiAuth';
import type { UserRole } from '$lib/types/auth.types';
import { checkRole } from '$lib/types/auth.types';
import type { RequestEvent } from '@sveltejs/kit';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database.types';

export class AuthError extends Error {
	constructor(
		message: string,
		public status = 401
	) {
		super(message);
		this.name = 'AuthError';
	}
}

export async function requireAuth(event: RequestEvent): Promise<User> {
	const principal = await resolvePrincipal(event);

	if (!isSessionPrincipal(principal)) {
		throw new AuthError('Session authentication required');
	}

	return principal.user;
}

export async function requireAuthMiddleware(event: RequestEvent) {
	try {
		await requireAuth(event);
	} catch {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}

export async function getUserRole(
	supabase: SupabaseClient<Database>,
	userId: string
): Promise<UserRole> {
	const roles = await getUserRoles(supabase, userId);
	return getPrimaryUserRole(roles);
}

export { getUserRoles };
export { checkRole as requireRole };

function assertSessionMutationIsTrusted(event: RequestEvent, principal: SessionPrincipal) {
	if (!isTrustedMutationRequest(event, principal)) {
		throw new AuthError('Cross-site session mutation blocked', 403);
	}
}

export async function requireUserAuth(
	event: RequestEvent
): Promise<{ user: User; role: UserRole; principal: SessionPrincipal }> {
	const principal = await resolvePrincipal(event);

	if (!principal.isAuthenticated) {
		throw new AuthError('Authentication required');
	}

	if (!isSessionPrincipal(principal)) {
		throw new AuthError('Session authentication required');
	}

	assertSessionMutationIsTrusted(event, principal);

	return {
		user: principal.user,
		role: principal.primaryAppRole,
		principal
	};
}

export async function requireMemberRole(
	event: RequestEvent
): Promise<{ user: User; role: UserRole; principal: SessionPrincipal }> {
	const { user, role, principal } = await requireUserAuth(event);

	if (!principalHasRole(principal, 'member')) {
		throw new AuthError('Member role required', 403);
	}

	return { user, role, principal };
}

export async function requireAdminRole(
	event: RequestEvent
): Promise<{ user: User; role: UserRole; principal: SessionPrincipal }> {
	const { user, role, principal } = await requireUserAuth(event);

	if (!principalHasRole(principal, 'admin')) {
		throw new AuthError('Admin role required', 403);
	}

	return { user, role, principal };
}

export async function requireApiKeyAuth(event: RequestEvent): Promise<ApiKeyPrincipal> {
	const principal = await resolvePrincipal(event);

	if (!isApiKeyPrincipal(principal)) {
		throw new AuthError('API key authentication required');
	}

	return principal;
}

export async function requireApiKeyAccess(
	event: RequestEvent,
	options: {
		requiredPlan?: ApiPlan;
		requiredScope?: string;
	} = {}
): Promise<ApiKeyPrincipal> {
	const principal = await requireApiKeyAuth(event);

	if (options.requiredPlan && !principalHasApiPlan(principal, options.requiredPlan)) {
		throw new AuthError('Insufficient API plan', 403);
	}

	if (options.requiredScope && !principalHasScope(principal, options.requiredScope)) {
		throw new AuthError('Insufficient API scope', 403);
	}

	return principal;
}

// Utility for API endpoints to easily enforce role-based access
export function createRoleMiddleware(requiredRole: UserRole) {
	return async (event: RequestEvent) => {
		const { user, role, principal } = await requireUserAuth(event);

		if (!principalHasRole(principal, requiredRole)) {
			throw new AuthError(`${requiredRole} role required`, 403);
		}

		return { user, role };
	};
}

// Enhanced admin check for admin endpoints
export async function validateAdminAccess(
	locals: App.Locals
): Promise<{ user: User; role: UserRole; principal: SessionPrincipal }> {
	const principal = locals.principal;

	if (!principal || !isSessionPrincipal(principal)) {
		throw new AuthError('Authentication required');
	}

	if (!principalHasRole(principal, 'admin')) {
		throw new AuthError('Admin access required', 403);
	}

	return {
		user: principal.user,
		role: principal.primaryAppRole,
		principal
	};
}
