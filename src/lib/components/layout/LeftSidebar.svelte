<!-- src/lib/components/layout/LeftSidebar.svelte -->
<script lang="ts">
	import { page } from '$app/state';
	import { slide } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { onMount } from 'svelte';

	// Props for the sidebar
	let { data, onMenuChange = () => {} } = $props<{
		data: any;
		onMenuChange?: (menu: string | null) => void;
	}>();

	// Import the menu components
	import NavbarButton from '$lib/components/layout/Navbar.svelte';
	import SettingsButton from '$lib/components/layout/Settingsbar.svelte';
	import ActionsButton from '$lib/components/layout/Actionsbar.svelte';

	// State for tracking which menu is open
	let activeMenu = $state<string | null>(null);

	// Reference to the sidebar buttons container
	let sidebarButtonsContainer = $state<HTMLElement | null>(null);
	// Reference to the menu panels container
	let menuPanelsContainer = $state<HTMLElement | null>(null);

	// Close menus when route changes, but store the current route to prevent unnecessary closing
	let currentRoute = $state(page.url.pathname);

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
	<div class="flex h-full w-16 flex-col items-center space-y-4 bg-transparent py-4">
		<!-- User/Navigation Menu -->
		<div class="relative">
			<button
				onclick={toggleNavMenu}
				class="bg-background-primary-dark text-text-primary-dark rounded-full p-2 shadow-lg hover:opacity-90"
				aria-label="Toggle navigation menu"
			>
				{#if data?.session?.user}
					<!-- User Avatar/Icon -->
					<div
						class="text-text-primary-dark flex h-8 w-8 items-center justify-center rounded-full bg-transparent hover:text-background-tertiary-light"
					>
						{data.session.user.email?.[0].toUpperCase() || 'U'}
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

		<!-- Actions Menu -->
		<div class="relative">
			<button
				onclick={toggleActionsMenu}
				class="bg-background-primary-dark text-text-primary-dark rounded-full p-2 shadow-lg hover:text-background-tertiary-light hover:opacity-90"
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

		<!-- Settings Menu -->
		<div class="relative">
			<button
				onclick={toggleSettingsMenu}
				class="bg-background-primary-dark text-text-primary-dark rounded-full p-2 shadow-lg hover:text-background-tertiary-light hover:opacity-90"
				aria-label="Toggle filters"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-8 w-8"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					transform="translate(7, 7)"
				>
					<path
						d="M2 10.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5m0-3a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5m0-3a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5"
					/>
				</svg>
			</button>
		</div>

		<!-- Spacer to push potential future buttons to the bottom -->
		<div class="flex-grow"></div>
	</div>
</div>

<!-- Menu panels container - positioned fixed to the left of the screen -->
{#if activeMenu}
	<div
		class="fixed left-0 top-0 z-40 h-full"
		transition:slide={{ duration: 300, easing: quintOut, axis: 'x' }}
		bind:this={menuPanelsContainer}
		data-menu-panel="true"
	>
		<!-- Navigation Menu Panel -->
		{#if activeMenu === 'nav'}
			<aside
				class="bg-background-primary-dark text-text-primary-dark h-full w-64"
				role="navigation"
				aria-label="Main navigation menu"
			>
				<NavbarButton {data} isOpen={true} onClose={closeAllMenus} />
			</aside>
		{/if}

		<!-- Actions Menu Panel -->
		{#if activeMenu === 'actions'}
			<aside
				class="bg-background-primary-dark text-text-primary-dark h-full w-64"
				aria-label="Actions menu"
			>
				<ActionsButton {data} isOpen={true} onClose={closeAllMenus} />
			</aside>
		{/if}

		<!-- Settings Menu Panel -->
		{#if activeMenu === 'settings'}
			<aside
				class="bg-background-primary-dark text-text-primary-dark h-full w-64"
				aria-label="Settings menu"
			>
				<SettingsButton {data} isOpen={true} onClose={closeAllMenus} />
			</aside>
		{/if}
	</div>
{/if}
