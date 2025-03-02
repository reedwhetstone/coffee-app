<!-- src/lib/components/layout/LeftSidebar.svelte -->
<script lang="ts">
	import { page } from '$app/stores';

	// Props for the sidebar
	let { data } = $props<{
		data: any;
	}>();

	// Import the menu components
	import NavbarButton from '$lib/components/layout/Navbar.svelte';
	import SettingsButton from '$lib/components/layout/Settingsbar.svelte';

	// State for tracking which menu is open
	let activeMenu = $state<string | null>(null);

	// Function to toggle a menu
	function toggleMenu(menuId: string) {
		activeMenu = activeMenu === menuId ? null : menuId;
	}

	// Function to close all menus
	function closeAllMenus() {
		activeMenu = null;
	}

	// Close menus when route changes
	$effect(() => {
		const currentRoute = $page.url.pathname;
		closeAllMenus();
	});
</script>

<div class="fixed left-0 top-0 z-50 h-full w-16 bg-transparent">
	<div class="flex h-full flex-col items-center space-y-4 py-4">
		<!-- User/Navigation Menu -->
		<div class="relative">
			<button
				onclick={() => toggleMenu('nav')}
				class="bg-background-primary-dark text-text-primary-dark rounded-full p-2 shadow-lg hover:opacity-80"
				aria-label="Toggle navigation menu"
			>
				{#if data?.session?.user}
					<!-- User Avatar/Icon -->
					<div
						class="text-text-primary-dark flex h-8 w-8 items-center justify-center rounded-full bg-transparent"
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

			<!-- Navigation Menu Panel -->
			{#if activeMenu === 'nav'}
				<div class="absolute left-0">
					<NavbarButton {data} isOpen={true} onClose={() => closeAllMenus()} />
				</div>
			{/if}
		</div>

		<!-- Settings Menu -->
		<div class="relative">
			<button
				onclick={() => toggleMenu('settings')}
				class="bg-background-primary-dark text-text-primary-dark rounded-full p-2 shadow-lg hover:opacity-80"
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

			<!-- Settings Menu Panel -->
			{#if activeMenu === 'settings'}
				<div class="absolute left-0">
					<SettingsButton {data} isOpen={true} onClose={() => closeAllMenus()} />
				</div>
			{/if}
		</div>

		<!-- Add more menu buttons here as needed -->

		<!-- Spacer to push potential future buttons to the bottom -->
		<div class="flex-grow"></div>

		<!-- You can add bottom-aligned buttons here if needed -->
	</div>
</div>
