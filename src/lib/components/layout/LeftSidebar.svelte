<!-- src/lib/components/layout/LeftSidebar.svelte -->
<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { slide } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { onMount } from 'svelte';
	import { checkRole } from '$lib/types/auth.types';
	import { workspaceStore, type Workspace } from '$lib/stores/workspaceStore.svelte';

	// Props for the sidebar
	let { data, onMenuChange = () => {} } = $props<{
		data: Record<string, unknown>;
		onMenuChange?: (menu: string | null) => void;
	}>();

	// Import the menu components
	import NavbarButton from '$lib/components/layout/Navbar.svelte';
	import SettingsButton from '$lib/components/layout/Settingsbar.svelte';
	import ActionsButton from '$lib/components/layout/Actionsbar.svelte';
	import AuthSidebar from '$lib/components/layout/AuthSidebar.svelte';
	import AdminSidebar from '$lib/components/layout/AdminSidebar.svelte';

	// State for tracking which menu is open
	let activeMenu = $state<string | null>(null);

	// Reference to the sidebar buttons container
	let sidebarButtonsContainer = $state<HTMLElement | null>(null);
	// Reference to the menu panels container
	let menuPanelsContainer = $state<HTMLElement | null>(null);

	// Close menus when route changes, but store the current route to prevent unnecessary closing
	let currentRoute = $state(page.url.pathname);

	import type { UserRole } from '$lib/types/auth.types';

	// Role checking logic
	let userRole = $derived((data?.role as UserRole) || 'viewer');
	let isMember = $derived(checkRole(userRole, 'member'));
	let isAdmin = $derived(checkRole(userRole, 'admin'));

	// Pages where settings (filters) should be shown
	let showSettings = $derived(() => {
		const filterPages = ['/catalog', '/beans', '/roast', '/profit'];
		return filterPages.includes(currentRoute);
	});

	// Debug data object to see what's being passed to the ActionsButton
	$effect(() => {
		if (activeMenu === 'actions') {
			//console.log('LeftSidebar data passed to ActionsButton:', data);
			//console.log('Route ID when opening actions menu:', page.route.id);
		}
	});

	// Function to toggle a menu
	function toggleMenu(menuId: string) {
		//console.log('toggleMenu called with menuId:', menuId);
		//console.log('Current activeMenu:', activeMenu);

		// Simple toggle: if the same menu is clicked, close it; otherwise open the new one
		activeMenu = activeMenu === menuId ? null : menuId;

		//console.log('New activeMenu:', activeMenu);
		// Notify parent components about the menu state change
		onMenuChange(activeMenu);
	}

	// Function to toggle the auth menu
	function toggleAuthMenu() {
		toggleMenu('auth');
	}

	// Function to toggle the nav menu
	function toggleNavMenu() {
		toggleMenu('nav');
	}

	// Function to toggle the settings menu
	function toggleSettingsMenu() {
		toggleMenu('settings');
	}

	// Function to toggle the actions menu
	function toggleActionsMenu() {
		toggleMenu('actions');
	}

	// Function to toggle the admin menu
	function toggleAdminMenu() {
		toggleMenu('admin');
	}

	// Function to handle Coffee Chat button click
	function handleChatClick() {
		if (page.url.pathname === '/chat') {
			// Already on /chat — toggle workspace panel
			toggleMenu('workspaces');
		} else {
			// Navigate to /chat
			goto('/chat');
		}
	}

	// ─── Workspace panel state ──────────────────────────────────────────────
	let isOnChatPage = $derived(page.url.pathname === '/chat');
	let showCreateForm = $state(false);
	let newWsName = $state('');
	let newWsType = $state<Workspace['type']>('general');
	let editingWsId = $state<string | null>(null);
	let editWsValue = $state('');

	const wsTypeColors: Record<Workspace['type'], string> = {
		general: 'bg-gray-400',
		sourcing: 'bg-green-500',
		roasting: 'bg-orange-500',
		inventory: 'bg-blue-500',
		analysis: 'bg-purple-500'
	};

	const wsTypeLabels: Record<Workspace['type'], string> = {
		general: 'General',
		sourcing: 'Sourcing',
		roasting: 'Roasting',
		inventory: 'Inventory',
		analysis: 'Analysis'
	};

	function handleWsCreate() {
		const name = newWsName.trim() || 'New Workspace';
		workspaceStore.uiCallbacks?.onCreate(name, newWsType);
		newWsName = '';
		newWsType = 'general';
		showCreateForm = false;
	}

	function startWsRename(ws: Workspace) {
		editingWsId = ws.id;
		editWsValue = ws.title;
	}

	function saveWsRename() {
		if (editingWsId && editWsValue.trim()) {
			workspaceStore.uiCallbacks?.onRename(editingWsId, editWsValue.trim());
		}
		editingWsId = null;
	}

	// Function to close all menus
	function closeAllMenus() {
		activeMenu = null;
		// Notify parent components about the menu state change
		onMenuChange(activeMenu);
	}

	// Handle clicks on the document to close menus when clicking outside
	function handleDocumentClick(event: MouseEvent) {
		// If no menu is open, do nothing
		if (!activeMenu) return;

		const target = event.target as HTMLElement;

		// Check if the click is on an element with data-menu-toggle attribute or its descendant
		// This covers the sidebar buttons that toggle the menus
		if (sidebarButtonsContainer && sidebarButtonsContainer.contains(target)) {
			return;
		}

		// Check if the click is on an element with data-menu-panel attribute or its descendant
		// This covers the menu panels
		if (menuPanelsContainer && menuPanelsContainer.contains(target)) {
			return;
		}

		// If we get here, the click was outside both the sidebar buttons and menu panels
		closeAllMenus();
	}

	// Close menus when route changes
	$effect(() => {
		const newRoute = page.url.pathname;
		// Only close menus if the route actually changed
		if (newRoute !== currentRoute) {
			currentRoute = newRoute;
			closeAllMenus();
		}
	});

	// Set up and clean up document click handler
	onMount(() => {
		// Add click handler to the document
		document.addEventListener('mousedown', handleDocumentClick);

		// Clean up on component destruction
		return () => {
			document.removeEventListener('mousedown', handleDocumentClick);
		};
	});

	// Calculate sidebar position based on active menu
	let sidebarPosition = $derived(activeMenu ? 'left-64' : 'left-0');
