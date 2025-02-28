<script lang="ts">
	import { page } from '$app/state';
	import { afterNavigate } from '$app/navigation';
	import { navbarActions } from '$lib/stores/navbarStore';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import pkg from 'lodash';
	import { signInWithGoogle, signOut } from '$lib/supabase';
	import { checkRole } from '$lib/types/auth.types';
	const { debounce } = pkg;

	import { clickOutside } from '$lib/utils/clickOutside';

	// Update the props declaration
	let { data } = $props();

	// Destructure with default values to prevent undefined errors
	let { supabase, session, role = 'viewer' } = $derived(data);

	// Add type checking for role
	type UserRole = 'viewer' | 'member' | 'admin';
	let userRole: UserRole = $derived(role as UserRole);

	// Add more detailed debug logging
	$effect(() => {
		console.log('Navbar data:', data);
		console.log('Destructured role:', role);
		console.log('Parsed userRole:', userRole);
		console.log('data.role:', data.role);
	});

	// Use the imported checkRole function
	function hasRequiredRole(requiredRole: UserRole): boolean {
		const hasRole = checkRole(userRole, requiredRole);
		console.log(`Role check: ${userRole} >= ${requiredRole} = ${hasRole}`);
		return hasRole;
	}

	// Update routeId to use the store value directly
	let routeId = $state(page.route.id);

	// Update `routeId` after each navigation
	afterNavigate(() => {
		routeId = page.route.id;
		isMenuOpen = false;
	});

	// Function to handle Add New Bean click
	function handleAddNewBean() {
		goto('/').then(() => {
			$navbarActions.onAddNewBean();
		});
	}

	async function handleSignIn() {
		try {
			await signInWithGoogle(supabase);
		} catch (error) {
			console.error('Error signing in:', error);
		}
	}

	async function handleSignOut() {
		try {
			const { error } = await supabase.auth.signOut();
			if (error) throw error;
			// Force a page reload to clear any cached state
			window.location.href = '/';
		} catch (error) {
			console.error('Error signing out:', error);
		}
	}

	// Add state for mobile menu
	let isMenuOpen = $state(false);

	// Function to toggle mobile menu
	function toggleMenu() {
		isMenuOpen = !isMenuOpen;
	}

	// Close menu when route changes
	afterNavigate(() => {
		routeId = page.route.id;
		isMenuOpen = false;
	});

	function closeMenu() {
		isMenuOpen = false;
	}

	// Add the clickOutside action definition directly in the component
</script>

<div class="fixed right-4 top-4 z-50">
	<button
		onclick={toggleMenu}
		class="bg-background-secondary-light text-background-primary-light hover:bg-background-secondary-light/90 rounded-full p-2 shadow-lg"
		aria-label="Toggle menu"
	>
		{#if session?.user}
			<!-- User Avatar/Icon -->
			<div
				class="text-background-primary-light flex h-8 w-8 items-center justify-center rounded-full bg-sky-800"
			>
				{session.user.email?.[0].toUpperCase() || 'U'}
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

	{#if isMenuOpen}
		<div
			class="absolute right-0 mt-2 w-48 rounded-lg bg-white shadow-xl"
			use:clickOutside={{ handler: closeMenu }}
		>
			<div class="p-2">
				{#if session?.user}
					<div class="mb-2 border-b border-gray-200 pb-2 text-sm text-gray-600">
						{session.user.email}
					</div>
				{/if}

				{#if hasRequiredRole('member')}
					<nav class="space-y-1">
						<a
							href="/"
							class="block rounded px-3 py-2 text-sm {routeId === '/'
								? 'bg-background-secondary-light/10 text-background-secondary-light'
								: 'text-gray-700'} hover:bg-background-secondary-light/10"
						>
							Catalog
						</a>
						<a
							href="/beans"
							class="block rounded px-3 py-2 text-sm {routeId === '/beans'
								? 'bg-background-secondary-light/10 text-background-secondary-light'
								: 'text-gray-700'} hover:bg-background-secondary-light/10"
						>
							Beans
						</a>
						<a
							href="/roast"
							class="block rounded px-3 py-2 text-sm {routeId === '/roast'
								? 'bg-background-secondary-light/10 text-background-secondary-light'
								: 'text-gray-700'} hover:bg-background-secondary-light/10"
						>
							Roast
						</a>
						<a
							href="/profit"
							class="block rounded px-3 py-2 text-sm {routeId === '/profit'
								? 'bg-background-secondary-light/10 text-background-secondary-light'
								: 'text-gray-700'} hover:bg-background-secondary-light/10"
						>
							Profit
						</a>
					</nav>
				{/if}

				<div class="mt-2 border-t border-gray-200 pt-2">
					{#if session?.user}
						<button
							onclick={handleSignOut}
							class="block w-full rounded px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
						>
							Sign Out
						</button>
					{:else}
						<button
							onclick={handleSignIn}
							class="block w-full rounded px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50"
						>
							Sign In
						</button>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>
