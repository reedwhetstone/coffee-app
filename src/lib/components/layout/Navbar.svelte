<script lang="ts">
	import { page } from '$app/state';
	import { afterNavigate } from '$app/navigation';
	import pkg from 'lodash';
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

	// Use the imported checkRole function
	function hasRequiredRole(requiredRole: UserRole): boolean {
		const hasRole = checkRole(userRole, requiredRole);
		return hasRole;
	}

	// Update routeId to use the store value directly
	let routeId = $state(page.route.id);

	// Update `routeId` after each navigation
	afterNavigate(() => {
		routeId = page.route.id;
	});

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
		class="flex items-center justify-between border-b border-text-primary-dark border-opacity-20 p-4"
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
		<ul class="space-y-2">
			<!-- Home/Catalog - Available to all logged in users -->
			<li>
				<a
					href="/"
					class="block rounded border border-background-tertiary-light/20 px-3 py-2 text-left text-sm {routeId ===
					'/'
						? ' border-background-tertiary-light bg-background-tertiary-light/80 text-text-primary-dark'
						: 'text-text-primary-dark hover:border hover:border-background-tertiary-light hover:bg-background-tertiary-light/10'}"
				>
					Catalog
				</a>
			</li>

			<!-- Member-only navigation -->
			{#if hasRequiredRole('member')}
				<li>
					<a
						href="/beans"
						class="block rounded border border-background-tertiary-light/20 px-3 py-2 text-left text-sm {routeId ===
						'/beans'
							? ' border-background-tertiary-light bg-background-tertiary-light/80 text-text-primary-dark'
							: 'text-text-primary-dark hover:border hover:border-background-tertiary-light hover:bg-background-tertiary-light/10'}"
					>
						Beans
					</a>
				</li>
				<li>
					<a
						href="/roast"
						class="block rounded border border-background-tertiary-light/20 px-3 py-2 text-left text-sm {routeId ===
						'/roast'
							? ' border-background-tertiary-light bg-background-tertiary-light/80 text-text-primary-dark'
							: 'text-text-primary-dark hover:border hover:border-background-tertiary-light hover:bg-background-tertiary-light/10'}"
					>
						Roast
					</a>
				</li>
				<li>
					<a
						href="/profit"
						class="block rounded border border-background-tertiary-light/20 px-3 py-2 text-left text-sm {routeId ===
						'/profit'
							? 'border border-background-tertiary-light bg-background-tertiary-light/80 text-text-primary-dark'
							: 'text-text-primary-dark hover:border hover:border-background-tertiary-light hover:bg-background-tertiary-light/10'}"
					>
						Profit
					</a>
				</li>
			{/if}

			<!-- Admin-only navigation -->
			{#if hasRequiredRole('admin')}
				<li class="mt-4">
					<div class="text-text-secondary-dark mb-2 text-xs font-semibold uppercase tracking-wide">
						Administration
					</div>
				</li>
				<li>
					<a
						href="/admin"
						class="block rounded border border-background-tertiary-light/20 px-3 py-2 text-left text-sm {routeId ===
						'/admin'
							? 'border border-background-tertiary-light bg-background-tertiary-light/80 text-text-primary-dark'
							: 'text-text-primary-dark hover:border hover:border-background-tertiary-light hover:bg-background-tertiary-light/10'}"
					>
						Admin Dashboard
					</a>
				</li>
			{/if}
		</ul>

		<!-- Contact link for all users -->
		<div class="mt-6 border-t border-background-tertiary-light/20 pt-4">
			<ul class="space-y-2">
				<li>
					<a
						href="/contact"
						class="block rounded border border-background-tertiary-light/20 px-3 py-2 text-left text-sm {routeId ===
						'/contact'
							? 'border border-background-tertiary-light bg-background-tertiary-light/80 text-text-primary-dark'
							: 'text-text-primary-dark hover:border hover:border-background-tertiary-light hover:bg-background-tertiary-light/10'}"
					>
						Contact
					</a>
				</li>
			</ul>
		</div>
	</main>
</div>
