import { writable } from 'svelte/store';
import type { User, Session } from '@supabase/supabase-js';

interface AuthState {
	user: User | null;
	session: Session | null;
	loading: boolean;
	error: Error | null;
}

function createAuthStore() {
	const { subscribe, set, update } = writable<AuthState>({
		user: null,
		session: null,
		loading: true,
		error: null
	});

	return {
		subscribe,
		setUser: (user: User | null) => update((state) => ({ ...state, user, loading: false })),
		setSession: (session: Session | null) =>
			update((state) => ({ ...state, session, loading: false })),
		reset: () => set({ user: null, session: null, loading: false, error: null })
	};
}

export const auth = createAuthStore();
