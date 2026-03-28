<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { checkRole } from '$lib/types/auth.types';

	import type { UserRole } from '$lib/types/auth.types';

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

	let isHomePage = $derived(currentPath === '/');
	let isDashboardPage = $derived(currentPath === '/dashboard');
	let apiNavTarget = $derived(isSignedIn ? '/api-dashboard' : '/api');
	let isApiNavActive = $derived(currentPath === '/api' || currentPath.startsWith('/api-dashboard'));
	let isDocsPage = $derived(currentPath.startsWith('/docs'));
	let isBlogPage = $derived(currentPath.startsWith('/blog'));
	let isCatalogPage = $derived(currentPath === '/catalog');
	let isAnalyticsPage = $derived(currentPath.startsWith('/analytics'));

	const signedInQuickLinks = $derived.by(() => {
		if (!isSignedIn || !canAccessMemberRoutes) return [] as Array<{ href: string; label: string }>;

		return [
			{ href: '/beans', label: 'Inventory' },
			{ href: '/roast', label: 'Roast' }
		];
	});

	function navigateTo(path: string) {
		goto(path);
	}
</script>

<header
	class="sticky top-0 z-50 border-b border-border-light bg-background-primary-light/95 backdrop-blur-sm"
>
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
				<button
					onclick={() => navigateTo('/catalog')}
					class="text-sm font-medium transition-colors duration-200 {isCatalogPage
						? 'text-background-tertiary-light'
						: 'text-text-secondary-light hover:text-text-primary-light'}"
				>
					Catalog
				</button>
				<button
					onclick={() => navigateTo('/analytics')}
					class="text-sm font-medium transition-colors duration-200 {isAnalyticsPage
						? 'text-background-tertiary-light'
						: 'text-text-secondary-light hover:text-text-primary-light'}"
				>
					Market Data
				</button>
				<button
					onclick={() => navigateTo('/')}
					class="text-sm font-medium transition-colors duration-200 {isHomePage
						? 'text-background-tertiary-light'
						: 'text-text-secondary-light hover:text-text-primary-light'}"
				>
					Maillard Studio
				</button>
				<button
					onclick={() => navigateTo(apiNavTarget)}
					class="text-sm font-medium transition-colors duration-200 {isApiNavActive
						? 'text-background-tertiary-light'
						: 'text-text-secondary-light hover:text-text-primary-light'}"
				>
					{isSignedIn ? 'Console' : 'API'}
				</button>
				<button
					onclick={() => navigateTo('/docs')}
					class="text-sm font-medium transition-colors duration-200 {isDocsPage
						? 'text-background-tertiary-light'
						: 'text-text-secondary-light hover:text-text-primary-light'}"
				>
					Docs
				</button>
				<button
					onclick={() => navigateTo('/blog')}
					class="text-sm font-medium transition-colors duration-200 {isBlogPage
						? 'text-background-tertiary-light'
						: 'text-text-secondary-light hover:text-text-primary-light'}"
				>
					Blog
				</button>
			</nav>

			<div class="flex items-center space-x-3">
				{#if isSignedIn}
					<div class="hidden items-center gap-3 lg:flex">
						{#each signedInQuickLinks as link}
							<button
								onclick={() => navigateTo(link.href)}
								class="text-sm font-medium text-text-secondary-light transition-colors duration-200 hover:text-background-tertiary-light"
							>
								{link.label}
							</button>
						{/each}
					</div>
					<button
						onclick={() => navigateTo('/dashboard')}
						class="inline-flex items-center rounded-md bg-background-tertiary-light px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-background-tertiary-light {isDashboardPage
							? 'ring-2 ring-background-tertiary-light/30 ring-offset-2 ring-offset-background-primary-light'
							: ''}"
					>
						Dashboard
					</button>
				{:else}
					<button
						onclick={() => navigateTo('/auth')}
						class="hidden items-center rounded-md border border-background-tertiary-light px-4 py-2 text-sm font-medium text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white sm:inline-flex"
					>
						Sign In
					</button>
					<button
						onclick={() => navigateTo('/auth')}
						class="inline-flex items-center rounded-md bg-background-tertiary-light px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-background-tertiary-light"
					>
						Get Started
					</button>
				{/if}

				<div class="md:hidden">
					<button
						type="button"
						class="inline-flex items-center justify-center rounded-md p-2 text-text-secondary-light hover:bg-background-secondary-light hover:text-text-primary-light focus:outline-none focus:ring-2 focus:ring-inset focus:ring-background-tertiary-light"
						onclick={() => {
							const menu = document.getElementById('mobile-menu');
							if (menu) {
								menu.classList.toggle('hidden');
							}
						}}
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
								d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
							/>
						</svg>
					</button>
				</div>
			</div>
		</div>

		<div class="hidden md:hidden" id="mobile-menu">
			<div class="space-y-1 pb-3 pt-2">
				<button
					onclick={() => navigateTo('/catalog')}
					class="block w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors duration-200 {isCatalogPage
						? 'bg-background-tertiary-light/10 text-background-tertiary-light'
						: 'text-text-secondary-light hover:bg-background-secondary-light hover:text-text-primary-light'}"
				>
					Catalog
				</button>
				<button
					onclick={() => navigateTo('/analytics')}
					class="block w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors duration-200 {isAnalyticsPage
						? 'bg-background-tertiary-light/10 text-background-tertiary-light'
						: 'text-text-secondary-light hover:bg-background-secondary-light hover:text-text-primary-light'}"
				>
					Market Data
				</button>
				<button
					onclick={() => navigateTo('/')}
					class="block w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors duration-200 {isHomePage
						? 'bg-background-tertiary-light/10 text-background-tertiary-light'
						: 'text-text-secondary-light hover:bg-background-secondary-light hover:text-text-primary-light'}"
				>
					Maillard Studio
				</button>
				<button
					onclick={() => navigateTo(apiNavTarget)}
					class="block w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors duration-200 {isApiNavActive
						? 'bg-background-tertiary-light/10 text-background-tertiary-light'
						: 'text-text-secondary-light hover:bg-background-secondary-light hover:text-text-primary-light'}"
				>
					{isSignedIn ? 'Console' : 'API'}
				</button>
				<button
					onclick={() => navigateTo('/docs')}
					class="block w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors duration-200 {isDocsPage
						? 'bg-background-tertiary-light/10 text-background-tertiary-light'
						: 'text-text-secondary-light hover:bg-background-secondary-light hover:text-text-primary-light'}"
				>
					Docs
				</button>
				<button
					onclick={() => navigateTo('/blog')}
					class="block w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors duration-200 {isBlogPage
						? 'bg-background-tertiary-light/10 text-background-tertiary-light'
						: 'text-text-secondary-light hover:bg-background-secondary-light hover:text-text-primary-light'}"
				>
					Blog
				</button>
			</div>
			<div class="border-t border-border-light pb-3 pt-3">
				{#if isSignedIn}
					<button
						onclick={() => navigateTo('/dashboard')}
						class="mb-2 block w-full rounded-md bg-background-tertiary-light px-3 py-2 text-left text-sm font-medium text-white"
					>
						Dashboard
					</button>
					{#each signedInQuickLinks as link}
						<button
							onclick={() => navigateTo(link.href)}
							class="block w-full rounded-md px-3 py-2 text-left text-sm font-medium text-text-secondary-light transition-colors duration-200 hover:bg-background-secondary-light hover:text-text-primary-light"
						>
							{link.label}
						</button>
					{/each}
				{:else}
					<button
						onclick={() => navigateTo('/auth')}
						class="block w-full rounded-md px-3 py-2 text-left text-sm font-medium text-background-tertiary-light transition-colors duration-200 hover:bg-background-secondary-light"
					>
						Sign In
					</button>
					<button
						onclick={() => navigateTo('/auth')}
						class="mt-2 block w-full rounded-md bg-background-tertiary-light px-3 py-2 text-left text-sm font-medium text-white"
					>
						Get Started
					</button>
				{/if}
			</div>
		</div>
	</div>
</header>
