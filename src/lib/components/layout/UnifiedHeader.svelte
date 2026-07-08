<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { checkRole, type UserRole } from '$lib/types/auth.types';
	import {
		getAnalyticsSectionLinks,
		publicNavItems,
		isNavItemActive,
		type NavItem
	} from '$lib/components/layout/appNavigation';

	interface SessionData {
		user?: {
			email?: string;
		};
	}

	let { session = null, role = 'viewer' } = $props<{
		session?: SessionData | null;
		role?: UserRole;
	}>();

	let currentPath = $derived(page.url.pathname);
	let isSignedIn = $derived(Boolean(session?.user));
	let canAccessMemberRoutes = $derived(checkRole(role, 'member'));
	let isDashboardPage = $derived(currentPath === '/dashboard');
	let isMarketIndexPage = $derived(currentPath.startsWith('/analytics'));
	let marketIndexSectionLinks = $derived(
		getAnalyticsSectionLinks({ includeDisclosureIndex: isSignedIn })
	);
	let primaryCtaLabel = $derived(isMarketIndexPage ? 'See plans' : 'Explore Market Index');
	let primaryCtaHref = $derived(isMarketIndexPage ? '/subscription' : '/analytics');
	let mobileMenuOpen = $state(false);

	let headerNavItems = $derived.by(() => {
		return publicNavItems.map((item) => {
			if (item.href === '/api') {
				return {
					...item,
					label: isSignedIn ? 'Console' : 'API',
					href: isSignedIn ? '/api-dashboard' : '/api',
					matches: isSignedIn ? ['/api-dashboard'] : ['/api']
				} satisfies NavItem;
			}

			return item;
		});
	});

	const signedInQuickLinks = $derived.by(() => {
		if (!isSignedIn || !canAccessMemberRoutes) return [] as Array<{ href: string; label: string }>;

		return [
			{ href: '/beans', label: 'Inventory' },
			{ href: '/roast', label: 'Roast' }
		];
	});

	function navigateTo(path: string) {
		mobileMenuOpen = false;
		goto(path);
	}

	$effect(() => {
		void currentPath;
		mobileMenuOpen = false;
	});
</script>

<header class="sticky top-0 z-50 border-b border-line bg-surface-canvas/95 backdrop-blur-sm">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="flex items-center justify-between py-4">
			<div class="flex items-center space-x-4">
				<button
					onclick={() => navigateTo('/')}
					class="flex items-center transition-opacity duration-200 hover:opacity-80"
				>
					<img src="/purveyors_logo_mark.svg" alt="purveyors.io" class="h-9 w-auto" />
				</button>
			</div>

			<nav class="hidden items-center space-x-8 md:flex">
				{#each headerNavItems as item (item.href)}
					<button
						onclick={() => navigateTo(item.href)}
						class="text-sm font-medium transition-colors duration-200 {isNavItemActive(
							item,
							currentPath
						)
							? 'text-accent'
							: 'text-muted hover:text-ink'}"
					>
						{item.label}
					</button>
				{/each}
			</nav>

			<div class="flex items-center space-x-3">
				{#if isSignedIn}
					<div class="hidden items-center gap-3 lg:flex">
						{#each signedInQuickLinks as link}
							<button
								onclick={() => navigateTo(link.href)}
								class="text-sm font-medium text-muted transition-colors duration-200 hover:text-accent"
							>
								{link.label}
							</button>
						{/each}
					</div>
					<button
						onclick={() => navigateTo('/dashboard')}
						class="inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-ink shadow-sm transition-all duration-200 hover:bg-opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent {isDashboardPage
							? 'ring-2 ring-accent/30 ring-offset-2 ring-offset-surface-canvas'
							: ''}"
					>
						Dashboard
					</button>
				{:else}
					<button
						onclick={() => navigateTo('/auth')}
						class="hidden items-center rounded-md border border-accent px-4 py-2 text-sm font-medium text-accent transition-all duration-200 hover:bg-accent hover:text-ink sm:inline-flex"
					>
						Sign in
					</button>
					<button
						onclick={() => navigateTo(primaryCtaHref)}
						class="inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-ink shadow-sm transition-all duration-200 hover:bg-opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
					>
						{primaryCtaLabel}
					</button>
				{/if}

				<div class="md:hidden">
					<button
						type="button"
						class="inline-flex items-center justify-center rounded-md p-2 text-muted transition-colors hover:bg-surface-panel hover:text-ink focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent"
						onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
						aria-expanded={mobileMenuOpen}
						aria-controls="public-mobile-menu"
					>
						<span class="sr-only">Open main menu</span>
						<svg
							class="h-6 w-6"
							fill="none"
							viewBox="0 0 24 24"
							stroke-width="1.5"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d={mobileMenuOpen
									? 'M6 18 18 6M6 6l12 12'
									: 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5'}
							></path>
						</svg>
					</button>
				</div>
			</div>
		</div>

		{#if mobileMenuOpen}
			<div id="public-mobile-menu" class="border-t border-line pb-4 pt-3 md:hidden">
				<div class="space-y-2">
					{#each headerNavItems as item (item.href)}
						<button
							onclick={() => navigateTo(item.href)}
							class="block w-full rounded-xl px-3 py-3 text-left text-sm font-medium transition-colors duration-200 {isNavItemActive(
								item,
								currentPath
							)
								? 'bg-accent/10 text-accent'
								: 'text-muted hover:bg-surface-panel hover:text-ink'}"
						>
							{item.label}
						</button>
					{/each}
				</div>

				{#if isMarketIndexPage}
					<div class="mt-4 border-t border-line pt-4">
						<p class="px-3 text-xs font-semibold text-muted">Market Index sections</p>
						<div class="mt-2 grid grid-cols-2 gap-2">
							{#each marketIndexSectionLinks as link}
								<button
									onclick={() => navigateTo(link.menuHref)}
									class="rounded-lg bg-surface-panel px-3 py-2 text-left text-xs font-medium text-ink ring-1 ring-line transition-colors hover:bg-accent/10 hover:text-accent"
								>
									{link.label}
								</button>
							{/each}
						</div>
					</div>
				{/if}

				<div class="mt-4 border-t border-line pt-4">
					{#if isSignedIn}
						<button
							onclick={() => navigateTo('/dashboard')}
							class="mb-2 block w-full rounded-xl bg-accent px-3 py-3 text-left text-sm font-medium text-ink"
						>
							Dashboard
						</button>
						{#each signedInQuickLinks as link}
							<button
								onclick={() => navigateTo(link.href)}
								class="block w-full rounded-xl px-3 py-3 text-left text-sm font-medium text-muted transition-colors duration-200 hover:bg-surface-panel hover:text-ink"
							>
								{link.label}
							</button>
						{/each}
					{:else}
						<button
							onclick={() => navigateTo('/auth')}
							class="block w-full rounded-xl px-3 py-3 text-left text-sm font-medium text-accent transition-colors duration-200 hover:bg-surface-panel"
						>
							Sign in
						</button>
						<button
							onclick={() => navigateTo(primaryCtaHref)}
							class="mt-2 block w-full rounded-xl bg-accent px-3 py-3 text-left text-sm font-medium text-ink"
						>
							{primaryCtaLabel}
						</button>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</header>
