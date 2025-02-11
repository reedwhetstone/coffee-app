import { createClient } from '$lib/supabase';
import type { RequestEvent } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';

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

	// First get the session
	const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
	if (sessionError || !sessionData.session) {
		throw new AuthError('Invalid or expired token');
	}

	// Then validate the user
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

export type UserRole = 'viewer' | 'member' | 'admin';

export async function getUserRole(supabase: SupabaseClient, userId: string): Promise<UserRole> {
	const { data, error } = await supabase
		.from('user_roles')
		.select('role')
		.eq('id', userId)
		.single();

	if (error || !data) return 'viewer';
	return data.role as UserRole;
}

export function requireRole(userRole: UserRole | undefined, requiredRole: UserRole): boolean {
	const roleHierarchy = {
		viewer: 0,
		member: 1,
		admin: 2
	};

	if (!userRole) return false;
	return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}
