<script lang="ts">
	import '../app.css';
	import CookieBanner from '$lib/components/CookieBanner.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import UnifiedHeader from '$lib/components/layout/UnifiedHeader.svelte';
	import LeftSidebar from '$lib/components/layout/LeftSidebar.svelte';
	import { setContext } from 'svelte';
	import { page } from '$app/stores';

	import type { PageMeta } from '$lib/types/meta.types';
	import type { UserRole } from '$lib/types/auth.types';

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
		role: UserRole;
		data?: unknown[];
		meta?: PageMeta;
	}

	import type { Snippet } from 'svelte';
	let { data, children } = $props<{ data: LayoutData; children: Snippet }>();
	let activeMenu = $state<string | null>(null);
	let rightSidebarOpen = $state(false);

	function handleMenuChange(menu: string | null) {
		activeMenu = menu;
	}

	function handleRightSidebarChange(isOpen: boolean) {
		rightSidebarOpen = isOpen;
	}

	setContext('rightSidebar', {
		setOpen: handleRightSidebarChange
	});

	$effect(() => {
		import('@vercel/speed-insights/sveltekit').then((m) => m.injectSpeedInsights());
		import('@vercel/analytics/sveltekit').then((m) => m.injectAnalytics());
	});

	let rightMargin = $derived(rightSidebarOpen ? 'md:mr-[32rem]' : 'mr-0');
	let contentMargin = $derived(`${activeMenu ? 'ml-[22rem]' : 'ml-24'} ${rightMargin}`);

	let pathname = $derived($page.url.pathname);
	let isMarketingPage = $derived(pathname === '/');
	let usesPublicShell = $derived(
		pathname === '/' ||
			pathname === '/api' ||
			pathname.startsWith('/docs') ||
			pathname.startsWith('/blog')
	);
	let shouldShowUnifiedHeader = $derived(
		usesPublicShell ||
			(!data.session && (pathname === '/catalog' || pathname.startsWith('/analytics')))
	);
</script>

{#if shouldShowUnifiedHeader}
	<UnifiedHeader session={data.session} role={data.role} />
{/if}

{#if isMarketingPage}
	<div class="min-h-screen">
		{@render children()}
		<CookieBanner />
	</div>
{:else if data?.session?.user && !usesPublicShell}
	<div class="flex min-h-screen">
		<LeftSidebar {data} onMenuChange={handleMenuChange} />

		<main class="{contentMargin} flex-1 transition-all duration-300 ease-out">
			<div class="h-full py-4 pr-12">
				{@render children()}
			</div>
		</main>
	</div>
{:else}
	<div class="min-h-screen">
		<main class="flex-1">
			<div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
				{@render children()}
			</div>
		</main>
	</div>
{/if}

<SeoHead meta={$page.data.meta as PageMeta | undefined} />
