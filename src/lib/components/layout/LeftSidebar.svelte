<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { onMount, tick } from 'svelte';
	import { filterStore } from '$lib/stores/filterStore';
	import { checkRole, type UserRole } from '$lib/types/auth.types';
	import { canManagePortfolio } from '$lib/services/portfolioAccess';
	import { getCurrentRouteLabel } from '$lib/components/layout/appNavigation';
	import Navbar from '$lib/components/layout/Navbar.svelte';
	import Settingsbar from '$lib/components/layout/Settingsbar.svelte';
	import Actionsbar from '$lib/components/layout/Actionsbar.svelte';
	import AuthSidebar from '$lib/components/layout/AuthSidebar.svelte';
	import AdminSidebar from '$lib/components/layout/AdminSidebar.svelte';
	import DesktopShellIcon from '$lib/components/layout/DesktopShellIcon.svelte';
	import { countActiveCatalogFilters } from '$lib/components/layout/desktopShellState';

	type MenuId = 'auth' | 'nav' | 'settings' | 'actions' | 'admin';

	let { data } = $props<{
		data: Record<string, unknown>;
	}>();

	let activeMenu = $state<MenuId | null>(null);
	let shellContainer = $state<HTMLElement | null>(null);
	let panel = $state<HTMLElement | null>(null);
	let returnFocusTarget = $state<HTMLElement | null>(null);
	let currentRoute = $state(page.url.pathname);
	let trackedCatalogRoute = $state(Boolean((page.data as { trackedOnly?: boolean }).trackedOnly));

	let userRole = $derived(((data?.role as UserRole | undefined) ?? 'viewer') as UserRole);
	let ppiAccess = $derived(Boolean((data as { ppiAccess?: boolean }).ppiAccess));
	let canUseActions = $derived(canManagePortfolio(userRole, ppiAccess));
	let isAdmin = $derived(checkRole(userRole, 'admin'));
	let userEmail = $derived(
		((data?.user as { email?: string } | undefined)?.email ??
			(data?.session as { user?: { email?: string } } | undefined)?.user?.email ??
			'Purveyors member') as string
	);
	let userInitial = $derived(userEmail.charAt(0).toUpperCase() || 'P');
	let currentRouteLabel = $derived(getCurrentRouteLabel(currentRoute, userRole, { ppiAccess }));
	let showSettings = $derived(
		['/catalog', '/beans', '/roast'].includes(currentRoute) && !trackedCatalogRoute
	);
	let activeFilterCount = $derived(
		$filterStore.routeId === currentRoute
			? countActiveCatalogFilters({ ...$filterStore, routeId: currentRoute })
			: 0
	);

	function getMenuLabel(menu: MenuId): string {
		if (menu === 'auth') return 'Account';
		if (menu === 'nav') return 'Main navigation';
		if (menu === 'actions') return 'Actions';
		if (menu === 'settings') return 'Filters';
		return 'Admin';
	}

	async function setMenu(menu: MenuId | null, trigger?: HTMLElement) {
		if (trigger) returnFocusTarget = trigger;
		activeMenu = menu;
		if (!menu) return;

		await tick();
		panel?.focus();
	}

	function toggleMenu(menu: MenuId, trigger: HTMLElement) {
		if (activeMenu === menu) {
			void closeAllMenus();
			return;
		}
		void setMenu(menu, trigger);
	}

	async function closeAllMenus(restoreFocus = true) {
		const focusTarget = returnFocusTarget;
		activeMenu = null;
		returnFocusTarget = null;

		if (restoreFocus && focusTarget) {
			await tick();
			focusTarget.focus();
		}
	}

	function handleChatClick() {
		void closeAllMenus(false);
		void goto('/chat');
	}

	function handleDocumentClick(event: MouseEvent) {
		if (!activeMenu) return;
		const target = event.target as Node;
		if (shellContainer?.contains(target) || panel?.contains(target)) return;
		void closeAllMenus(false);
	}

	function handleGlobalKeydown(event: KeyboardEvent) {
		if (event.defaultPrevented || event.key !== 'Escape' || !activeMenu) return;
		event.preventDefault();
		void closeAllMenus();
	}

	$effect(() => {
		const nextRoute = page.url.pathname;
		const nextTrackedCatalogRoute = Boolean((page.data as { trackedOnly?: boolean }).trackedOnly);

		if (nextRoute !== currentRoute || nextTrackedCatalogRoute !== trackedCatalogRoute) {
			currentRoute = nextRoute;
			trackedCatalogRoute = nextTrackedCatalogRoute;
			void closeAllMenus(false);
		}
	});

	onMount(() => {
		document.addEventListener('mousedown', handleDocumentClick);
		return () => document.removeEventListener('mousedown', handleDocumentClick);
	});
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

