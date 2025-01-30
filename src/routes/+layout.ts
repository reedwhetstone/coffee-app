import { supabase } from '$lib/auth/supabase';
import { auth } from '$lib/stores/auth';
import { browser } from '$app/environment';
import { onDestroy } from 'svelte';

export const load = async ({ fetch, data, depends }) => {
	depends('supabase:auth');

	try {
		const {
			data: { session },
			error
		} = await supabase.auth.getSession();

		if (error) {
			console.error('Error getting session:', error);
			auth.reset();
			return { supabase, session: null };
		}

		// Update the auth store with the session
		if (session) {
			auth.setSession(session);
			auth.setUser(session.user);
		}

		// Only set up subscription in browser environment
		let unsubscribe: (() => void) | undefined;
		if (browser) {
			unsubscribe = supabase.auth.onAuthStateChange((event, newSession) => {
				auth.setSession(newSession);
				auth.setUser(newSession?.user ?? null);
				depends('supabase:auth');
			});
		}

		// Clean up subscription on destroy
		if (browser) {
			onDestroy(() => {
				unsubscribe?.();
			});
		}

		return {
			supabase,
			session
		};
	} catch (error) {
		console.error('Error in layout load:', error);
		auth.reset();
		return {
			supabase,
			session: null
		};
	}
};
