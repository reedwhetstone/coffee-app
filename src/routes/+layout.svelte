<script lang="ts">
	import { error } from '@sveltejs/kit';
	import '../app.css';
	import Navbar from './Navbar.svelte';
	import Settingsbar from './Settingsbar.svelte';
	import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';
	import { injectAnalytics } from '@vercel/analytics/sveltekit';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { filterStore, filteredData } from '$lib/stores/filterStore';

	interface LayoutData {
		session: {
			access_token: string;
			refresh_token: string;
			expires_in: number;
			expires_at: number | undefined;
			user: {
				id: string;
				email: string;
				role: string;
			};
		} | null;
		user: {
			id: string;
			email: string;
			role: string;
		} | null;
		role: 'viewer' | 'member' | 'admin';
		data?: any[];
	}

	let { data, children } = $props<{ data: LayoutData }>();

	// Track route changes and initialize data for new routes
	$effect(() => {
		const currentRoute = $page.url.pathname;

		// Initialize the filter store with the current route and data
		if (data?.data && data.data.length > 0) {
			filterStore.initializeForRoute(currentRoute, data.data);
		}
	});

	onMount(() => {
		injectSpeedInsights();
		injectAnalytics();
	});
</script>

<Navbar {data} />
<Settingsbar {data} />
<div class="">
	{@render children()}
</div>
