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
				class="rounded-full bg-background-secondary-light p-2 text-background-primary-light shadow-lg hover:bg-background-secondary-light/90"
				aria-label="Toggle navigation menu"
			>
				{#if data?.session?.user}
					<!-- User Avatar/Icon -->
					<div
						class="flex h-8 w-8 items-center justify-center rounded-full bg-sky-800 text-background-primary-light"
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
				class="rounded-full bg-background-secondary-light p-2 text-background-primary-light shadow-lg hover:bg-background-secondary-light/90"
				aria-label="Toggle settings"
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
