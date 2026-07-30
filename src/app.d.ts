/// <reference types="@sveltejs/kit" />

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import { SupabaseClient, Session, User } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database.types';
import type { PageAuthView, UserRole } from '$lib/types/auth.types';
import type { RequestPrincipal } from '$lib/server/principal';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			supabase: SupabaseClient<Database>;
			principal: RequestPrincipal;
			safeGetIdentity(): Promise<{
				session: Session | null;
				user: User | null;
			}>;
		}
		interface PageData {
			auth: PageAuthView;
		}
		// interface PageState {}
		// interface Platform {}
	}

	// Global window interface for D3
	interface Window {
		d3?: typeof import('d3');
	}
}

export {};
