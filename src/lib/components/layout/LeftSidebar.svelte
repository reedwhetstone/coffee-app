<!-- src/lib/components/layout/LeftSidebar.svelte -->
<script lang="ts">
	import { page } from '$app/state';
	import { slide } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { onMount } from 'svelte';
	import { checkRole } from '$lib/types/auth.types';

	// Props for the sidebar
	let { data, onMenuChange = () => {} } = $props<{
		data: any;
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

	// Role checking logic
	let userRole = $derived(data?.role || 'viewer');
	let isMember = $derived(checkRole(userRole, 'member'));
	let isAdmin = $derived(checkRole(userRole, 'admin'));

	// Pages where settings (filters) should be shown
	let showSettings = $derived(() => {
		const filterPages = ['/', '/beans', '/roast', '/profit'];
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
	{#if data?.session?.user}
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
					{#if data?.user}
						<!-- User Avatar/Icon -->
						<div
							class="flex h-8 w-8 items-center justify-center rounded-full bg-background-tertiary-light font-medium text-white"
						>
							{data.user.email?.[0].toUpperCase() || 'U'}
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
							viewBox="0 0 18 18"
							stroke="currentColor"
							transform="translate(2, 3)"
						>
							<path
								d="M1.5 1.5A.5.5 0 0 1 2 1h12a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.128.334L10 8.692V13.5a.5.5 0 0 1-.342.474l-3 1A.5.5 0 0 1 6 14.5V8.692L1.628 3.834A.5.5 0 0 1 1.5 3.5zm1 .5v1.308l4.372 4.858A.5.5 0 0 1 7 8.5v5.306l2-.666V8.5a.5.5 0 0 1 .128-.334L13.5 3.308V2z"
							/>
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
				<AuthSidebar {data} isOpen={true} onClose={closeAllMenus} />
			</aside>
		{/if}

		<!-- Navigation Menu Panel -->
		{#if activeMenu === 'nav'}
			<aside
				class="h-full w-64 bg-background-primary-light text-text-primary-light shadow-xl ring-1 ring-border-light"
				role="navigation"
				aria-label="Main navigation menu"
			>
				<NavbarButton {data} isOpen={true} onClose={closeAllMenus} />
			</aside>
		{/if}

		<!-- Actions Menu Panel -->
		{#if activeMenu === 'actions'}
			<aside
				class="h-full w-64 bg-background-primary-light text-text-primary-light shadow-xl ring-1 ring-border-light"
				aria-label="Actions menu"
			>
				<ActionsButton {data} isOpen={true} onClose={closeAllMenus} />
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
				<AdminSidebar {data} isOpen={true} onClose={closeAllMenus} />
			</aside>
		{/if}
	</div>
{/if}
