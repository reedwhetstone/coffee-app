<script lang="ts">
	import { i18n } from '$lib/i18n';
	import { ParaglideJS } from '@inlang/paraglide-sveltekit';
	import '../app.css';
	import Navbar from './Navbar.svelte';
	import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';
	import { injectAnalytics } from '@vercel/analytics/sveltekit';
	import { onMount } from 'svelte';
	import { supabase, getUser } from '$lib/auth/supabase';
	import { auth } from '$lib/stores/auth';

	onMount(async () => {
		injectSpeedInsights();
		injectAnalytics();

		// Set initial user
		const user = await getUser();
		auth.setUser(user);

		// Listen for auth changes
		const {
			data: { subscription }
		} = supabase.auth.onAuthStateChange((event, session) => {
			auth.setUser(session?.user ?? null);
		});

		return () => subscription.unsubscribe();
	});

	let { children } = $props();
</script>

<Navbar />

<ParaglideJS {i18n}>
	{@render children()}
</ParaglideJS>
