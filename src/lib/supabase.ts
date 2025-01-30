import { createBrowserClient, createServerClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { Database } from './types/database.types';
import type { CookieOptions } from '@supabase/ssr';

// Browser client with SSR support
export const createClient = (
	options: {
		cookies?: {
			getAll: () => { name: string; value: string }[];
			setAll: (cookies: { name: string; value: string; options?: CookieOptions }[]) => void;
		};
	} = {}
) => {
	const defaultCookies = {
		getAll: () => {
			if (!document.cookie) return [];
			return document.cookie.split('; ').map((cookie) => {
				const [name, ...rest] = cookie.split('=');
				return {
					name,
					value: rest.join('=')
				};
			});
		},
		setAll: (cookies: { name: string; value: string; options?: CookieOptions }[]) => {
			cookies.forEach(({ name, value, options }) => {
				document.cookie = `${name}=${value}${
					options?.path ? `; path=${options.path}` : ''
				}${options?.maxAge ? `; max-age=${options.maxAge}` : ''}${
					options?.domain ? `; domain=${options.domain}` : ''
				}${options?.sameSite ? `; samesite=${options.sameSite}` : ''}${
					options?.secure ? '; secure' : ''
				}`;
			});
		}
	};

	return createBrowserClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		global: {
			fetch
		},
		cookies: options.cookies || defaultCookies,
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
		getAll: () => { name: string; value: string }[];
		set: (name: string, value: string, options: CookieOptions) => void;
		remove: (name: string, options: CookieOptions) => void;
	};
}) => {
	return createServerClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		cookies: {
			getAll: cookies.getAll,
			setAll: (cookieList) => {
				cookieList.forEach((cookie) => {
					cookies.set(cookie.name, cookie.value, cookie.options || {});
				});
			},
			remove: cookies.remove
		},
		auth: {
			flowType: 'pkce'
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
			},
			flowType: 'pkce'
		}
	});
};

export const signOut = (supabase: ReturnType<typeof createClient>) => {
	return supabase.auth.signOut();
};
