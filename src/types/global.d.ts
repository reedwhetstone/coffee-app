declare global {
	var processHandler: {
		sendLog: (message: string) => void;
		addProcess: (process: any) => void;
	};

	namespace App {
		interface Locals {
			supabase: import('@supabase/supabase-js').SupabaseClient<Database>;
			safeGetSession(): Promise<{
				session: import('@supabase/supabase-js').Session | null;
				user: import('@supabase/supabase-js').User | null;
				role: import('$lib/types/auth.types').UserRole;
			}>;
			session?: import('@supabase/supabase-js').Session | null;
			user?: import('@supabase/supabase-js').User | null;
			role?: import('$lib/types/auth.types').UserRole;
			data?: {
				session: import('@supabase/supabase-js').Session | null;
				user: import('@supabase/supabase-js').User | null;
				role: import('$lib/types/auth.types').UserRole;
			};
		}
	}
}

export {};
