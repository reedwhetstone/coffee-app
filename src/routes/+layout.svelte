<script lang="ts">
	import '../app.css';
	import CookieBanner from '$lib/components/CookieBanner.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import UnifiedHeader from '$lib/components/layout/UnifiedHeader.svelte';
	import LeftSidebar from '$lib/components/layout/LeftSidebar.svelte';
	import MobileAppShell from '$lib/components/layout/MobileAppShell.svelte';
	import ChatDrawer from '$lib/components/chat/ChatDrawer.svelte';
	import NavigationProgress from '$lib/components/layout/NavigationProgress.svelte';
	import RouteSkeleton from '$lib/components/layout/RouteSkeleton.svelte';
	import { usesStandaloneShell } from '$lib/components/layout/routeShells';
	import { DESKTOP_SHELL_CONTENT_MARGIN } from '$lib/components/layout/desktopShellState';
	import {
		ROUTE_SKELETON_DELAY_MS,
		loadRouteSkeletonComponent,
		shouldShowClientRouteSkeleton
	} from '$lib/components/layout/routeSkeletons';
	import { setContext } from 'svelte';
	import { page, navigating } from '$app/stores';

	import type { PageMeta } from '$lib/types/meta.types';
	import { checkRole, type PageAuthView } from '$lib/types/auth.types';
	import { resolveCherryAgent } from '$lib/cherry/identity';

	interface LayoutData {
		auth: PageAuthView;
		data?: unknown[];
		meta?: PageMeta;
	}

	import type { Snippet } from 'svelte';
	let { data, children } = $props<{ data: LayoutData; children: Snippet }>();
	let rightSidebarOpen = $state(false);

	function handleRightSidebarChange(isOpen: boolean) {
		rightSidebarOpen = isOpen;
	}

	setContext('rightSidebar', {
		setOpen: handleRightSidebarChange
	});

	let chatDrawerOpen = $state(false);

	let rightMargin = $derived(rightSidebarOpen || chatDrawerOpen ? 'md:mr-[32rem]' : 'md:mr-0');
	let contentMargin = $derived(`${DESKTOP_SHELL_CONTENT_MARGIN} ${rightMargin}`);

	// Cross-route client navigations keep the current page mounted for the
	// first ROUTE_SKELETON_DELAY_MS (the thin progress bar is the immediate
	// feedback); only navigations that stay pending past the threshold swap in
	// the destination-shaped skeleton. Fast and prefetched navigations never
	// tear down content or discard local component state.
	let navigationTargetPathname = $derived($navigating?.to?.url.pathname ?? null);
	let isCrossRouteNavigation = $derived(
		shouldShowClientRouteSkeleton($navigating?.from?.url, $navigating?.to?.url)
	);
	let showClientRouteSkeleton = $state(false);

	$effect(() => {
		if (!isCrossRouteNavigation || !navigationTargetPathname) {
			showClientRouteSkeleton = false;
			return;
		}

		// Warm the destination skeleton chunk during the delay window so the
		// swap (if it happens) renders immediately.
		void loadRouteSkeletonComponent(navigationTargetPathname);

		const timer = setTimeout(() => {
			showClientRouteSkeleton = true;
		}, ROUTE_SKELETON_DELAY_MS);

		return () => {
			clearTimeout(timer);
			showClientRouteSkeleton = false;
		};
	});

	let pathname = $derived(
		showClientRouteSkeleton && navigationTargetPathname
			? navigationTargetPathname
			: $page.url.pathname
	);
	let isMarketingPage = $derived(pathname === '/');
	let isStandaloneShell = $derived(usesStandaloneShell(pathname));

	$effect(() => {
		if (isStandaloneShell) return;

		import('@vercel/speed-insights/sveltekit').then((m) => m.injectSpeedInsights());
		import('@vercel/analytics/sveltekit').then((m) => m.injectAnalytics());
	});

	let usesPublicShell = $derived(
		pathname === '/' ||
			pathname === '/api' ||
			pathname === '/bot' ||
			pathname.startsWith('/evals') ||
			pathname.startsWith('/benchmarks') ||
			pathname === '/subscription' ||
			pathname.startsWith('/docs') ||
			pathname.startsWith('/blog')
	);
	let shouldShowUnifiedHeader = $derived(
		usesPublicShell ||
			(!data.auth.isSignedIn && (pathname === '/catalog' || pathname.startsWith('/analytics')))
	);

	// Cherry drawer: available on every authenticated app page except
	// /chat itself (which is the full workspace).
	let isChatRoute = $derived(pathname === '/chat' || pathname.startsWith('/chat/'));
	let hasChatAccess = $derived(
		data.auth.isSignedIn && (data.auth.ppiAccess === true || checkRole(data.auth.role, 'member'))
	);
	let activeChatAgent = $derived(
		resolveCherryAgent({
			ppiAccess: data.auth.ppiAccess,
			memberAccess: checkRole(data.auth.role, 'member')
		})
	);
	let isChatWorkspace = $derived(isChatRoute && hasChatAccess);
	let canUseChatDrawer = $derived(
		hasChatAccess && !isStandaloneShell && !usesPublicShell && !isChatRoute
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
	<UnifiedHeader auth={data.auth} />
{/if}

{#if isMarketingPage}
	<div class="min-h-screen">
		{#if showClientRouteSkeleton}
			<RouteSkeleton pathname={navigationTargetPathname} />
		{:else}
			{@render children()}
		{/if}
		<CookieBanner />
	</div>
{:else if isStandaloneShell}
	{#if showClientRouteSkeleton}
		<RouteSkeleton pathname={navigationTargetPathname} />
	{:else}
		{@render children()}
	{/if}
{:else if data.auth.isSignedIn && !usesPublicShell}
	<div class="flex {isChatWorkspace ? 'h-dvh overflow-hidden' : 'min-h-screen'}">
		<LeftSidebar {data} />
		<MobileAppShell {data} />

		<main class="{contentMargin} min-h-0 min-w-0 flex-1 transition-all duration-300 ease-out">
			<div
				class="h-full overflow-x-clip {isChatWorkspace
					? 'px-4 pt-20 sm:px-6 md:pl-6 md:pr-12 md:pt-4'
					: 'px-4 pb-6 pt-20 sm:px-6 md:pb-0 md:pl-6 md:pr-12 md:pt-4'}"
			>
				{#if showClientRouteSkeleton}
					<RouteSkeleton pathname={navigationTargetPathname} />
				{:else}
					{@render children()}
				{/if}
			</div>
		</main>

		{#if canUseChatDrawer && activeChatAgent}
			{#if !chatDrawerOpen}
				<button
					type="button"
					onclick={() => (chatDrawerOpen = true)}
					class="fixed bottom-6 right-4 z-30 flex items-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-medium text-ink shadow-lg transition-transform hover:scale-105"
					title={`Open ${activeChatAgent.name} (Ctrl+K)`}
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M8 10h8m-8 4h5m-9.5 5.5L4 16.06A8.96 8.96 0 013 12a9 9 0 119 9 8.96 8.96 0 01-4.06-1z"
						/>
					</svg>
					{activeChatAgent.name}
				</button>
			{/if}
			<ChatDrawer
				bind:open={chatDrawerOpen}
				role={data.auth.role}
				ppiAccess={data.auth.ppiAccess}
			/>
		{/if}
	</div>
{:else}
	<div class="min-h-screen overflow-x-clip">
		<main class="flex-1">
			<div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
				{#if showClientRouteSkeleton}
					<RouteSkeleton pathname={navigationTargetPathname} />
				{:else}
					{@render children()}
				{/if}
			</div>
		</main>
	</div>
{/if}

<SeoHead meta={$page.data.meta as PageMeta | undefined} />
