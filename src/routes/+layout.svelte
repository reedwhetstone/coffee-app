<script lang="ts">
	import '../app.css';
	import CookieBanner from '$lib/components/CookieBanner.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import UnifiedHeader from '$lib/components/layout/UnifiedHeader.svelte';
	import LeftSidebar from '$lib/components/layout/LeftSidebar.svelte';
	import { setContext } from 'svelte';
	import { page } from '$app/stores';

	import type { PageMeta } from '$lib/types/meta.types';

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
		data?: unknown[];
		meta?: PageMeta;
	}

	import type { Snippet } from 'svelte';
	let { data, children } = $props<{ data: LayoutData; children: Snippet }>();
	let activeMenu = $state<string | null>(null);
	let rightSidebarOpen = $state(false);

	// Handle menu change from the sidebar
	function handleMenuChange(menu: string | null) {
		activeMenu = menu;
	}

	// Handle right sidebar state change
	function handleRightSidebarChange(isOpen: boolean) {
		rightSidebarOpen = isOpen;
	}

	// Set context for child components to access right sidebar control
	setContext('rightSidebar', {
		setOpen: handleRightSidebarChange
	});

	// Load analytics in background (non-blocking)
	$effect(() => {
		import('@vercel/speed-insights/sveltekit').then((m) => m.injectSpeedInsights());
		import('@vercel/analytics/sveltekit').then((m) => m.injectAnalytics());
	});

	// Calculate content margin based on active menu and right sidebar
	let rightMargin = $derived(rightSidebarOpen ? 'md:mr-[32rem]' : 'mr-0');
	let contentMargin = $derived(`${activeMenu ? 'ml-[22rem]' : 'ml-24'} ${rightMargin}`);

	// Determine if we should show marketing layout (no sidebar)
	let isMarketingPage = $derived(!data.session && $page.url.pathname === '/');

	// Determine if we should show the unified header (unauthenticated users on public pages)
	let isBlogPage = $derived($page.url.pathname.startsWith('/blog'));
	let shouldShowUnifiedHeader = $derived(
		!data.session &&
			($page.url.pathname === '/' ||
				$page.url.pathname === '/api' ||
				$page.url.pathname.startsWith('/docs') ||
				$page.url.pathname === '/catalog' ||
				$page.url.pathname.startsWith('/analytics') ||
				isBlogPage)
	);
</script>

<!-- Show Unified Header for unauthenticated users on home/api pages -->
{#if shouldShowUnifiedHeader}
	<UnifiedHeader />
{/if}

<!-- Marketing Layout (No Sidebar) -->
{#if isMarketingPage}
	<div class="min-h-screen">
		{@render children()}
		<CookieBanner />
	</div>
{:else}
	<!-- Main App -->
	{#if data?.session?.user}
		<!-- Authenticated Layout with Sidebar -->
		<div class="flex min-h-screen">
			<!-- Left Sidebar Component -->
			<LeftSidebar {data} onMenuChange={handleMenuChange} />

			<!-- Main Content Container -->
			<main class="{contentMargin} flex-1 transition-all duration-300 ease-out">
				<div class="h-full py-4 pr-12">
					<!-- Page Content -->
					{@render children()}
				</div>
			</main>
		</div>
	{:else}
		<!-- Non-authenticated Layout without Sidebar -->
		<div class="min-h-screen">
			<main class="flex-1">
				<div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
					<!-- Page Content -->
					{@render children()}
				</div>
			</main>
		</div>
	{/if}
{/if}

<SeoHead meta={$page.data.meta as PageMeta | undefined} />
