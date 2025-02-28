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
</script>

<nav class="bg-coffee-brown sticky top-0 z-50 px-4 py-2 shadow-lg">
	<div class="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
		<!-- Mobile Menu Button -->
		<div class="flex items-center justify-between md:hidden">
			<button onclick={toggleMenu} class="hover:bg-coffee-brown ml-2 rounded p-2 text-zinc-400">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-6 w-6"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					{#if isMenuOpen}
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					{:else}
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 6h16M4 12h16M4 18h16"
						/>
					{/if}
				</svg>
			</button>
		</div>

		<!-- Navigation Links -->
		<div
			class="flex flex-col md:flex-row md:items-center md:gap-4 {isMenuOpen
				? 'block'
				: 'hidden md:flex'}"
		>
			<ul class="flex flex-wrap items-center gap-2">
				{#if hasRequiredRole('member')}
					<li class="w-full md:w-auto">
						<a
							href="/"
							class="block w-full px-3 py-2 text-center md:inline md:w-auto {routeId === '/'
								? 'text-sky-800'
								: 'text-light-cream'} hover:bg-coffee-brown hover:text-sky-800"
						>
							CATALOG
						</a>
					</li>

					<li class="w-full md:w-auto">
						<a
							href="/beans"
							class="block w-full px-3 py-2 text-center md:inline md:w-auto {routeId === '/beans'
								? 'text-sky-800'
								: 'text-light-cream'}
							hover:bg-coffee-brown hover:text-sky-800"
						>
							BEANS
						</a>
					</li>

					<li class="w-full md:w-auto">
						<a
							href="/roast"
							class="block w-full px-3 py-2 text-center md:inline md:w-auto {routeId === '/roast'
								? 'text-sky-800'
								: 'text-light-cream'}
								hover:bg-coffee-brown hover:text-sky-800"
						>
							ROAST
						</a>
					</li>
					<li class="w-full md:w-auto">
						<a
							href="/profit"
							class="block w-full px-3 py-2 text-center md:inline md:w-auto {routeId === '/profit'
								? 'text-sky-800'
								: 'text-light-cream'}
								hover:bg-coffee-brown hover:text-sky-800"
						>
							PROFIT
						</a>
					</li>
				{/if}
			</ul>
		</div>

		<!-- Auth Section -->
		<div class="flex items-center gap-2 {isMenuOpen ? 'block' : 'hidden md:flex'}">
			{#if session?.user}
				<span class="hidden text-sm text-zinc-400 md:inline">
					{session.user.email}
				</span>
				<button
					onclick={handleSignOut}
					class="w-full rounded border-2 border-red-800 px-3 py-1 text-zinc-500 hover:bg-red-900 md:w-auto"
				>
					Sign Out
				</button>
			{:else}
				<button
					onclick={handleSignIn}
					class="w-full rounded border-2 border-blue-800 px-3 py-1 text-zinc-500 hover:bg-blue-900 md:w-auto"
				>
					Sign In
				</button>
			{/if}
		</div>
	</div>
</nav>
