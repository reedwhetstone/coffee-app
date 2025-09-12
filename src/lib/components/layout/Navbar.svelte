<script lang="ts">
	import { page } from '$app/state';
	import { afterNavigate } from '$app/navigation';
	import { checkRole } from '$lib/types/auth.types';

	// Update the props declaration to include isOpen and onClose
	let { data, onClose = () => {} } = $props<{
		data: any;
		onClose?: () => void;
	}>();

	// Destructure with default values to prevent undefined errors
	let { role = 'viewer' } = $derived(data);

	// Import global UserRole type
	import type { UserRole } from '$lib/types/auth.types';
	let userRole: UserRole = $derived(role as UserRole);

	// Use the imported checkRole function
	function hasRequiredRole(requiredRole: UserRole): boolean {
		const hasRole = checkRole(userRole, requiredRole);
		return hasRole;
	}

	// Update routeId to use the store value directly
	let routeId = $state(page.route.id);
	let currentPath = $state(page.url.pathname);

	// Update `routeId` after each navigation
	afterNavigate(() => {
		routeId = page.route.id;
		currentPath = page.url.pathname;
	});

	// Update route tracking when navigation completes
	afterNavigate(() => {
		routeId = page.route.id;
		currentPath = page.url.pathname;
	});

	// Function to handle instant menu close on navigation
	function handleNavClick() {
		onClose(); // Close menu immediately, don't wait for navigation to complete
	}

	// Preloading cache to avoid duplicate requests
	const preloadCache = new Set<string>();

	// Function to preload API data on hover
	async function preloadRouteData(route: string) {
		if (preloadCache.has(route)) return; // Already preloading or preloaded

		preloadCache.add(route);

		try {
			if (route === '/beans') {
				// Preload beans data
				const beansResponse = fetch('/api/beans');
				const catalogResponse = fetch('/api/catalog');
				await Promise.allSettled([beansResponse, catalogResponse]);
			} else if (route === '/roast') {
				// Preload roast data
				await fetch('/api/roast-profiles');
			}
		} catch (error) {
			console.log('Preload failed for', route, ':', error);
			// Remove from cache on failure so it can be retried
			preloadCache.delete(route);
		}
	}
</script>

<!-- Navigation menu panel - full height -->
<div class="flex h-full flex-col">
	<!-- Header with close button that handles keyboard events -->
	<header
		class="flex items-center justify-between border-b border-text-primary-light border-opacity-20 p-4"
	>
		<h2 class="text-lg font-semibold text-text-primary-light" id="nav-dialog-title">Navigation</h2>
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
		<ul class="space-y-2">
			<!-- Catalog - Available to all logged in users -->
			<li>
				<a
					href="/catalog"
					onclick={handleNavClick}
					class="block rounded-md px-3 py-2 text-left text-sm ring-1 ring-border-light transition-all duration-200 {currentPath ===
					'/catalog'
						? 'bg-background-tertiary-light text-white'
						: 'bg-background-secondary-light text-text-primary-light hover:bg-background-tertiary-light hover:text-white'}"
				>
					Catalog
				</a>
			</li>

			<!-- Member-only navigation -->
			{#if hasRequiredRole('member')}
				<li>
					<a
						href="/beans"
						onclick={handleNavClick}
						onmouseenter={() => preloadRouteData('/beans')}
						class="block rounded-md px-3 py-2 text-left text-sm ring-1 ring-border-light transition-all duration-200 {routeId ===
						'/beans'
							? 'bg-background-tertiary-light text-white'
							: 'bg-background-secondary-light text-text-primary-light hover:bg-background-tertiary-light hover:text-white'}"
					>
						Beans
					</a>
				</li>
				<li>
					<a
						href="/roast"
						onclick={handleNavClick}
						onmouseenter={() => preloadRouteData('/roast')}
						class="block rounded-md px-3 py-2 text-left text-sm ring-1 ring-border-light transition-all duration-200 {routeId ===
						'/roast'
							? 'bg-background-tertiary-light text-white'
							: 'bg-background-secondary-light text-text-primary-light hover:bg-background-tertiary-light hover:text-white'}"
					>
						Roast
					</a>
				</li>
				<li>
					<a
						href="/profit"
						onclick={handleNavClick}
						class="block rounded-md px-3 py-2 text-left text-sm ring-1 ring-border-light transition-all duration-200 {routeId ===
						'/profit'
							? 'bg-background-tertiary-light text-white'
							: 'bg-background-secondary-light text-text-primary-light hover:bg-background-tertiary-light hover:text-white'}"
					>
						Profit
					</a>
				</li>
			{/if}

			<!-- Admin-only navigation -->
			{#if hasRequiredRole('admin')}
				<li class="mt-4">
					<div class="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary-light">
						Administration
					</div>
				</li>
				<li>
					<a
						href="/admin"
						onclick={handleNavClick}
						class="block rounded-md px-3 py-2 text-left text-sm ring-1 ring-border-light transition-all duration-200 {routeId ===
						'/admin'
							? 'bg-background-tertiary-light text-white'
							: 'bg-background-secondary-light text-text-primary-light hover:bg-background-tertiary-light hover:text-white'}"
					>
						Admin Dashboard
					</a>
				</li>
			{/if}
		</ul>

		<!-- API Dashboard and Contact links for all users -->
		<div class="mt-6 border-t border-text-primary-light border-opacity-20 pt-4">
			<ul class="space-y-2">
				<li>
					<a
						href="/api-dashboard"
						onclick={handleNavClick}
						class="block rounded-md px-3 py-2 text-left text-sm ring-1 ring-border-light transition-all duration-200 {currentPath.startsWith(
							'/api-dashboard'
						)
							? 'bg-background-tertiary-light text-white'
							: 'bg-background-secondary-light text-text-primary-light hover:bg-background-tertiary-light hover:text-white'}"
					>
						Parchment API
					</a>
				</li>
				<li>
					<a
						href="/contact"
						onclick={handleNavClick}
						class="block rounded-md px-3 py-2 text-left text-sm ring-1 ring-border-light transition-all duration-200 {currentPath ===
						'/contact'
							? 'bg-background-tertiary-light text-white'
							: 'bg-background-secondary-light text-text-primary-light hover:bg-background-tertiary-light hover:text-white'}"
					>
						Contact
					</a>
				</li>
			</ul>
		</div>
	</main>
</div>
