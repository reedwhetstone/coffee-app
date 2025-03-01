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

	let { data, children } = $props<{ data: LayoutData; children: any }>();

	// Debug data in the layout
	$effect(() => {
		console.log('Layout data:', data);
	});

	// Track route changes and initialize data for new routes
	$effect(() => {
		const currentRoute = $page.url.pathname;
		console.log('Current route:', currentRoute);

		// Check if we have data in the layout data object
		if (data?.data && Array.isArray(data.data) && data.data.length > 0) {
			console.log('Initializing filter store with layout data:', data.data.length, 'items');
			filterStore.initializeForRoute(currentRoute, data.data);
		} else {
			console.warn('No data available in layout to initialize filter store');
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