{#snippet menuPanel(menu: MenuId)}
	{#if menu === 'auth'}
		<aside class="h-full bg-surface-canvas text-ink" aria-label="Account menu">
			<AuthSidebar {data} onClose={closeAllMenus} />
		</aside>
	{:else if menu === 'nav'}
		<aside class="h-full bg-surface-canvas text-ink" aria-label="Main navigation menu">
			<Navbar {data} onClose={closeAllMenus} />
		</aside>
	{:else if menu === 'actions'}
		<aside class="h-full bg-surface-canvas text-ink" aria-label="Actions menu">
			<Actionsbar {data} onClose={closeAllMenus} />
		</aside>
	{:else if menu === 'settings'}
		<aside class="h-full bg-surface-canvas text-ink" aria-label="Filters menu">
			<Settingsbar {data} isOpen={true} onClose={closeAllMenus} />
		</aside>
	{:else}
		<aside class="h-full bg-surface-canvas text-ink" aria-label="Admin menu">
			<AdminSidebar {data} onClose={closeAllMenus} />
		</aside>
	{/if}
{/snippet}

<div
	class="fixed inset-y-0 left-0 z-40 hidden md:flex"
	bind:this={shellContainer}
	data-testid="desktop-app-shell"
>
	<aside
		class="hidden h-full w-72 flex-col border-r border-line bg-surface-canvas shadow-sm xl:flex"
		aria-label="Desktop workspace navigation"
	>
		<div class="flex min-h-0 flex-1 flex-col" class:hidden={activeMenu !== null}>
			<div class="persistent-navigation min-h-0 flex-1">
				<Navbar {data} />
			</div>

			<div class="border-t border-line p-3">
				<p class="px-2 text-xs font-semibold text-muted">Current workspace</p>
				<p class="mt-1 truncate px-2 text-sm font-medium text-ink">{currentRouteLabel}</p>

				<div class="mt-3 grid grid-cols-2 gap-2">
					<button
						type="button"
						onclick={(event) => toggleMenu('auth', event.currentTarget)}
						class="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-left text-xs font-medium text-muted transition-colors hover:bg-surface-panel hover:text-ink"
						aria-controls="desktop-shell-panel"
						aria-expanded={activeMenu === 'auth'}
					>
						<span
							class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-ink"
							>{userInitial}</span
						>
						Account
					</button>
					<button
						type="button"
						onclick={handleChatClick}
						class="flex items-center gap-2 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-left text-xs font-medium text-ink transition-colors hover:bg-accent/20"
					>
						<DesktopShellIcon name="chat" />
						Chat
					</button>
					{#if canUseActions}
						<button
							type="button"
							onclick={(event) => toggleMenu('actions', event.currentTarget)}
							class="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-left text-xs font-medium text-muted transition-colors hover:bg-surface-panel hover:text-ink"
							aria-controls="desktop-shell-panel"
							aria-expanded={activeMenu === 'actions'}
						>
							<DesktopShellIcon name="actions" />
							Actions
						</button>
					{/if}
					{#if showSettings}
						<button
							type="button"
							onclick={(event) => toggleMenu('settings', event.currentTarget)}
							class="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-left text-xs font-medium text-muted transition-colors hover:bg-surface-panel hover:text-ink"
							aria-controls="desktop-shell-panel"
							aria-expanded={activeMenu === 'settings'}
						>
							<DesktopShellIcon name="filters" />
							<span>Filters</span>
							{#if activeFilterCount > 0}
								<span
									class="ml-auto rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-ink"
									aria-label={`${activeFilterCount} active filters`}>{activeFilterCount}</span
								>
							{/if}
						</button>
					{/if}
					{#if isAdmin}
						<button
							type="button"
							onclick={(event) => toggleMenu('admin', event.currentTarget)}
							class="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-left text-xs font-medium text-muted transition-colors hover:bg-surface-panel hover:text-ink"
							aria-controls="desktop-shell-panel"
							aria-expanded={activeMenu === 'admin'}
						>
							<DesktopShellIcon name="admin" />
							Admin
						</button>
					{/if}
				</div>
			</div>
		</div>
	</aside>

	<aside
		class="flex h-full w-20 flex-col items-center gap-3 border-r border-line bg-surface-canvas py-4 shadow-sm xl:hidden"
		aria-label="Desktop workspace controls"
	>
		<button
			type="button"
			onclick={(event) => toggleMenu('auth', event.currentTarget)}
			class="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-sm font-semibold text-ink transition-transform hover:scale-105"
			aria-label="Account"
			aria-controls="desktop-shell-panel"
			aria-expanded={activeMenu === 'auth'}
		>
			{userInitial}
		</button>

		<button
			type="button"
			onclick={handleChatClick}
			class="flex h-11 w-11 items-center justify-center rounded-lg border border-accent/40 bg-accent/10 text-ink transition-colors hover:bg-accent/20"
			aria-label="Chat"
		>
			<DesktopShellIcon name="chat" />
		</button>

		<button
			type="button"
			onclick={(event) => toggleMenu('nav', event.currentTarget)}
			class="flex h-11 w-11 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:bg-surface-panel hover:text-ink"
			class:bg-surface-panel={activeMenu === 'nav'}
			class:text-ink={activeMenu === 'nav'}
			aria-label="Navigation"
			aria-controls="desktop-shell-panel"
			aria-expanded={activeMenu === 'nav'}
		>
			<DesktopShellIcon name="navigation" />
		</button>

		{#if canUseActions}
			<button
				type="button"
				onclick={(event) => toggleMenu('actions', event.currentTarget)}
				class="flex h-11 w-11 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:bg-surface-panel hover:text-ink"
				class:bg-surface-panel={activeMenu === 'actions'}
				class:text-ink={activeMenu === 'actions'}
				aria-label="Actions"
				aria-controls="desktop-shell-panel"
				aria-expanded={activeMenu === 'actions'}
			>
				<DesktopShellIcon name="actions" />
			</button>
		{/if}

		{#if showSettings}
			<button
				type="button"
				onclick={(event) => toggleMenu('settings', event.currentTarget)}
				class="relative flex h-11 w-11 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:bg-surface-panel hover:text-ink"
				class:bg-surface-panel={activeMenu === 'settings'}
				class:text-ink={activeMenu === 'settings'}
				aria-label="Filters"
				aria-controls="desktop-shell-panel"
				aria-expanded={activeMenu === 'settings'}
			>
				<DesktopShellIcon name="filters" />
				{#if activeFilterCount > 0}
					<span
						class="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-ink"
						aria-label={`${activeFilterCount} active filters`}>{activeFilterCount}</span
					>
				{/if}
			</button>
		{/if}

		{#if isAdmin}
			<button
				type="button"
				onclick={(event) => toggleMenu('admin', event.currentTarget)}
				class="flex h-11 w-11 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:bg-surface-panel hover:text-ink"
				class:bg-surface-panel={activeMenu === 'admin'}
				class:text-ink={activeMenu === 'admin'}
				aria-label="Admin"
				aria-controls="desktop-shell-panel"
				aria-expanded={activeMenu === 'admin'}
			>
				<DesktopShellIcon name="admin" />
			</button>
		{/if}
	</aside>
</div>

{#if activeMenu}
	<div
		id="desktop-shell-panel"
		class="fixed inset-y-0 left-20 z-50 hidden w-72 border-r border-line bg-surface-canvas shadow-xl md:block xl:left-0"
		bind:this={panel}
		tabindex="-1"
		role="region"
		aria-label={`${getMenuLabel(activeMenu)} panel`}
		data-menu-panel="true"
	>
		{@render menuPanel(activeMenu)}
	</div>
{/if}

<style>
	@media (min-width: 1280px) {
		.persistent-navigation :global(header button[aria-label='Close navigation panel']) {
			display: none;
		}
	}
</style>
