import { createBrowserClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { sanitizeNextPath } from './utils/safeRedirect';
import type { Database } from './types/database.types';

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

export const signInWithGoogle = (
	supabase: ReturnType<typeof createClient>,
	nextUrl: string = '/dashboard'
) => {
	// Defense in depth: even if a caller forwards a tainted value, only allow
	// internal paths to ride through the OAuth redirect chain.
	const next = encodeURIComponent(sanitizeNextPath(nextUrl, '/dashboard'));

	return supabase.auth.signInWithOAuth({
		provider: 'google',
		options: {
			redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback?next=${next}`,
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
