import { createClient } from '$lib/supabase';
import type { RequestEvent } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserRole } from '$lib/types/auth.types';
import { checkRole } from '$lib/types/auth.types';

const supabase = createClient();

class AuthError extends Error {
	constructor(
		message: string,
		public status = 401
	) {
		super(message);
		this.name = 'AuthError';
	}
}

export async function requireAuth(event: RequestEvent) {
	const authHeader = event.request.headers.get('Authorization');

	if (!authHeader?.startsWith('Bearer ')) {
		throw new AuthError('No valid authorization header');
	}

	const token = authHeader.split(' ')[1];

	// Get and validate the session and user in one go
	const {
		data: { user },
		error
	} = await supabase.auth.getUser(token);
	if (error || !user) {
		throw new AuthError('Invalid or expired token');
	}

	return user;
}

export async function requireAuthMiddleware(event: RequestEvent) {
	try {
		await requireAuth(event);
	} catch (error) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}

export async function getUserRole(supabase: SupabaseClient, userId: string): Promise<UserRole> {
	//console.log('Getting role for user:', userId);
	const { data, error } = await supabase
		.from('user_roles')
		.select('user_role')
		.eq('id', userId)
		.single();

	//console.log('Role query result:', { data, error });

	if (error || !data || !data.user_role) {
		//console.log('Defaulting to viewer role due to:', error || 'no data');
		return 'viewer';
	}

	// Get primary role from array based on priority: member > api-enterprise > api-member > viewer
	const roles = data.user_role as UserRole[];
	if (roles.includes('member')) return 'member';
	if (roles.includes('api-enterprise')) return 'api-enterprise';
	if (roles.includes('api-member')) return 'api-member';
	return 'viewer';
}

export async function getUserRoles(supabase: SupabaseClient, userId: string): Promise<UserRole[]> {
	//console.log('Getting roles for user:', userId);
	const { data, error } = await supabase
		.from('user_roles')
		.select('user_role')
		.eq('id', userId)
		.single();

	//console.log('Roles query result:', { data, error });

	if (error || !data || !data.user_role) {
		//console.log('Defaulting to viewer role due to:', error || 'no data');
		return ['viewer'];
	}

	return data.user_role as UserRole[];
}

export { checkRole as requireRole };

// Enhanced role validation utilities for API endpoints
export async function requireMemberRole(
	event: RequestEvent
): Promise<{ user: any; role: UserRole }> {
	const { user, role } = await requireUserAuth(event);

	if (!checkRole(role, 'member')) {
		throw new AuthError('Member role required', 403);
	}

	return { user, role };
}

export async function requireAdminRole(
	event: RequestEvent
): Promise<{ user: any; role: UserRole }> {
	const { user, role } = await requireUserAuth(event);

	if (!checkRole(role, 'admin')) {
		throw new AuthError('Admin role required', 403);
	}

	return { user, role };
}

export async function requireUserAuth(event: RequestEvent): Promise<{ user: any; role: UserRole }> {
	const sessionData = await event.locals.safeGetSession();
	const { session, user, role } = sessionData as { session: any; user: any; role: UserRole };

	if (!session || !user) {
		throw new AuthError('Authentication required');
	}

	return { user, role };
}

// Utility for API endpoints to easily enforce role-based access
export function createRoleMiddleware(requiredRole: UserRole) {
	return async (event: RequestEvent) => {
		const { user, role } = await requireUserAuth(event);

		if (!checkRole(role, requiredRole)) {
			throw new AuthError(`${requiredRole} role required`, 403);
		}

		return { user, role };
	};
}

// Enhanced admin check for admin endpoints
export async function validateAdminAccess(locals: any): Promise<{ user: any; role: UserRole }> {
	try {
		const { session, user, role } = await locals.safeGetSession();

		if (!session || !user) {
			throw new AuthError('Authentication required');
		}

		if (!checkRole(role, 'admin')) {
			throw new AuthError('Admin access required', 403);
		}

		return { user, role: role as UserRole };
	} catch (error) {
		if (error instanceof AuthError) {
			throw error;
		}
		throw new AuthError('Authentication validation failed');
	}
}
