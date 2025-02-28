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
			}>;
			session?: import('@supabase/supabase-js').Session | null;
			user?: import('@supabase/supabase-js').User | null;
		}
	}
}

export {};
