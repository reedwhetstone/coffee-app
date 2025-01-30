import { createBrowserClient, createServerClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { Database } from './types/database.types';

// Browser client with SSR support
export const createClient = (
	options: {
		cookies?: {
			getAll: () => { name: string; value: string }[];
			setAll: (cookies: { name: string; value: string }[]) => void;
		};
	} = {}
) => {
	return createBrowserClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		global: {
			fetch
		},
		cookies: options.cookies,
		auth: {
			flowType: 'pkce',
			detectSessionInUrl: true,
			persistSession: true,
			autoRefreshToken: true
		}
	});
};

// Auth helpers
export const signInWithGoogle = (supabase: ReturnType<typeof createClient>) => {
	return supabase.auth.signInWithOAuth({
		provider: 'google',
		options: {
			redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback`,
			queryParams: {
				access_type: 'offline',
				prompt: 'consent'
			}
		}
	});
};

export const signOut = (supabase: ReturnType<typeof createClient>) => {
	return supabase.auth.signOut();
};

export const createSupabaseLoadClient = () => {
	return createBrowserClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		global: {
			fetch
		},
		auth: {
			flowType: 'pkce',
			detectSessionInUrl: true,
			persistSession: true,
			autoRefreshToken: true
		}
	});
};
