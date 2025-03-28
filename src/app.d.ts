/// <reference types="@sveltejs/kit" />

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import { SupabaseClient, Session } from '@supabase/supabase-js';
import { Database } from '$lib/database.types';
import { User } from '@supabase/supabase-js';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			supabase: SupabaseClient<Database>;
			session: Session | null;
			user: User | null;
			role: 'viewer' | 'member' | 'admin';
			data: {
				session: Session | null;
				user: User | null;
				role: 'viewer' | 'member' | 'admin';
			};
			safeGetSession(): Promise<{
				session: Session | null;
				user: User | null;
			}>;
		}
		interface PageData {
			session: Session | null;
			user: User | null;
			role: 'viewer' | 'member' | 'admin';
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
