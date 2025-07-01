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
				role: 'viewer' | 'member' | 'admin';
			}>;
		}
		interface PageData {
			session: {
				access_token: string;
				refresh_token: string;
				expires_in: number;
				expires_at: number | undefined;
				user: {
					id: string;
					email: string | undefined;
					role: string | undefined;
				};
			} | null;
			user: {
				id: string;
				email: string | undefined;
				role: string | undefined;
			} | null;
			role: 'viewer' | 'member' | 'admin';
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
