interface ProcessHandler {
	sendLog: (message: string) => void;
	addProcess: (process: { pid: number; command: string; status: string }) => void;
}

declare global {
	declare const processHandler: ProcessHandler;
	declare const Stripe: (key: string) => import('stripe').Stripe;

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
