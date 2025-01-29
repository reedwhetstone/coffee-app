import { createClient } from '@supabase/supabase-js';
import { supabaseBrowserClient } from './supabase.browser';
import type { Database } from '../types/database.types';
import { generatePKCEVerifier } from '$lib/utils/auth';

// Create a singleton instance
let supabaseInstance: ReturnType<typeof createClient<Database>> | null = null;

const browserStorage = typeof window !== 'undefined' ? window.localStorage : undefined;

// Create a single supabase client for interacting with your database
export const supabase = supabaseBrowserClient;

// Cache the instance
supabaseInstance = supabase;

// Auth helpers
export async function signInWithGoogle() {
	const origin = window.location.origin;
	const redirectUrl = `${origin}/auth/callback`;

	// Generate PKCE verifier
	const codeVerifier = generatePKCEVerifier();

	// Store in sessionStorage (browser only)
	if (typeof window !== 'undefined') {
		sessionStorage.setItem('pkce_verifier', codeVerifier);
	}

	return supabase.auth.signInWithOAuth({
		provider: 'google',
		options: {
			redirectTo: redirectUrl,
			skipBrowserRedirect: false,
			flowType: 'pkce',
			queryParams: {
				access_type: 'offline',
				prompt: 'consent'
			},
			skipBrowserRedirect: false,
			pkceVerifier: codeVerifier
		}
	});
}

export async function signOut() {
	try {
		const { error } = await supabase.auth.signOut();
		if (error) throw error;

		// Clear auth store state
		auth.reset();

		// Clear all storage (browser only)
		if (typeof window !== 'undefined') {
			// Clear sessionStorage
			sessionStorage.removeItem('pkce_verifier');

			// Clear localStorage
			localStorage.removeItem('sb-auth-token');
			localStorage.removeItem('supabase.auth.token');

			// Clear cookies
			document.cookie.split(';').forEach((cookie) => {
				const name = cookie.split('=')[0].trim();
				if (name.startsWith('sb-')) {
					document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;`;
				}
			});
		}

		return { error: null };
	} catch (error) {
		console.error('Sign out error:', error);
		return { error };
	}
}

export async function getSession() {
	try {
		const session = await supabase.auth.getSession();
		console.log('Getting session:', session);

		const storedSession = window?.localStorage.getItem('supabase-auth-token');
		console.log('Stored session in localStorage:', storedSession);

		return session;
	} catch (error) {
		console.error('Error getting session:', error);
		throw error;
	}
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

export async function signOutCompletely() {
	try {
		await supabase.auth.signOut();
		auth.reset();

		// Clear all auth-related cookies
		document.cookie.split(';').forEach((cookie) => {
			const name = cookie.split('=')[0].trim();
			if (name.startsWith('sb-')) {
				document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;`;
			}
		});

		// Clear any sensitive localStorage items
		if (typeof window !== 'undefined') {
			window.localStorage.removeItem('sb-auth-token');
			window.localStorage.removeItem('supabase.auth.token');
		}

		return { success: true };
	} catch (error) {
		console.error('Sign out error:', error);
		throw error;
	}
}
