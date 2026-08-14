interface ProcessHandler {
	sendLog: (message: string) => void;
	addProcess: (process: { pid: number; command: string; status: string }) => void;
}

declare global {
	declare const processHandler: ProcessHandler;
	declare const Stripe: (key: string) => {
		initEmbeddedCheckout(options: { clientSecret: string; onComplete: () => void }): Promise<{
			mount(element: HTMLElement): void;
			destroy(): void;
			error?: { message: string };
		}>;
	};

	namespace App {
		interface Locals {
			supabase: import('@supabase/supabase-js').SupabaseClient<Database>;
			safeGetIdentity(): Promise<{
				session: import('@supabase/supabase-js').Session | null;
				user: import('@supabase/supabase-js').User | null;
			}>;
			principal: import('$lib/server/principal').RequestPrincipal;
		}
	}
}

export {};
