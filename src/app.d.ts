/// <reference types="@sveltejs/kit" />

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import { SupabaseClient, Session, User } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database.types';
import type { UserRole } from '$lib/types/auth.types';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			supabase: SupabaseClient<Database>;
			session: Session | null;
			user: User | null;
			role: UserRole;
			data: {
				session: Session | null;
				user: User | null;
				role: UserRole;
			};
			safeGetSession(): Promise<{
				session: Session | null;
				user: User | null;
				role: UserRole;
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
			role: UserRole;
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
