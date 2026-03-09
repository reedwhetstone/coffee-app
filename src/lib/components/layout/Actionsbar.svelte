<!-- src/lib/components/layout/Actionsbar.svelte -->
<script lang="ts">
	import { page } from '$app/state';
	import { afterNavigate, goto, replaceState } from '$app/navigation';
	import { checkRole } from '$lib/types/auth.types';

	// Props declaration
	let { data, onClose = () => {} } = $props<{
		data: Record<string, unknown>;
		onClose?: () => void;
	}>();

	// Destructure with default values
	let { role = 'viewer' } = $derived(data as { role?: string });

	// Import global UserRole type
	import type { UserRole } from '$lib/types/auth.types';
	let userRole: UserRole = $derived(role as UserRole);

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
		onClose();
	});

	// Action handlers
	function handleNewBean() {
		if (routeId === '/beans') {
			// Already on beans page: update URL without server reload
			replaceState(new URL('/beans?modal=new', window.location.origin), {});
		} else {
			goto('/beans?modal=new');
		}
		onClose();
	}

	function handleNewRoast() {
		if (routeId === '/roast') {
			// Already on roast page: update URL without server reload
			replaceState(new URL('/roast?modal=new', window.location.origin), {});
		} else {
			goto('/roast?modal=new');
		}
		onClose();
	}

	function handleNewSale() {
		if (routeId === '/profit') {
			// Already on profit page: update URL without server reload
			replaceState(new URL('/profit?modal=new', window.location.origin), {});
		} else {
			goto('/profit?modal=new');
		}
		onClose();
	}

	async function handleShareAllBeans() {
		try {
			const response = await fetch('/api/share', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					resourceId: 'all'
				})
			});

			if (!response.ok) {
				throw new Error('Failed to create share link');
			}

			const { shareUrl } = await response.json();
			await navigator.clipboard.writeText(shareUrl);
			alert('Share link copied to clipboard!');
		} catch (error) {
			console.error('Error sharing:', error);
			alert('Failed to create share link. Please try again.');
		}
		onClose();
	}
</script>

<div class="flex h-full flex-col">
	<!-- Header with close button -->
	<header
		class="flex items-center justify-between border-b border-text-primary-light border-opacity-20 p-4"
	>
		<h2 class="text-lg font-semibold text-text-primary-light" id="actions-dialog-title">Actions</h2>
		<button
			onclick={(e) => {
				e.stopPropagation();
				onClose();
			}}
			onkeydown={(e) => e.key === 'Escape' && onClose()}
			class="p-2 hover:opacity-80"
			aria-label="Close actions panel"
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
		{#if hasRequiredRole('member')}
			<div class="space-y-2">
				<!-- Always show all functions regardless of current page -->
				<button
					class="block w-full rounded-md bg-background-secondary-light px-3 py-2 text-left text-sm font-medium text-text-primary-light ring-1 ring-border-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white"
					onclick={handleNewBean}
				>
					New Bean
				</button>
				<button
					class="block w-full rounded-md bg-background-secondary-light px-3 py-2 text-left text-sm font-medium text-text-primary-light ring-1 ring-border-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white"
					onclick={handleNewRoast}
				>
					New Roast
				</button>
				<button
					class="block w-full rounded-md bg-background-secondary-light px-3 py-2 text-left text-sm font-medium text-text-primary-light ring-1 ring-border-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white"
					onclick={handleNewSale}
				>
					New Sale
				</button>
				<button
					class="block w-full rounded-md border border-background-tertiary-light px-3 py-2 text-left text-sm font-medium text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white"
					onclick={handleShareAllBeans}
				>
					Share All Beans
				</button>
			</div>
		{/if}
	</main>
</div>
