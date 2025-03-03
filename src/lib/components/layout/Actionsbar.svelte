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
	let { role = 'viewer', selectedBean } = $derived(data);

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
		// Set state to show the form
		if (data?.onAddNewBean) {
			data.onAddNewBean();
		}
		onClose();
	}

	function handleNewRoast() {
		if (routeId === '/beans') {
			// If on beans page, navigate to roast page with form flag
			// Check if we have a selected bean from the data prop
			const selectedBean = data?.selectedBean;
			if (selectedBean) {
				goto(`/roast?beanId=${selectedBean.id}&beanName=${encodeURIComponent(selectedBean.name)}`, {
					state: {
						showRoastForm: true
					}
				});
			} else {
				goto('/roast', {
					state: {
						showRoastForm: true
					}
				});
			}
			onClose();
		} else {
			// If already on roast page, just show the form
			if (data?.onAddNewRoast) {
				data.onAddNewRoast();
			}
			onClose();
		}
	}

	function handleNewSale() {
		if (data?.onAddNewSale) {
			data.onAddNewSale();
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
						class="block w-full rounded border-2 border-green-800 px-3 py-2 text-left text-sm text-text-primary-light hover:bg-green-900"
						onclick={handleNewBean}
					>
						New Bean
					</button>
					<button
						class="block w-full rounded border-2 border-blue-800 px-3 py-2 text-left text-sm text-text-primary-light hover:bg-blue-900"
						onclick={handleNewRoast}
					>
						New Roast
					</button>
					<button
						class="block w-full rounded border-2 border-purple-800 px-3 py-2 text-left text-sm text-text-primary-light hover:bg-purple-900"
						onclick={handleShareAllBeans}
					>
						Share All Beans
					</button>
				{:else if routeId === '/roast'}
					<button
						class="block w-full rounded border-2 border-green-800 px-3 py-2 text-left text-sm text-text-primary-light hover:bg-green-900"
						onclick={handleNewRoast}
					>
						New Roast
					</button>
				{:else if routeId === '/profit'}
					<button
						class="block w-full rounded border-2 border-green-800 px-3 py-2 text-left text-sm text-text-primary-light hover:bg-green-900"
						onclick={handleNewSale}
					>
						New Sale
					</button>
				{/if}
			</div>
		{/if}
	</main>
</div>
