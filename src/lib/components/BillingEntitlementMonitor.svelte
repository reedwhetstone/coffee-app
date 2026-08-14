<script lang="ts">
	import { onMount } from 'svelte';

	interface EntitlementState {
		role: string | null;
		apiPlan: string | null;
		ppiAccess: boolean | null;
	}

	interface EntitlementDiscrepancy {
		ownerId: string;
		actual: EntitlementState;
		expected: EntitlementState;
	}

	interface DiscrepancyReport {
		summary: {
			totalDiscrepancies: number;
			totalTrackedAccounts: number;
			checkedAt: string;
		};
		discrepancies: EntitlementDiscrepancy[];
	}

	let loading = $state(true);
	let error = $state<string | null>(null);
	let report = $state<DiscrepancyReport | null>(null);
	let recomputingOwnerId = $state<string | null>(null);

	function isEntitlementState(value: unknown): value is EntitlementState {
		if (!value || typeof value !== 'object') return false;
		const candidate = value as Record<string, unknown>;
		return (
			(candidate.role === null || typeof candidate.role === 'string') &&
			(candidate.apiPlan === null || typeof candidate.apiPlan === 'string') &&
			(candidate.ppiAccess === null || typeof candidate.ppiAccess === 'boolean')
		);
	}

	function isDiscrepancyReport(value: unknown): value is DiscrepancyReport {
		if (!value || typeof value !== 'object') return false;
		const candidate = value as { summary?: Record<string, unknown>; discrepancies?: unknown };
		return (
			!!candidate.summary &&
			typeof candidate.summary.totalDiscrepancies === 'number' &&
			typeof candidate.summary.totalTrackedAccounts === 'number' &&
			typeof candidate.summary.checkedAt === 'string' &&
			Array.isArray(candidate.discrepancies) &&
			candidate.discrepancies.every((entry) => {
				if (!entry || typeof entry !== 'object') return false;
				const discrepancy = entry as Record<string, unknown>;
				return (
					typeof discrepancy.ownerId === 'string' &&
					isEntitlementState(discrepancy.actual) &&
					isEntitlementState(discrepancy.expected)
				);
			})
		);
	}

	async function fetchDiscrepancies() {
		loading = true;
		try {
			const response = await fetch('/api/admin/billing-entitlement-discrepancies');
			const body = await response.json().catch(() => null);
			if (!response.ok) {
				throw new Error(body?.error?.message ?? 'Unable to load entitlement discrepancies.');
			}
			if (!isDiscrepancyReport(body)) {
				throw new Error('Parchment returned an invalid discrepancy report.');
			}
			report = body;
			error = null;
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Unable to load entitlement discrepancies.';
		} finally {
			loading = false;
		}
	}

	async function recompute(ownerId: string) {
		recomputingOwnerId = ownerId;
		try {
			const response = await fetch('/api/admin/billing-entitlement-discrepancies', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ownerId })
			});
			const body = await response.json().catch(() => null);
			if (!response.ok) {
				throw new Error(body?.error?.message ?? 'Unable to recompute entitlements.');
			}
			await fetchDiscrepancies();
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Unable to recompute entitlements.';
		} finally {
			recomputingOwnerId = null;
		}
	}

	function display(value: string | boolean | null) {
		if (value === null) return 'null';
		if (typeof value === 'boolean') return value ? 'true' : 'false';
		return value;
	}

	onMount(fetchDiscrepancies);
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between gap-4">
		<div>
			<h2 class="text-2xl font-bold text-ink">Billing Entitlement Monitor</h2>
			<p class="text-sm text-muted">
				Parchment reports canonical expected state and performs every recomputation.
			</p>
		</div>
		<button
			onclick={fetchDiscrepancies}
			disabled={loading}
			class="rounded-md bg-accent px-4 py-2 font-medium text-ink disabled:opacity-50"
		>
			{loading ? 'Refreshing...' : 'Refresh'}
		</button>
	</div>

	{#if error}
		<p class="rounded-lg border border-danger/30 bg-danger-subtle p-4 text-danger" role="alert">
			{error}
		</p>
	{/if}

	{#if loading}
		<p class="py-8 text-center text-muted">Loading canonical entitlement evidence...</p>
	{:else if report}
		<div class="grid gap-4 sm:grid-cols-3">
			<div class="rounded-lg bg-surface-panel p-4 ring-1 ring-line">
				<p class="text-sm text-muted">Discrepancies</p>
				<p class="mt-1 text-2xl font-bold text-danger">{report.summary.totalDiscrepancies}</p>
			</div>
			<div class="rounded-lg bg-surface-panel p-4 ring-1 ring-line">
				<p class="text-sm text-muted">Tracked accounts</p>
				<p class="mt-1 text-2xl font-bold text-ink">{report.summary.totalTrackedAccounts}</p>
			</div>
			<div class="rounded-lg bg-surface-panel p-4 ring-1 ring-line">
				<p class="text-sm text-muted">Checked</p>
				<p class="mt-1 text-sm font-medium text-ink">
					{new Date(report.summary.checkedAt).toLocaleString()}
				</p>
			</div>
		</div>

		{#if report.discrepancies.length === 0}
			<p class="rounded-lg border border-success/30 bg-success-subtle p-5 text-success-strong">
				No entitlement discrepancies found.
			</p>
		{:else}
			<div class="space-y-4">
				{#each report.discrepancies as discrepancy (discrepancy.ownerId)}
					<div class="rounded-lg bg-surface-panel p-5 ring-1 ring-line">
						<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
							<div>
								<p class="text-xs font-semibold text-muted">Owner</p>
								<p class="font-mono text-sm text-ink">{discrepancy.ownerId}</p>
							</div>
							<button
								onclick={() => recompute(discrepancy.ownerId)}
								disabled={recomputingOwnerId !== null}
								class="rounded-md border border-line px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50"
							>
								{recomputingOwnerId === discrepancy.ownerId
									? 'Recomputing...'
									: 'Recompute in Parchment'}
							</button>
						</div>
						<div class="mt-4 grid gap-4 sm:grid-cols-2">
							{#each [{ label: 'Actual', state: discrepancy.actual }, { label: 'Expected', state: discrepancy.expected }] as comparison}
								<div class="rounded-md border border-line p-4 text-sm text-muted">
									<p class="font-semibold text-ink">{comparison.label}</p>
									<p class="mt-2">role: {display(comparison.state.role)}</p>
									<p>apiPlan: {display(comparison.state.apiPlan)}</p>
									<p>ppiAccess: {display(comparison.state.ppiAccess)}</p>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>