</script>

<div
	class="fixed top-0 z-50 h-full {sidebarPosition} transition-all duration-300 ease-out"
	bind:this={sidebarButtonsContainer}
>
	{#if (data?.session as { user?: { email?: string } })?.user}
		<div
			class="flex h-full w-16 flex-col items-center space-y-4 bg-background-primary-light py-4 shadow-lg"
		>
			<!-- Auth Menu Button -->
			<div class="relative">
				<button
					onclick={toggleAuthMenu}
					class="rounded-full bg-background-secondary-light p-2 text-text-primary-light shadow-sm ring-1 ring-border-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white"
					aria-label="Toggle authentication menu"
				>
					{#if data?.user as { email?: string }}
						<!-- User Avatar/Icon -->
						<div
							class="flex h-8 w-8 items-center justify-center rounded-full bg-background-tertiary-light font-medium text-white"
						>
							{(data.user as { email?: string }).email?.[0].toUpperCase() || 'U'}
						</div>
					{:else}
						<!-- Default Profile Icon -->
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-8 w-8"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
							/>
						</svg>
					{/if}
				</button>
			</div>

			<!-- Coffee Chat Button with Orange Glow -->
			<div class="relative">
				<button
					onclick={handleChatClick}
					class="flex items-center justify-center rounded-full bg-background-secondary-light p-2 text-text-primary-light ring-1 ring-border-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white hover:ring-background-tertiary-light {activeMenu === 'workspaces' ? 'ring-2 ring-background-tertiary-light' : ''}"
					style="box-shadow: 0 0 20px rgba(249, 165, 123, 0.5), 0 1px 2px 0 rgb(0 0 0 / 0.05);"
					aria-label="Coffee Chat"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-8 w-8"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="m19 19-3.5-3.5m0 0a6 6 0 1 0-8.485-8.485 6 6 0 0 0 8.485 8.485z"
						/>
					</svg>
				</button>
			</div>

			<!-- Navigation Menu -->
			<div class="relative">
				<button
					onclick={toggleNavMenu}
					class="rounded-full bg-background-secondary-light p-2 text-text-primary-light shadow-sm ring-1 ring-border-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white"
					aria-label="Toggle navigation menu"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-8 w-8"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 6h16M4 12h16M4 18h16"
						/>
					</svg>
				</button>
			</div>

			<!-- Actions Menu - Only for member users -->
			{#if isMember}
				<div class="relative">
					<button
						onclick={toggleActionsMenu}
						class="rounded-full bg-background-secondary-light p-2 text-text-primary-light shadow-sm ring-1 ring-border-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white"
						aria-label="Toggle actions"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-8 w-8"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 6v6m0 0v6m0-6h6m-6 0H6"
							/>
						</svg>
					</button>
				</div>
			{/if}

			<!-- Admin Menu - Only for admin users -->
			{#if isAdmin}
				<div class="relative">
					<button
						onclick={toggleAdminMenu}
						class="rounded-full bg-background-secondary-light p-2 text-text-primary-light shadow-sm ring-1 ring-border-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white"
						aria-label="Toggle admin menu"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-8 w-8"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
							/>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
							/>
						</svg>
					</button>
				</div>
			{/if}

			<!-- Settings Menu - Only on specific pages -->
			{#if showSettings()}
				<div class="relative">
					<button
						onclick={toggleSettingsMenu}
						class="rounded-full bg-background-secondary-light p-2 text-text-primary-light shadow-sm ring-1 ring-border-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white"
						aria-label="Toggle filters"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-8 w-8"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<!-- Three horizontal lines with slider dots -->
							<g stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
								<!-- First line with dot -->
								<line x1="4" y1="7" x2="12" y2="7" />
								<circle cx="14" cy="7" r="1.5" fill="currentColor" />
								<line x1="16" y1="7" x2="20" y2="7" />

								<!-- Second line with dot -->
								<line x1="4" y1="12" x2="8" y2="12" />
								<circle cx="10" cy="12" r="1.5" fill="currentColor" />
								<line x1="12" y1="12" x2="20" y2="12" />

								<!-- Third line with dot -->
								<line x1="4" y1="17" x2="14" y2="17" />
								<circle cx="16" cy="17" r="1.5" fill="currentColor" />
								<line x1="18" y1="17" x2="20" y2="17" />
							</g>
						</svg>
					</button>
				</div>
			{/if}

			<!-- Spacer to push potential future buttons to the bottom -->
			<div class="flex-grow"></div>
		</div>
	{/if}
</div>

<!-- Menu panels container - positioned fixed to the left of the screen -->
{#if activeMenu}
	<div
		class="fixed left-0 top-0 z-40 h-full"
		transition:slide={{ duration: 300, easing: quintOut, axis: 'x' }}
		bind:this={menuPanelsContainer}
		data-menu-panel="true"
	>
		<!-- Auth Menu Panel -->
		{#if activeMenu === 'auth'}
			<aside
				class="h-full w-64 bg-background-primary-light text-text-primary-light shadow-xl ring-1 ring-border-light"
				aria-label="User Login Menu"
			>
				<AuthSidebar {data} onClose={closeAllMenus} />
			</aside>
		{/if}

		<!-- Navigation Menu Panel -->
		{#if activeMenu === 'nav'}
			<aside
				class="h-full w-64 bg-background-primary-light text-text-primary-light shadow-xl ring-1 ring-border-light"
				role="navigation"
				aria-label="Main navigation menu"
			>
				<NavbarButton {data} onClose={closeAllMenus} />
			</aside>
		{/if}

		<!-- Actions Menu Panel -->
		{#if activeMenu === 'actions'}
			<aside
				class="h-full w-64 bg-background-primary-light text-text-primary-light shadow-xl ring-1 ring-border-light"
				aria-label="Actions menu"
			>
				<ActionsButton {data} onClose={closeAllMenus} />
			</aside>
		{/if}

		<!-- Settings Menu Panel -->
		{#if activeMenu === 'settings'}
			<aside
				class="h-full w-64 bg-background-primary-light text-text-primary-light shadow-xl ring-1 ring-border-light"
				aria-label="Settings menu"
			>
				<SettingsButton {data} isOpen={true} onClose={closeAllMenus} />
			</aside>
		{/if}

		<!-- Admin Menu Panel -->
		{#if activeMenu === 'admin'}
			<aside
				class="h-full w-64 bg-background-primary-light text-text-primary-light shadow-xl ring-1 ring-border-light"
				aria-label="Admin menu"
			>
				<AdminSidebar {data} onClose={closeAllMenus} />
			</aside>
		{/if}

		<!-- Workspaces Menu Panel -->
		{#if activeMenu === 'workspaces'}
			<aside
				class="flex h-full w-64 flex-col bg-background-primary-light text-text-primary-light shadow-xl ring-1 ring-border-light"
				aria-label="Workspaces menu"
			>
				<!-- Header -->
				<div class="flex items-center justify-between border-b border-border-light px-3 py-2.5">
					<span class="text-xs font-semibold uppercase tracking-wider text-text-secondary-light">Workspaces</span>
					<button
						onclick={closeAllMenus}
						class="rounded p-1 text-text-secondary-light transition-colors hover:text-text-primary-light"
						aria-label="Close"
					>
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<!-- Workspace list -->
				{#if workspaceStore.workspacesReady}
					<div class="flex-1 overflow-y-auto py-1">
						{#each workspaceStore.workspaces as ws (ws.id)}
							{@const isActive = ws.id === workspaceStore.currentWorkspaceId}
							{@const wsType = ws.type as Workspace['type']}
							<div
								role="button"
								tabindex="0"
								onclick={() => workspaceStore.uiCallbacks?.onSwitch(ws.id)}
								onkeydown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') workspaceStore.uiCallbacks?.onSwitch(ws.id);
								}}
								class="group flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors {isActive
									? 'border-l-2 border-background-tertiary-light bg-background-secondary-light font-semibold text-text-primary-light'
									: 'text-text-secondary-light hover:bg-background-secondary-light/50 hover:text-text-primary-light'}"
							>
								<!-- Type dot -->
								<span class="h-2.5 w-2.5 shrink-0 rounded-full {wsTypeColors[wsType]} {isActive ? 'ring-2 ring-background-tertiary-light/40' : ''}"></span>

								{#if editingWsId === ws.id}
									<input
										type="text"
										bind:value={editWsValue}
										onblur={saveWsRename}
										onkeydown={(e) => {
											if (e.key === 'Enter') saveWsRename();
											if (e.key === 'Escape') (editingWsId = null);
										}}
										onclick={(e) => e.stopPropagation()}
										class="min-w-0 flex-1 rounded border border-border-light bg-transparent px-1 text-sm focus:outline-none"
									/>
								{:else}
									<!-- svelte-ignore a11y_no_static_element_interactions -->
									<span class="min-w-0 flex-1 truncate" ondblclick={() => startWsRename(ws)}>
										{ws.title}
									</span>
								{/if}

								<!-- Type label -->
								<span class="text-[10px] text-text-secondary-light">{wsTypeLabels[wsType]}</span>

								<!-- Delete button (hover-visible) -->
								<button
									onclick={(e) => {
										e.stopPropagation();
										workspaceStore.uiCallbacks?.onDelete(ws.id);
									}}
									class="shrink-0 rounded p-0.5 text-text-secondary-light opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
									title="Delete workspace"
								>
									<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
									</svg>
								</button>
							</div>
						{/each}
					</div>
				{:else}
					<div class="flex flex-1 items-center justify-center">
						<span class="text-sm text-text-secondary-light">Loading...</span>
					</div>
				{/if}

				<!-- Footer: New workspace -->
				<div class="border-t border-border-light p-2">
					{#if showCreateForm}
						<div class="space-y-2">
							<input
								type="text"
								bind:value={newWsName}
								placeholder="Workspace name"
								class="w-full rounded border border-border-light bg-background-secondary-light px-2 py-1 text-sm text-text-primary-light placeholder-text-secondary-light focus:border-background-tertiary-light focus:outline-none"
								onkeydown={(e) => {
									if (e.key === 'Enter') handleWsCreate();
									if (e.key === 'Escape') (showCreateForm = false);
								}}
							/>
							<select
								bind:value={newWsType}
								class="w-full rounded border border-border-light bg-background-secondary-light px-2 py-1 text-sm text-text-primary-light focus:border-background-tertiary-light focus:outline-none"
							>
								<option value="general">General</option>
								<option value="sourcing">Sourcing</option>
								<option value="roasting">Roasting</option>
								<option value="inventory">Inventory</option>
								<option value="analysis">Analysis</option>
							</select>
							<div class="flex gap-1">
								<button
									onclick={handleWsCreate}
									class="flex-1 rounded bg-background-tertiary-light px-2 py-1 text-xs font-medium text-white transition-all hover:bg-opacity-90"
								>
									Create
								</button>
								<button
									onclick={() => (showCreateForm = false)}
									class="flex-1 rounded border border-border-light px-2 py-1 text-xs text-text-secondary-light transition-all hover:text-text-primary-light"
								>
									Cancel
								</button>
							</div>
						</div>
					{:else}
						<button
							onclick={() => (showCreateForm = true)}
							class="flex w-full items-center justify-center gap-1.5 rounded px-2 py-1.5 text-sm text-text-secondary-light transition-colors hover:bg-background-secondary-light hover:text-text-primary-light"
							title="New workspace"
						>
							<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
							</svg>
							<span>New Workspace</span>
						</button>
					{/if}
				</div>
			</aside>
		{/if}
	</div>
{/if}
