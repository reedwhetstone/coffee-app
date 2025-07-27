<script lang="ts">
	import StripeRoleMonitor from '$lib/components/StripeRoleMonitor.svelte';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();

	// Admin dashboard stats - can be enhanced later
	let adminStats = $derived({
		userRole: data.role,
		userEmail: data.user?.email || 'Unknown',
		dashboardTitle: 'Admin Dashboard'
	});
</script>

<svelte:head>
	<title>Admin Dashboard - Purveyors</title>
	<meta
		name="description"
		content="Administrative dashboard for managing users, roles, and system monitoring"
	/>
</svelte:head>

<div class="min-h-screen bg-background-primary-light">
	<!-- Admin Dashboard Header -->
	<div class="border-b border-border-light bg-background-secondary-light px-6 py-4">
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-2xl font-bold text-text-primary-light">Admin Dashboard</h1>
				<p class="text-sm text-text-secondary-light">System administration and monitoring</p>
			</div>
			<div class="flex items-center space-x-4">
				<div class="text-right">
					<p class="text-sm font-medium text-text-primary-light">
						{adminStats.userEmail}
					</p>
					<p class="text-xs capitalize text-text-secondary-light">
						{adminStats.userRole} Role
					</p>
				</div>
				<div
					class="flex h-8 w-8 items-center justify-center rounded-full bg-background-tertiary-light"
				>
					<span class="text-sm font-medium text-white">
						{adminStats.userEmail.charAt(0).toUpperCase()}
					</span>
				</div>
			</div>
		</div>
	</div>

	<!-- Admin Dashboard Content -->
	<div class="px-6 py-6">
		<!-- Overview Cards -->
		<div class="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
			<!-- System Status Card -->
			<div class="rounded-lg bg-background-secondary-light p-6 ring-1 ring-border-light">
				<div class="flex items-center">
					<div class="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
						<svg
							class="h-6 w-6 text-green-600"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
							></path>
						</svg>
					</div>
					<div class="ml-4">
						<h3 class="text-lg font-medium text-text-primary-light">System Status</h3>
						<p class="text-sm text-text-secondary-light">All systems operational</p>
					</div>
				</div>
			</div>

			<!-- Role Management Card -->
			<div class="rounded-lg bg-background-secondary-light p-6 ring-1 ring-border-light">
				<div class="flex items-center">
					<div class="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
						<svg
							class="h-6 w-6 text-blue-600"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
							></path>
						</svg>
					</div>
					<div class="ml-4">
						<h3 class="text-lg font-medium text-text-primary-light">Role Management</h3>
						<p class="text-sm text-text-secondary-light">Monitor user roles & permissions</p>
					</div>
				</div>
			</div>

			<!-- Audit Logs Card -->
			<div class="rounded-lg bg-background-secondary-light p-6 ring-1 ring-border-light">
				<div class="flex items-center">
					<div class="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
						<svg
							class="h-6 w-6 text-purple-600"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
							></path>
						</svg>
					</div>
					<div class="ml-4">
						<h3 class="text-lg font-medium text-text-primary-light">Audit Logs</h3>
						<p class="text-sm text-text-secondary-light">Track system changes</p>
					</div>
				</div>
			</div>
		</div>

		<!-- Main Admin Content -->
		<div class="space-y-8">
			<!-- Stripe Role Monitor Section -->
			<div class="rounded-lg bg-background-secondary-light ring-1 ring-border-light">
				<div class="border-b border-border-light px-6 py-4">
					<h2 class="text-xl font-semibold text-text-primary-light">Stripe Role Management</h2>
					<p class="text-sm text-text-secondary-light">
						Monitor and resolve role discrepancies between Stripe subscriptions and user roles
					</p>
				</div>
				<div class="p-6">
					<StripeRoleMonitor />
				</div>
			</div>

			<!-- Future Admin Sections -->
			<div class="rounded-lg bg-background-secondary-light ring-1 ring-border-light">
				<div class="border-b border-border-light px-6 py-4">
					<h2 class="text-xl font-semibold text-text-primary-light">Quick Actions</h2>
					<p class="text-sm text-text-secondary-light">Common administrative tasks and shortcuts</p>
				</div>
				<div class="p-6">
					<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
						<!-- User Management -->
						<button
							class="flex items-center rounded-lg border border-border-light p-4 text-left transition-colors hover:bg-background-tertiary-light hover:text-white"
						>
							<svg
								class="h-8 w-8 text-blue-500"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
								></path>
							</svg>
							<div class="ml-3">
								<h3 class="font-medium">User Management</h3>
								<p class="text-sm text-text-secondary-light">
									Manage user accounts and permissions
								</p>
							</div>
						</button>

						<!-- System Settings -->
						<button
							class="flex items-center rounded-lg border border-border-light p-4 text-left transition-colors hover:bg-background-tertiary-light hover:text-white"
						>
							<svg
								class="h-8 w-8 text-green-500"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
								></path>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
								></path>
							</svg>
							<div class="ml-3">
								<h3 class="font-medium">System Settings</h3>
								<p class="text-sm text-text-secondary-light">Configure application settings</p>
							</div>
						</button>

						<!-- Analytics -->
						<button
							class="flex items-center rounded-lg border border-border-light p-4 text-left transition-colors hover:bg-background-tertiary-light hover:text-white"
						>
							<svg
								class="h-8 w-8 text-purple-500"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
								></path>
							</svg>
							<div class="ml-3">
								<h3 class="font-medium">Analytics</h3>
								<p class="text-sm text-text-secondary-light">View usage statistics and reports</p>
							</div>
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
