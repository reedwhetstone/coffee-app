import { createBrowserClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { Database } from '../types/database.types';

export const supabaseBrowserClient = createBrowserClient<Database>(
	PUBLIC_SUPABASE_URL,
	PUBLIC_SUPABASE_ANON_KEY,
	{
		cookieOptions: {
			name: 'sb-auth-token',
			path: '/',
			sameSite: 'lax',
			secure: process.env.NODE_ENV === 'production',
			maxAge: 60 * 60 * 24 * 7 // 7 days
		},
		auth: {
			flowType: 'pkce',
			detectSessionInUrl: true,
			persistSession: true,
			autoRefreshToken: true,
			storage: {
				getItem: (key) => {
					if (typeof window === 'undefined') return null;
					return window.localStorage.getItem(key);
				},
				setItem: (key, value) => {
					if (typeof window === 'undefined') return;
					window.localStorage.setItem(key, value);
				},
				removeItem: (key) => {
					if (typeof window === 'undefined') return;
					window.localStorage.removeItem(key);
				}
			}
		}
	}
);
