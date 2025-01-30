import { createBrowserClient, createServerClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { Database } from './types/database.types';
import type { CookieOptions } from '@supabase/ssr';

// Browser client with SSR support
export const createClient = (
	options: {
		cookies?: {
			get: (key: string) => string | undefined;
			set: (key: string, value: string, options: CookieOptions) => void;
			remove: (key: string, options: CookieOptions) => void;
		};
	} = { cookies: {} }
) => {
	const cookieMethods = options.cookies
		? {
				getAll: () => [], // Browser doesn't need this
				setAll: () => {}, // Browser doesn't need this
				...options.cookies
			}
		: undefined;

	return createBrowserClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		global: {
			fetch
		},
		cookies: cookieMethods,
		auth: {
			flowType: 'pkce',
			detectSessionInUrl: true,
			persistSession: true,
			autoRefreshToken: true
		}
	});
};

// Server client
export const createServerSupabaseClient = ({
	cookies
}: {
	cookies: {
		get: (key: string) => string | undefined;
		set: (key: string, value: string, options: CookieOptions) => void;
		remove: (key: string, options: CookieOptions) => void;
	};
}) => {
	return createServerClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		cookies
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
