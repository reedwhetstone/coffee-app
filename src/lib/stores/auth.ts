import { writable } from 'svelte/store';
import type { User, Session } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface AuthState {
	user: User | null;
	profile: Profile | null;
	session: Session | null;
	loading: boolean;
}

function createAuthStore() {
	const { subscribe, set, update } = writable<AuthState>({
		user: null,
		profile: null,
		session: null,
		loading: true
	});

	return {
		subscribe,
		setUser: (user: User | null) => update((state) => ({ ...state, user, loading: false })),
		setProfile: (profile: Profile | null) => update((state) => ({ ...state, profile })),
		setSession: (session: Session | null) =>
			update((state) => ({ ...state, session, loading: false })),
		reset: () => set({ user: null, profile: null, session: null, loading: false })
	};
}

export const auth = createAuthStore();
