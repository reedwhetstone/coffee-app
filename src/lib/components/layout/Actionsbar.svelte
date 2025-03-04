<!-- src/lib/components/layout/Actionsbar.svelte -->
<script lang="ts">
	import { page } from '$app/state';
	import { afterNavigate } from '$app/navigation';
	import { goto } from '$app/navigation';
	import { checkRole } from '$lib/types/auth.types';

	// Props declaration
	let {
		data,
		isOpen = false,
		onClose = () => {}
	} = $props<{
		data: any;
		isOpen?: boolean;
		onClose?: () => void;
	}>();

	// Destructure with default values
	let { role = 'viewer' } = $derived(data);

	// Add type checking for role
	type UserRole = 'viewer' | 'member' | 'admin';
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
		// Log what we're about to do
		console.log('handleNewBean called, routeId:', routeId);
		console.log('data object properties:', Object.keys(data || {}));

		// Set state to show the form
		if (data?.onAddNewBean) {
			console.log('Calling onAddNewBean from Actionsbar');
			data.onAddNewBean();
		} else {
			console.error('onAddNewBean not available in data object');
			// If we're not on the beans page, navigate there
			if (routeId !== '/beans') {
				goto('/beans', {
					state: {
						showBeanForm: true
					}
				});
			} else {
				// We are on the beans page but the callback isn't available
				// Try a direct approach - use window to access the global scope
				window.dispatchEvent(new CustomEvent('show-bean-form'));
				console.log('Dispatched show-bean-form event');
			}
		}
		onClose();
	}

	function handleNewRoast() {
		console.log('handleNewRoast called, routeId:', routeId);
		console.log('data available keys:', Object.keys(data || {}));

		if (routeId === '/beans') {
			// If on beans page, navigate to roast page with form flag
			// Check if we have a selected bean from the data prop
			const selectedBean = data?.selectedBean;
			console.log('Selected bean from beans page:', selectedBean);

			if (selectedBean) {
				goto(`/roast?beanId=${selectedBean.id}&beanName=${encodeURIComponent(selectedBean.name)}`, {
					state: {
						showRoastForm: true,
						selectedBean: selectedBean
					}
				});
			} else {
				goto('/roast', {
					state: {
						showRoastForm: true
					}
				});
			}
		} else {
			// If already on roast page, just show the form
			if (data?.onAddNewRoast) {
				console.log('Calling onAddNewRoast from Actionsbar');
				data.onAddNewRoast();
			} else {
				console.error('onAddNewRoast not available in data object');
				// We are on the roast page but the callback isn't available
				// Try a direct approach - use window to access the global scope
				window.dispatchEvent(new CustomEvent('show-roast-form'));
				console.log('Dispatched show-roast-form event');
			}
		}
		onClose();
	}

	function handleNewSale() {
		// Use the callback from data prop to show the form
		console.log('handleNewSale called, routeId:', routeId);
		console.log('data available keys:', Object.keys(data || {}));

		if (data?.onAddNewSale) {
			console.log('Calling onAddNewSale from Actionsbar');
			data.onAddNewSale();
		} else {
			console.error('onAddNewSale not available in data object');
			// If we're not on the profit page, navigate there
			if (routeId !== '/profit') {
				goto('/profit', {
					state: {
						showSaleForm: true
					}
				});
			} else {
				// We are on the profit page but the callback isn't available
				// Try a direct approach - use window to access the global scope
				window.dispatchEvent(new CustomEvent('show-sale-form'));
				console.log('Dispatched show-sale-form event');
			}
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
		class="border-text-primary-dark flex items-center justify-between border-b border-opacity-20 p-4"
	>
		<h2 class="text-xl font-semibold" id="actions-dialog-title">Actions</h2>
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
				{#if routeId === '/beans'}
					<button
						class="text-text-primary-dark block w-full rounded border-2 border-background-tertiary-light px-3 py-2 text-left text-sm hover:bg-background-tertiary-light hover:opacity-80"
						onclick={handleNewBean}
					>
						New Bean
					</button>
					<button
						class="text-text-primary-dark block w-full rounded border-2 border-background-tertiary-light px-3 py-2 text-left text-sm hover:bg-background-tertiary-light hover:opacity-80"
						onclick={handleNewRoast}
					>
						New Roast
					</button>
					<button
						class="text-text-primary-dark block w-full rounded border-2 border-background-tertiary-light px-3 py-2 text-left text-sm hover:bg-background-tertiary-light hover:opacity-80"
						onclick={handleShareAllBeans}
					>
						Share All Beans
					</button>
				{:else if routeId === '/roast'}
					<button
						class="text-text-primary-dark block w-full rounded border-2 border-background-tertiary-light px-3 py-2 text-left text-sm hover:bg-background-tertiary-light hover:opacity-80"
						onclick={handleNewRoast}
					>
						New Roast
					</button>
				{:else if routeId === '/profit'}
					<button
						class="text-text-primary-dark block w-full rounded border-2 border-background-tertiary-light px-3 py-2 text-left text-sm hover:bg-background-tertiary-light hover:opacity-80"
						onclick={handleNewSale}
					>
						New Sale
					</button>
				{/if}
			</div>
		{/if}
	</main>
</div>
