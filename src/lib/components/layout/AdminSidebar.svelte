<script lang="ts">
	import { goto } from '$app/navigation';

	let { data, isOpen, onClose } = $props<{
		data: any;
		isOpen: boolean;
		onClose: () => void;
	}>();

	// Admin navigation items
	const adminNavItems = [
		{
			label: 'Admin Dashboard',
			href: '/admin',
			icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z M3 7l9 6 9-6'
		},
		{
			label: 'Role Management',
			href: '/admin#role-management',
			icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z'
		},
		{
			label: 'System Logs',
			href: '/admin#system-logs',
			icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
		}
	];

	function handleNavigation(href: string) {
		goto(href);
		onClose();
	}
</script>

<div class="flex h-full flex-col">
	<!-- Header -->
	<div class="border-background-secondary-dark border-b px-4 py-4">
		<div class="flex items-center justify-between">
			<h2 class="text-lg font-semibold text-text-primary-dark">Admin Panel</h2>
			<button
				onclick={onClose}
				class="text-text-secondary-dark hover:bg-background-secondary-dark rounded-md p-1 hover:text-text-primary-dark"
				aria-label="Close admin menu"
			>
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M6 18L18 6M6 6l12 12"
					></path>
				</svg>
			</button>
		</div>
		<p class="text-text-secondary-dark mt-1 text-sm">System administration tools</p>
	</div>

	<!-- Admin User Info -->
	<div class="border-background-secondary-dark border-b px-4 py-3">
		<div class="flex items-center space-x-3">
			<div
				class="flex h-8 w-8 items-center justify-center rounded-full bg-background-tertiary-light"
			>
				<span class="text-sm font-medium text-white">
					{data?.user?.email?.charAt(0).toUpperCase() || 'A'}
				</span>
			</div>
			<div>
				<p class="text-sm font-medium text-text-primary-dark">
					{data?.user?.email || 'Admin User'}
				</p>
				<p class="text-text-secondary-dark text-xs capitalize">
					{data?.role || 'admin'} Role
				</p>
			</div>
		</div>
	</div>

	<!-- Navigation Items -->
	<nav class="flex-1 px-4 py-4">
		<ul class="space-y-2">
			{#each adminNavItems as item}
				<li>
					<button
						onclick={() => handleNavigation(item.href)}
						class="hover:bg-background-secondary-dark flex w-full items-center rounded-md px-3 py-2 text-left text-sm font-medium text-text-primary-dark transition-colors hover:text-background-tertiary-light"
					>
						<svg class="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={item.icon}
							></path>
						</svg>
						{item.label}
					</button>
				</li>
			{/each}
		</ul>
	</nav>

	<!-- Quick Actions -->
	<div class="border-background-secondary-dark border-t px-4 py-4">
		<h3 class="text-text-secondary-dark mb-3 text-xs font-semibold uppercase tracking-wide">
			Quick Actions
		</h3>
		<div class="space-y-2">
			<button
				onclick={() => handleNavigation('/admin#role-management')}
				class="hover:bg-background-secondary-dark flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-text-primary-dark transition-colors hover:text-background-tertiary-light"
			>
				<svg class="mr-3 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M13 10V3L4 14h7v7l9-11h-7z"
					></path>
				</svg>
				Fix Role Issues
			</button>
			<button
				onclick={() => handleNavigation('/admin#system-logs')}
				class="hover:bg-background-secondary-dark flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-text-primary-dark transition-colors hover:text-background-tertiary-light"
			>
				<svg class="mr-3 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
					></path>
				</svg>
				View Analytics
			</button>
		</div>
	</div>
</div>
