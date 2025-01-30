import { createServerClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { Database } from '../types/database.types';
import type { CookieOptions } from '@supabase/ssr';

export function createServerSupabaseClient(cookieOptions: {
	get: (key: string) => string | undefined;
	set: (key: string, value: string, options: CookieOptions) => void;
	remove: (key: string, options: CookieOptions) => void;
}) {
	return createServerClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		auth: {
			flowType: 'pkce',
			autoRefreshToken: true,
			persistSession: true,
			detectSessionInUrl: true
		},
		cookies: cookieOptions
	});
}
