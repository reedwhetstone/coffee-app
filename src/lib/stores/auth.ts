import { writable } from 'svelte/store';
import type { User } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface AuthState {
	user: User | null;
	profile: Profile | null;
	loading: boolean;
}

function createAuthStore() {
	const { subscribe, set, update } = writable<AuthState>({
		user: null,
		profile: null,
		loading: true
	});

	return {
		subscribe,
		setUser: (user: User | null) => update((state) => ({ ...state, user, loading: false })),
		setProfile: (profile: Profile | null) => update((state) => ({ ...state, profile })),
		reset: () => set({ user: null, profile: null, loading: false })
	};
}

export const auth = createAuthStore();
