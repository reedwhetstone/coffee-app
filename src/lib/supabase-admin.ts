import { createClient } from '@supabase/supabase-js';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import type { Database } from './types/database.types';

/**
 * Creates a Supabase admin client that uses the service role to bypass RLS
 * IMPORTANT: Only use server-side in trusted code
 */
export const createAdminClient = () =>
	createClient<Database>(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
		auth: {
			persistSession: false,
			autoRefreshToken: false
		}
	});
