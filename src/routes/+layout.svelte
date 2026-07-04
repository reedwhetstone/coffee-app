<script lang="ts">
	import '../app.css';
	import CookieBanner from '$lib/components/CookieBanner.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import UnifiedHeader from '$lib/components/layout/UnifiedHeader.svelte';
	import LeftSidebar from '$lib/components/layout/LeftSidebar.svelte';
	import MobileAppShell from '$lib/components/layout/MobileAppShell.svelte';
	import ChatDrawer from '$lib/components/chat/ChatDrawer.svelte';
	import NavigationProgress from '$lib/components/layout/NavigationProgress.svelte';
	import { setContext } from 'svelte';
	import { page, navigating } from '$app/stores';

	import type { PageMeta } from '$lib/types/meta.types';
	import { checkRole, type UserRole } from '$lib/types/auth.types';

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
		ppiAccess?: boolean;
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

	let chatDrawerOpen = $state(false);

	let rightMargin = $derived(rightSidebarOpen || chatDrawerOpen ? 'md:mr-[32rem]' : 'md:mr-0');
	let contentMargin = $derived(`${activeMenu ? 'md:ml-[22rem]' : 'md:ml-24'} ${rightMargin}`);

	let pathname = $derived($page.url.pathname);
	let isMarketingPage = $derived(pathname === '/');
	let usesPublicShell = $derived(
		pathname === '/' ||
			pathname === '/api' ||
			pathname === '/subscription' ||
			pathname.startsWith('/docs') ||
			pathname.startsWith('/blog')
	);
	let shouldShowUnifiedHeader = $derived(
		usesPublicShell ||
			(!data.session && (pathname === '/catalog' || pathname.startsWith('/analytics')))
	);

	// Ask Parchment drawer: available on every authenticated app page except
	// /chat itself (which is the full workspace).
	let isChatRoute = $derived(pathname === '/chat' || pathname.startsWith('/chat/'));
	let canUseChatDrawer = $derived(
		Boolean(data?.session?.user) &&
			!usesPublicShell &&
			!isChatRoute &&
			(data.ppiAccess === true || checkRole(data.role, 'member'))
	);

	$effect(() => {
		if (!canUseChatDrawer && chatDrawerOpen) chatDrawerOpen = false;
	});

	function handleGlobalKeydown(event: KeyboardEvent) {
		if (!canUseChatDrawer) return;
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
			event.preventDefault();
			chatDrawerOpen = !chatDrawerOpen;
		}
	}
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

<NavigationProgress active={Boolean($navigating)} />

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
		<MobileAppShell {data} />

		<main class="{contentMargin} min-w-0 flex-1 transition-all duration-300 ease-out">
			<div class="h-full overflow-x-clip px-4 pb-6 pt-20 sm:px-6 md:px-0 md:pb-0 md:pr-12 md:pt-4">
				{@render children()}
			</div>
		</main>

		{#if canUseChatDrawer}
			{#if !chatDrawerOpen}
				<button
					type="button"
					onclick={() => (chatDrawerOpen = true)}
					class="fixed bottom-6 right-4 z-30 flex items-center gap-2 rounded-full bg-background-tertiary-light px-4 py-2.5 text-sm font-medium text-white shadow-lg transition-transform hover:scale-105"
					title="Ask Parchment (Ctrl+K)"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M8 10h8m-8 4h5m-9.5 5.5L4 16.06A8.96 8.96 0 013 12a9 9 0 119 9 8.96 8.96 0 01-4.06-1z"
						/>
					</svg>
					Ask
				</button>
			{/if}
			<ChatDrawer bind:open={chatDrawerOpen} role={data.role} ppiAccess={data.ppiAccess === true} />
		{/if}
	</div>
{:else}
	<div class="min-h-screen overflow-x-clip">
		<main class="flex-1">
			<div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
				{@render children()}
			</div>
		</main>
	</div>
{/if}

<SeoHead meta={$page.data.meta as PageMeta | undefined} />
