import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { Database } from '../types/database.types';

const browserStorage = typeof window !== 'undefined' ? window.localStorage : undefined;

// Create a single supabase client for interacting with your database
export const supabase = createClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
	auth: {
		autoRefreshToken: true,
		persistSession: true,
		detectSessionInUrl: true,
		storageKey: 'supabase-auth-token',
		storage: browserStorage
	},
	global: {
		headers: {
			'X-Client-Info': 'supabase-js'
		}
	}
});

// Auth helpers
export async function signInWithGoogle() {
	const origin = window.location.origin;
	const redirectUrl = `${origin}/auth/callback`;
	console.log('Redirect URL:', redirectUrl);
	console.log('Current Origin:', origin);
	console.log('Full window.location:', window.location);

	return supabase.auth.signInWithOAuth({
		provider: 'google',
		options: {
			redirectTo: redirectUrl,
			skipBrowserRedirect: false,
			queryParams: {
				access_type: 'offline',
				prompt: 'consent'
			}
		}
	});
}

export async function signOut() {
	return supabase.auth.signOut();
}

export async function getSession() {
	const session = await supabase.auth.getSession();
	console.log('Getting session:', session);

	// Check localStorage directly
	const storedSession = window?.localStorage.getItem('supabase-auth-token');
	console.log('Stored session in localStorage:', storedSession);

	return session;
}

export async function getUser() {
	const {
		data: { user }
	} = await supabase.auth.getUser();
	return user;
}

// Database helpers
export async function query(query: string, params?: any[]) {
	try {
		const { data, error } = await supabase.rpc('run_query', {
			query_text: query,
			query_params: params
		});

		if (error) throw error;
		return { rows: data };
	} catch (error) {
		console.error('Database query error:', error);
		throw error;
	}
}

// Profile management
export async function getProfile(userId: string) {
	const { data, error } = await supabase
		.from('profiles')
		.select('*')
		.eq('user_id', userId)
		.single();

	if (error) throw error;
	return data;
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

export function getAuthHeader() {
	return supabase.auth.getSession().then((session) => {
		if (session.data.session?.access_token) {
			return `Bearer ${session.data.session.access_token}`;
		}
		return null;
	});
}

export async function getAuthHeaders() {
	const session = await supabase.auth.getSession();
	if (!session.data.session) {
		console.log('No active session found');
		return null;
	}
	console.log('Active session found:', session.data.session.user.email);
	return session.data.session.access_token;
}
