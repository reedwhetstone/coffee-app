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
	console.log('Getting role for user:', userId);
	const { data, error } = await supabase
		.from('user_roles')
		.select('role')
		.eq('id', userId)
		.single();

	console.log('Role query result:', { data, error });

	if (error || !data) {
		console.log('Defaulting to viewer role due to:', error || 'no data');
		return 'viewer';
	}
	console.log('Found role:', data.role);
	return data.role as UserRole;
}

export { checkRole as requireRole };
