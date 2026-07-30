<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { onMount, tick } from 'svelte';
	import { filterStore } from '$lib/stores/filterStore';
	import { checkRole, type UserRole } from '$lib/types/auth.types';
	import { canManagePortfolio } from '$lib/services/portfolioAccess';
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
		class="flex h-full w-24 flex-col items-center border-r border-line bg-surface-canvas px-2 py-3 shadow-sm"
		aria-label="Desktop action bar"
	>
		<button
			type="button"
			onclick={(event) => toggleMenu('nav', event.currentTarget)}
			class="mb-2 flex w-20 flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium text-muted transition-colors hover:bg-surface-panel hover:text-ink"
			class:bg-surface-panel={activeMenu === 'nav'}
			class:text-ink={activeMenu === 'nav'}
			aria-label={activeMenu === 'nav' ? 'Close navigation' : 'Open navigation'}
			aria-controls="desktop-shell-panel"
			aria-expanded={activeMenu === 'nav'}
		>
			<img src="/purveyors_logo_mark.svg" alt="" class="h-8 w-auto" />
			<span>Menu</span>
		</button>

		<button
			type="button"
			onclick={handleChatClick}
			class="flex w-20 flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium text-ink transition-colors hover:bg-accent/20"
			aria-label="Open chat"
		>
			<DesktopShellIcon name="chat" />
			<span>Chat</span>
		</button>

		{#if canUseActions}
			<button
				type="button"
				onclick={(event) => toggleMenu('actions', event.currentTarget)}
				class="mt-1 flex w-20 flex-col items-center gap-1 rounded-lg bg-accent px-2 py-2 text-xs font-semibold text-ink shadow-sm transition-opacity hover:opacity-90"
				aria-label={activeMenu === 'actions' ? 'Close actions' : 'Open actions'}
				aria-controls="desktop-shell-panel"
				aria-expanded={activeMenu === 'actions'}
			>
				<DesktopShellIcon name="actions" />
				<span>New</span>
			</button>
		{/if}

		{#if showSettings}
			<button
				type="button"
				onclick={(event) => toggleMenu('settings', event.currentTarget)}
				class="relative mt-1 flex w-20 flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium text-muted transition-colors hover:bg-surface-panel hover:text-ink"
				class:bg-surface-panel={activeMenu === 'settings'}
				class:text-ink={activeMenu === 'settings'}
				aria-label={activeMenu === 'settings' ? 'Close filters' : 'Open filters'}
				aria-controls="desktop-shell-panel"
				aria-expanded={activeMenu === 'settings'}
			>
				<DesktopShellIcon name="filters" />
				<span>Filters</span>
				{#if activeFilterCount > 0}
					<span
						class="absolute right-2 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-ink"
						aria-label={`${activeFilterCount} active filters`}>{activeFilterCount}</span
					>
				{/if}
			</button>
		{/if}

		{#if isAdmin}
			<button
				type="button"
				onclick={(event) => toggleMenu('admin', event.currentTarget)}
				class="mt-1 flex w-20 flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium text-muted transition-colors hover:bg-surface-panel hover:text-ink"
				class:bg-surface-panel={activeMenu === 'admin'}
				class:text-ink={activeMenu === 'admin'}
				aria-label={activeMenu === 'admin' ? 'Close admin tools' : 'Open admin tools'}
				aria-controls="desktop-shell-panel"
				aria-expanded={activeMenu === 'admin'}
			>
				<DesktopShellIcon name="admin" />
				<span>Admin</span>
			</button>
		{/if}

		<div class="mt-auto border-t border-line pt-3">
			<button
				type="button"
				onclick={(event) => toggleMenu('auth', event.currentTarget)}
				class="flex w-20 flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium text-muted transition-colors hover:bg-surface-panel hover:text-ink"
				class:bg-surface-panel={activeMenu === 'auth'}
				class:text-ink={activeMenu === 'auth'}
				aria-label={activeMenu === 'auth' ? 'Close account' : 'Open account'}
				aria-controls="desktop-shell-panel"
				aria-expanded={activeMenu === 'auth'}
			>
				<span
					class="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-semibold text-ink"
					>{userInitial}</span
				>
				<span>Account</span>
			</button>
		</div>
	</aside>
</div>

{#if activeMenu}
	<div
		id="desktop-shell-panel"
		class="fixed inset-y-0 left-24 z-50 hidden w-72 border-r border-line bg-surface-canvas shadow-xl md:block"
		bind:this={panel}
		tabindex="-1"
		role="region"
		aria-label={`${getMenuLabel(activeMenu)} panel`}
		data-menu-panel="true"
	>
		{@render menuPanel(activeMenu)}
	</div>
{/if}
