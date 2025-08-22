<!-- src/lib/components/layout/Actionsbar.svelte -->
<script lang="ts">
	import { page } from '$app/state';
	import { afterNavigate, goto } from '$app/navigation';
	import { checkRole } from '$lib/types/auth.types';

	// Props declaration
	let { data, onClose = () => {} } = $props<{
		data: any;
		onClose?: () => void;
	}>();

	// Destructure with default values
	let { role = 'viewer' } = $derived(data);

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
		console.log('handleNewBean called, routeId:', routeId);

		// If we're on the beans page, use the custom event
		if (routeId === '/beans') {
			console.log('Dispatching show-bean-form event');
			window.dispatchEvent(new CustomEvent('show-bean-form'));
		} else {
			// Navigate to beans page with form state
			console.log('Navigating to beans page with showBeanForm state');
			goto('/beans', {
				state: {
					showBeanForm: true
				}
			});
		}
		onClose();
	}

	function handleNewRoast() {
		console.log('handleNewRoast called, routeId:', routeId);

		// If we're on the roast page, use the custom event
		if (routeId === '/roast') {
			console.log('Dispatching show-roast-form event');
			window.dispatchEvent(new CustomEvent('show-roast-form'));
		} else {
			// Navigate to roast page with form state
			// Always navigate to roast page without pre-selected bean
			// Users can select a bean from the roast form
			goto('/roast', {
				state: {
					showRoastForm: true
				}
			});
		}
		onClose();
	}

	function handleNewSale() {
		console.log('handleNewSale called, routeId:', routeId);

		// If we're on the profit page, use the custom event
		if (routeId === '/profit') {
			console.log('Dispatching show-sale-form event');
			window.dispatchEvent(new CustomEvent('show-sale-form'));
		} else {
			// Navigate to profit page with form state
			console.log('Navigating to profit page with showSaleForm state');
			goto('/profit', {
				state: {
					showSaleForm: true
				}
			});
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
