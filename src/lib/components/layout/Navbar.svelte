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

	// Update the props declaration to include isOpen and onClose
	let {
		data,
		isOpen = false,
		onClose = () => {}
	} = $props<{
		data: any;
		isOpen?: boolean;
		onClose?: () => void;
	}>();

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

	// Close menu when route changes
	afterNavigate(() => {
		routeId = page.route.id;
		onClose();
	});
</script>

<!-- Navigation menu panel - full height -->
<div class="flex h-full flex-col">
	<!-- Header with close button that handles keyboard events -->
	<header
		class="border-text-primary-dark flex items-center justify-between border-b border-opacity-20 p-4"
	>
		<h2 class="text-xl font-semibold" id="nav-dialog-title">Navigation</h2>
		<button
			onclick={(e) => {
				e.stopPropagation();
				onClose();
			}}
			onkeydown={(e) => e.key === 'Escape' && onClose()}
			class="p-2 hover:opacity-80"
			aria-label="Close navigation panel"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-5 w-5"
				viewBox="0 0 20 20"
				fill="currentColor"
			>
				<path
					fill-rule="evenodd"
					d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
					clip-rule="evenodd"
				/>
			</svg>
		</button>
	</header>

	<main class="flex-grow overflow-y-auto p-4">
		{#if session?.user}
			<div class="border-text-primary-dark mb-4 border-b border-opacity-20 pb-3 text-sm opacity-80">
				{session.user.email}
			</div>
		{/if}

		{#if hasRequiredRole('member')}
			<ul class="space-y-2">
				<li>
					<a
						href="/"
						class="block px-3 py-2 text-sm {routeId === '/'
							? 'text-text-primary-dark bg-background-secondary-light/20'
							: 'text-text-primary-dark hover:bg-background-secondary-light/10'}"
					>
						Catalog
					</a>
				</li>
				<li>
					<a
						href="/beans"
						class="block px-3 py-2 text-sm {routeId === '/beans'
							? 'text-text-primary-dark bg-background-secondary-light/20'
							: 'text-text-primary-dark hover:bg-background-secondary-light/10'}"
					>
						Beans
					</a>
				</li>
				<li>
					<a
						href="/roast"
						class="block px-3 py-2 text-sm {routeId === '/roast'
							? 'text-text-primary-dark bg-background-secondary-light/20'
							: 'text-text-primary-dark hover:bg-background-secondary-light/10'}"
					>
						Roast
					</a>
				</li>
				<li>
					<a
						href="/profit"
						class="block px-3 py-2 text-sm {routeId === '/profit'
							? 'text-text-primary-dark bg-background-secondary-light/20'
							: 'text-text-primary-dark hover:bg-background-secondary-light/10'}"
					>
						Profit
					</a>
				</li>
			</ul>
		{/if}
	</main>

	<footer class="border-text-primary-dark mt-auto border-t border-opacity-20 p-4">
		{#if session?.user}
			<button
				onclick={handleSignOut}
				class="block w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/20"
			>
				Sign Out
			</button>
		{:else}
			<button
				onclick={handleSignIn}
				class="block w-full px-3 py-2 text-left text-sm text-blue-400 hover:bg-blue-500/20"
			>
				Sign In
			</button>
		{/if}
	</footer>
</div>
