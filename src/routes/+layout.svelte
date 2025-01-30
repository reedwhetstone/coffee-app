<script lang="ts">
	import { error } from '@sveltejs/kit';
	import type { RequestEvent } from '@sveltejs/kit';
	import { i18n } from '$lib/i18n';
	import { ParaglideJS } from '@inlang/paraglide-sveltekit';
	import '../app.css';
	import Navbar from './Navbar.svelte';
	import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';
	import { injectAnalytics } from '@vercel/analytics/sveltekit';
	import { onMount } from 'svelte';
	import { supabase } from '$lib/auth/supabase';
	import { auth } from '$lib/stores/auth';
	import { page } from '$app/stores';

	// Effect to sync server-provided session with auth store
	$effect(() => {
		const session = $page.data.session;
		if (session) {
			auth.setSession(session);
			auth.setUser(session.user);
		} else {
			auth.reset();
		}
	});

	onMount(() => {
		injectSpeedInsights();
		injectAnalytics();

		// Set up auth state change listener for client-side changes
		const {
			data: { subscription }
		} = supabase.auth.onAuthStateChange((event, session) => {
			auth.setSession(session);
			auth.setUser(session?.user ?? null);
		});

		return () => subscription.unsubscribe();
	});

	let { children } = $props();

	async function handleSignOut() {
		const { error } = await supabase.auth.signOut();
		if (error) {
			console.error('Error signing out:', error.message);
		}
		// Clear all auth state
		auth.reset();
		// Clear any sensitive data from localStorage
		if (typeof window !== 'undefined') {
			window.localStorage.removeItem('sb-auth-token');
		}
	}

	const cookieConfig = {
		name: 'sb-auth-token',
		path: '/',
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
		httpOnly: true,
		maxAge: 60 * 60 * 24 * 7 // 7 days
	};
</script>

<Navbar />

<ParaglideJS {i18n}>
	{@render children()}
</ParaglideJS>
