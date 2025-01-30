import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { Database } from '../types/database.types';
import { supabase } from '$lib/auth/supabase';
import type { RequestEvent } from '@sveltejs/kit';

export async function getProfile(userId: string) {
	const { data: profile, error } = await supabase
		.from('profiles')
		.select('*')
		.eq('user_id', userId)
		.single();

	if (error) throw error;
	return profile;
}

export async function updateProfile({
	userId,
	username,
	fullName,
	avatarUrl
}: {
	userId: string;
	username?: string;
	fullName?: string;
	avatarUrl?: string;
}) {
	const { data, error } = await supabase
		.from('profiles')
		.upsert({
			user_id: userId,
			username,
			full_name: fullName,
			avatar_url: avatarUrl,
			updated_at: new Date().toISOString()
		})
		.select()
		.single();

	if (error) throw error;
	return data;
}

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
	const {
		data: { user },
		error
	} = await supabase.auth.getUser(token);

	if (error || !user) {
		throw new AuthError('Invalid or expired token');
	}

	return user;
}

export const cookieConfig = {
	name: 'sb-auth-token',
	path: '/',
	sameSite: 'lax',
	secure: process.env.NODE_ENV === 'production',
	httpOnly: true,
	maxAge: 60 * 60 * 24 * 7 // 7 days
};

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
