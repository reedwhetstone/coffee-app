<script lang="ts">
	import '../app.css';
	import LeftSidebar from '$lib/components/layout/LeftSidebar.svelte';
	import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';
	import { injectAnalytics } from '@vercel/analytics/sveltekit';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { filterStore } from '$lib/stores/filterStore';

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
	let processingInit = $state(false);
	let activeMenu = $state<string | null>(null);

	// Create a container to store the page data for Actionsbar
	let pageData = $state<any>(null);

	// Update pageData when children changes
	$effect(() => {
		if (children?.slots?.default?.[0]?.data) {
			pageData = children.slots.default[0].data;
			console.log('Layout detected updated pageData:', pageData);
		}
	});

	// Handle menu change from the sidebar
	function handleMenuChange(menu: string | null) {
		//console.log('Layout handleMenuChange called with menu:', menu);
		activeMenu = menu;
	}

	// Track route changes and initialize data for new routes only when necessary
	$effect(() => {
		const currentRoute = page.url.pathname;

		// Only initialize if the route changed and hasn't been initialized yet
		if (currentRoute !== lastRoute && !initializedRoutes.has(currentRoute) && !processingInit) {
			//console.log(`Route changed to ${currentRoute}, checking if data needs initialization`);
			lastRoute = currentRoute;
			processingInit = true;

			// Use setTimeout to break potential update cycles
			setTimeout(() => {
				try {
					// Only initialize if we have data and the filter store isn't already initialized for this route
					if (
						data?.data &&
						Array.isArray(data.data) &&
						data.data.length > 0 &&
						!$filterStore.initialized
					) {
						//console.log('Initializing filter store with layout data:', data.data.length, 'items');
						// Mark this route as initialized to prevent repeated initialization
						initializedRoutes.add(currentRoute);
						// Initialize the filter store
						filterStore.initializeForRoute(currentRoute, data.data);
					} else {
						//console.log(
						//	'No layout data available for filter store initialization or already initialized, will defer to page component'
						//);
					}
				} finally {
					processingInit = false;
				}
			}, 0);
		}
	});

	onMount(() => {
		injectSpeedInsights();
		injectAnalytics();
	});

	// Calculate content margin based on active menu
	let contentMargin = $derived(activeMenu ? 'ml-80' : 'ml-16');
</script>

<!-- The app layout structure -->
<div class="flex min-h-screen">
	<!-- Left Sidebar Component -->
	<LeftSidebar data={pageData || data} onMenuChange={handleMenuChange} />

	<!-- Main Content Container -->
	<main class="{contentMargin} flex-1 transition-all duration-300 ease-out">
		<div class="h-full py-4 pr-4">
			<!-- Page Content -->
			{@render children()}
		</div>
	</main>
</div>
