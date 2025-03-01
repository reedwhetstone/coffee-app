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
	let lastRoute = $state('');
	let initializedRoutes = $state<Set<string>>(new Set());

	// Debug data in the layout
	$effect(() => {
		console.log('Layout data:', data);
	});

	// Track route changes and initialize data for new routes only when necessary
	$effect(() => {
		const currentRoute = $page.url.pathname;

		// Only initialize if the route changed and hasn't been initialized yet
		if (currentRoute !== lastRoute && !initializedRoutes.has(currentRoute)) {
			console.log(`Route changed to ${currentRoute}, checking if data needs initialization`);
			lastRoute = currentRoute;

			// Only initialize if we have data and the filter store isn't already initialized for this route
			if (
				data?.data &&
				Array.isArray(data.data) &&
				data.data.length > 0 &&
				!$filterStore.initialized
			) {
				console.log('Initializing filter store with layout data:', data.data.length, 'items');
				// Mark this route as initialized to prevent repeated initialization
				initializedRoutes.add(currentRoute);
				// Initialize the filter store
				filterStore.initializeForRoute(currentRoute, data.data);
			} else {
				console.log(
					'No layout data available for filter store initialization or already initialized, will defer to page component'
				);
			}
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
