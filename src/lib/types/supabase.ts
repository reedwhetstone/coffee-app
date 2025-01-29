import { type Database } from './database.types';

declare global {
	namespace App {
		interface Locals {
			supabase: import('@supabase/supabase-js').SupabaseClient<Database>;
			getSession(): Promise<import('@supabase/supabase-js').Session | null>;
		}
	}
}
