<script lang="ts">
	import { onMount } from 'svelte';

	interface UserDiscrepancy {
		userId: string;
		email: string;
		name?: string;
		currentRole: string;
		expectedRole: string;
		stripeCustomerId: string;
		subscriptionStatus: string;
		subscriptionId?: string;
		lastRoleUpdate?: string;
		issue: string;
	}

	interface AuditLogSummary {
		userId: string;
		email?: string;
		oldRole: string | null;
		newRole: string;
		triggerType: string;
		createdAt: string;
		stripeCustomerId?: string;
	}

	interface DiscrepancyReport {
		shouldBeMemberButArent: UserDiscrepancy[];
		shouldBeViewerButArent: UserDiscrepancy[];
		recentAuditLogs: AuditLogSummary[];
		summary: {
			totalDiscrepancies: number;
			totalStripeCustomers: number;
			lastChecked: string;
		};
	}

	let loading = $state(true);
	let error = $state<string | null>(null);
	let report = $state<DiscrepancyReport | null>(null);
	let fixingUserId = $state<string | null>(null);

	async function fetchDiscrepancies() {
		try {
			loading = true;
			const response = await fetch('/api/admin/stripe-role-discrepancies');

			if (!response.ok) {
				if (response.status === 403) {
					throw new Error('Admin access required');
				}
				throw new Error(`HTTP ${response.status}: ${await response.text()}`);
			}

			report = await response.json();
			error = null;
		} catch (err: unknown) {
			error = (err as Error).message || 'Failed to fetch discrepancies';
			console.error('Error fetching discrepancies:', err);
		} finally {
			loading = false;
		}
	}

	async function fixUserRole(userId: string, expectedRole: string, reason: string) {
		try {
			fixingUserId = userId;
			const response = await fetch('/api/admin/stripe-role-discrepancies', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					userId,
					expectedRole,
					reason
				})
			});

			if (!response.ok) {
				throw new Error(`Failed to fix role: ${await response.text()}`);
			}

			const result = await response.json();
			console.log('Role fixed:', result);

			// Refresh the data
			await fetchDiscrepancies();
		} catch (err: unknown) {
			error = (err as Error).message || 'Failed to fix user role';
			console.error('Error fixing role:', err);
		} finally {
			fixingUserId = null;
		}
	}

	function formatDate(dateString: string) {
		return new Date(dateString).toLocaleString();
	}

	function getRoleColor(role: string) {
		switch (role) {
			case 'member':
				return 'text-green-600';
			case 'viewer':
				return 'text-blue-600';
			case 'admin':
				return 'text-purple-600';
			default:
				return 'text-gray-600';
		}
	}

	function getTriggerTypeColor(triggerType: string) {
		switch (triggerType) {
			case 'webhook_processing':
				return 'text-green-600';
			case 'checkout_success':
				return 'text-blue-600';
			case 'admin_change':
				return 'text-purple-600';
			case 'manual_verification':
				return 'text-orange-600';
			default:
				return 'text-gray-600';
		}
	}

	onMount(() => {
		fetchDiscrepancies();
	});
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h2 class="text-2xl font-bold text-text-primary-light">Stripe Role Monitor</h2>
		<button
			onclick={fetchDiscrepancies}
			disabled={loading}
			class="rounded-md bg-background-tertiary-light px-4 py-2 text-white transition-colors hover:bg-opacity-90 disabled:opacity-50"
		>
			{loading ? 'Refreshing...' : 'Refresh'}
		</button>
	</div>

	{#if error}
		<div class="rounded-lg border border-red-300 bg-red-100 p-4">
			<p class="text-red-700">❌ {error}</p>
		</div>
	{/if}

	{#if loading}
		<div class="flex items-center justify-center py-8">
			<div
				class="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"
			></div>
			<span class="ml-2 text-text-secondary-light">Loading monitoring data...</span>
		</div>
	{:else if report}
		<!-- Summary -->
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
			<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
				<h3 class="text-sm font-medium text-text-secondary-light">Total Discrepancies</h3>
				<p class="mt-1 text-2xl font-bold text-red-600">{report.summary.totalDiscrepancies}</p>
			</div>
			<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
				<h3 class="text-sm font-medium text-text-secondary-light">Total Customers</h3>
				<p class="mt-1 text-2xl font-bold text-blue-600">{report.summary.totalStripeCustomers}</p>
			</div>
			<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
				<h3 class="text-sm font-medium text-text-secondary-light">Last Checked</h3>
				<p class="mt-1 text-sm text-text-primary-light">{formatDate(report.summary.lastChecked)}</p>
			</div>
		</div>

		<!-- Users who should be members but aren't -->
		{#if report.shouldBeMemberButArent.length > 0}
			<div class="rounded-lg bg-background-secondary-light p-6 ring-1 ring-border-light">
				<h3 class="mb-4 text-lg font-semibold text-text-primary-light">
					Should Be Members ({report.shouldBeMemberButArent.length})
				</h3>
				<div class="space-y-3">
					{#each report.shouldBeMemberButArent as user}
						<div class="rounded border border-red-200 bg-red-50 p-3">
							<div class="flex items-center justify-between">
								<div>
									<p class="font-medium text-gray-900">{user.email}</p>
									<p class="text-sm text-gray-600">
										Current: <span class={getRoleColor(user.currentRole)}>{user.currentRole}</span>
										→ Expected:
										<span class={getRoleColor(user.expectedRole)}>{user.expectedRole}</span>
									</p>
									<p class="text-xs text-gray-500">
										Subscription: {user.subscriptionStatus} | Customer: {user.stripeCustomerId.slice(
											0,
											12
										)}...
									</p>
								</div>
								<button
									onclick={() =>
										fixUserRole(
											user.userId,
											user.expectedRole,
											'Admin fix via monitoring dashboard'
										)}
									disabled={fixingUserId === user.userId}
									class="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700 disabled:opacity-50"
								>
									{fixingUserId === user.userId ? 'Fixing...' : 'Fix Role'}
								</button>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Users who should be viewers but aren't -->
		{#if report.shouldBeViewerButArent.length > 0}
			<div class="rounded-lg bg-background-secondary-light p-6 ring-1 ring-border-light">
				<h3 class="mb-4 text-lg font-semibold text-text-primary-light">
					Should Be Viewers ({report.shouldBeViewerButArent.length})
				</h3>
				<div class="space-y-3">
					{#each report.shouldBeViewerButArent as user}
						<div class="rounded border border-yellow-200 bg-yellow-50 p-3">
							<div class="flex items-center justify-between">
								<div>
									<p class="font-medium text-gray-900">{user.email}</p>
									<p class="text-sm text-gray-600">
										Current: <span class={getRoleColor(user.currentRole)}>{user.currentRole}</span>
										→ Expected:
										<span class={getRoleColor(user.expectedRole)}>{user.expectedRole}</span>
									</p>
									<p class="text-xs text-gray-500">
										Subscription: {user.subscriptionStatus} | Customer: {user.stripeCustomerId.slice(
											0,
											12
										)}...
									</p>
								</div>
								<button
									onclick={() =>
										fixUserRole(
											user.userId,
											user.expectedRole,
											'Admin fix via monitoring dashboard'
										)}
									disabled={fixingUserId === user.userId}
									class="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
								>
									{fixingUserId === user.userId ? 'Fixing...' : 'Fix Role'}
								</button>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Recent audit logs -->
		<div class="rounded-lg bg-background-secondary-light p-6 ring-1 ring-border-light">
			<h3 class="mb-4 text-lg font-semibold text-text-primary-light">
				Recent Role Changes ({report.recentAuditLogs.length})
			</h3>
			<div class="max-h-64 space-y-2 overflow-y-auto">
				{#each report.recentAuditLogs as log}
					<div class="rounded border border-gray-200 bg-gray-50 p-2 text-sm">
						<div class="flex items-center justify-between">
							<div>
								<span class="font-medium">{log.email || 'Unknown'}</span>
								<span class="text-gray-600">
									{log.oldRole || 'none'} →
									<span class={getRoleColor(log.newRole)}>{log.newRole}</span>
								</span>
								<span class={`ml-2 ${getTriggerTypeColor(log.triggerType)}`}>
									{log.triggerType.replace('_', ' ')}
								</span>
							</div>
							<span class="text-xs text-gray-500">{formatDate(log.createdAt)}</span>
						</div>
					</div>
				{/each}
			</div>
		</div>

		{#if report.summary.totalDiscrepancies === 0}
			<div class="rounded-lg border border-green-300 bg-green-100 p-4">
				<p class="text-green-700">✅ All users have correct roles! No discrepancies found.</p>
			</div>
		{/if}
	{/if}
</div>
