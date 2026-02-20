<script lang="ts">
	import '../app.css';
	import CookieBanner from '$lib/components/CookieBanner.svelte';
	import UnifiedHeader from '$lib/components/layout/UnifiedHeader.svelte';
	import LeftSidebar from '$lib/components/layout/LeftSidebar.svelte';
	import { setContext } from 'svelte';
	import { page } from '$app/state';

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
	let isMarketingPage = $derived(!data.session && page.url.pathname === '/');

	// Determine if we should show the unified header (unauthenticated users on public pages)
	let isBlogPage = $derived(page.url.pathname.startsWith('/blog'));
	let shouldShowUnifiedHeader = $derived(
		!data.session && (page.url.pathname === '/' || page.url.pathname === '/api' || isBlogPage)
	);
</script>

<!-- SEO Meta Tags -->
<svelte:head>
	{#if data.meta}
		<title>{data.meta.title || 'Purveyors'}</title>
		{#if data.meta.description}
			<meta name="description" content={data.meta.description} />
		{/if}
		{#if data.meta.keywords}
			<meta name="keywords" content={data.meta.keywords} />
		{/if}
		{#if data.meta.canonical}
			<link rel="canonical" href={data.meta.canonical} />
		{/if}
		{#if data.meta.robots}
			<meta name="robots" content={data.meta.robots} />
		{/if}
		{#if data.meta.author}
			<meta name="author" content={data.meta.author} />
		{/if}
		{#if data.meta.viewport}
			<meta name="viewport" content={data.meta.viewport} />
		{/if}
		{#if data.meta.themeColor}
			<meta name="theme-color" content={data.meta.themeColor} />
		{/if}

		<!-- Open Graph -->
		{#if data.meta.ogTitle}
			<meta property="og:title" content={data.meta.ogTitle} />
		{/if}
		{#if data.meta.ogDescription}
			<meta property="og:description" content={data.meta.ogDescription} />
		{/if}
		{#if data.meta.ogImage}
			<meta property="og:image" content={data.meta.ogImage} />
		{/if}
		{#if data.meta.ogUrl}
			<meta property="og:url" content={data.meta.ogUrl} />
		{/if}
		<meta property="og:type" content={data.meta.ogType || 'website'} />
		{#if data.meta.ogSiteName}
			<meta property="og:site_name" content={data.meta.ogSiteName} />
		{/if}
		{#if data.meta.ogLocale}
			<meta property="og:locale" content={data.meta.ogLocale} />
		{/if}

		<!-- Twitter -->
		{#if data.meta.twitterCard}
			<meta name="twitter:card" content={data.meta.twitterCard} />
		{/if}
		{#if data.meta.twitterTitle}
			<meta name="twitter:title" content={data.meta.twitterTitle} />
		{/if}
		{#if data.meta.twitterDescription}
			<meta name="twitter:description" content={data.meta.twitterDescription} />
		{/if}
		{#if data.meta.twitterImage}
			<meta name="twitter:image" content={data.meta.twitterImage} />
		{/if}
		{#if data.meta.twitterSite}
			<meta name="twitter:site" content={data.meta.twitterSite} />
		{/if}
		{#if data.meta.twitterCreator}
			<meta name="twitter:creator" content={data.meta.twitterCreator} />
		{/if}

		<!-- Structured Data -->
		{#if data.meta.structuredData}
			<!-- eslint-disable-next-line svelte/no-at-html-tags, no-useless-escape -->
			{@html `<script type="application/ld+json">${JSON.stringify(data.meta.structuredData)}<\/script>`}
		{/if}
		{#if data.meta.schemaData}
			{#if Array.isArray(data.meta.schemaData)}
				{#each data.meta.schemaData as schema}
					<!-- eslint-disable-next-line svelte/no-at-html-tags, no-useless-escape -->
					{@html `<script type="application/ld+json">${JSON.stringify(schema)}<\/script>`}
				{/each}
			{:else}
				<!-- eslint-disable-next-line svelte/no-at-html-tags, no-useless-escape -->
				{@html `<script type="application/ld+json">${JSON.stringify(data.meta.schemaData)}<\/script>`}
			{/if}
		{/if}

		<!-- Hreflang for international SEO -->
		{#if data.meta.hreflang}
			{#each data.meta.hreflang as lang}
				<link rel="alternate" hreflang={lang.lang} href={lang.href} />
			{/each}
		{/if}

		<!-- Performance hints -->
		{#if data.meta.preconnect}
			{#each data.meta.preconnect as url}
				<link rel="preconnect" href={url} />
			{/each}
		{/if}
		{#if data.meta.dnsPrefetch}
			{#each data.meta.dnsPrefetch as url}
				<link rel="dns-prefetch" href={url} />
			{/each}
		{/if}
	{:else}
		<title>Purveyors</title>
		<meta name="description" content="Professional coffee roasting platform" />
		<meta name="robots" content="index, follow" />
		<meta name="theme-color" content="#D97706" />
	{/if}
</svelte:head>

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
				<div class="h-full px-4 py-4">
					<!-- Page Content -->
					{@render children()}
				</div>
			</main>
		</div>
	{/if}
{/if}
