<script lang="ts">
	import type { PageData } from './$types';
	import type { PriceSnapshot, ProcessBucket } from './+page.server';
	import { goto } from '$app/navigation';
	import OriginLineChart from '$lib/components/analytics/OriginLineChart.svelte';
	import OriginBarChart from '$lib/components/analytics/OriginBarChart.svelte';
	import ProcessDonutChart from '$lib/components/analytics/ProcessDonutChart.svelte';

	let { data } = $props<{ data: PageData }>();

	let { session, isPpiMember, stats, snapshots, processDistribution } = $derived(
		data as {
			session: PageData['session'];
			isPpiMember: boolean;
			stats: {
				totalBeans: number;
				totalSuppliers: number;
				originsCount: number;
				lastUpdated: string | null;
			};
			snapshots: PriceSnapshot[];
			processDistribution: ProcessBucket[];
		}
	);

	// Derive origin bar chart data from most-recent snapshot date
	let originBarData = $derived.by(() => {
		if (!snapshots || snapshots.length === 0) return [];
		const latestDate = snapshots.reduce(
			(max, s) => (s.snapshot_date > max ? s.snapshot_date : max),
			''
		);
		const byOrigin = new Map<string, { sum: number; count: number; suppliers: number }>();
		for (const s of snapshots) {
			if (s.snapshot_date !== latestDate || s.price_avg == null) continue;
			const cur = byOrigin.get(s.origin) ?? { sum: 0, count: 0, suppliers: 0 };
			cur.sum += s.price_avg;
			cur.count += 1;
			cur.suppliers = Math.max(cur.suppliers, s.supplier_count);
			byOrigin.set(s.origin, cur);
		}
		return Array.from(byOrigin.entries()).map(([origin, v]) => ({
			origin,
			price_avg: Math.round((v.sum / v.count) * 100) / 100,
			supplier_count: v.suppliers
		}));
	});

	// Origin line chart: all snapshots (null process = all-process aggregated, or pick any)
	let lineSnapshots = $derived(snapshots.filter((s) => s.price_avg != null));

	let hasSnapshots = $derived(snapshots.length > 0);

	function formatDate(dateStr: string | null) {
		if (!dateStr) return 'N/A';
		return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>Analytics | Purveyors</title>
	<meta
		name="description"
		content="Green coffee market intelligence — daily price trends by origin, processing method distribution, and supplier coverage from 34 US importers."
	/>
</svelte:head>

<!-- Hero -->
<div class="mb-8 border-l-4 border-background-tertiary-light pl-6">
	<h1 class="mb-2 text-4xl font-bold text-text-primary-light">Green Coffee Market Intelligence</h1>
	<p class="text-lg text-text-secondary-light">
		Daily price data from {stats.totalSuppliers} US suppliers across {stats.originsCount} origins.
		{#if stats.lastUpdated}
			Last updated {formatDate(stats.lastUpdated)}.
		{:else}
			Data collection started March 21, 2026.
		{/if}
	</p>
</div>

<!-- Key Metrics Row -->
<div class="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
	<div
		class="rounded-lg border border-border-light bg-background-primary-light p-4 text-center shadow-sm"
	>
		<div class="text-3xl font-bold text-background-tertiary-light">{stats.totalSuppliers}</div>
		<div class="mt-1 text-sm text-text-secondary-light">Suppliers tracked</div>
	</div>
	<div
		class="rounded-lg border border-border-light bg-background-primary-light p-4 text-center shadow-sm"
	>
		<div class="text-3xl font-bold text-background-tertiary-light">{stats.totalBeans}</div>
		<div class="mt-1 text-sm text-text-secondary-light">Active beans</div>
	</div>
	<div
		class="rounded-lg border border-border-light bg-background-primary-light p-4 text-center shadow-sm"
	>
		<div class="text-3xl font-bold text-background-tertiary-light">{stats.originsCount}</div>
		<div class="mt-1 text-sm text-text-secondary-light">Origins covered</div>
	</div>
	<div
		class="rounded-lg border border-border-light bg-background-primary-light p-4 text-center shadow-sm"
	>
		<div class="text-xl font-bold text-background-tertiary-light">
			{stats.lastUpdated ? formatDate(stats.lastUpdated) : 'Daily'}
		</div>
		<div class="mt-1 text-sm text-text-secondary-light">Last updated</div>
	</div>
</div>

<!-- Public Charts Section -->
<div class="mb-8 space-y-6">
	<!-- Price Over Time — Origin Line Chart -->
	<div class="rounded-lg border border-border-light bg-background-primary-light p-6 shadow-sm">
		<h2 class="mb-1 text-xl font-semibold text-text-primary-light">Price Trends by Origin</h2>
		<p class="mb-4 text-sm text-text-secondary-light">
			Average $/lb by top origins over the last 30 days (retail, non-wholesale)
		</p>
		{#if hasSnapshots}
			<div class="h-64 w-full">
				<OriginLineChart snapshots={lineSnapshots} />
			</div>
		{:else}
			<div
				class="flex h-48 flex-col items-center justify-center rounded-lg bg-background-secondary-light"
			>
				<p class="text-sm font-medium text-text-secondary-light">
					📊 Price data collection started March 21, 2026
				</p>
				<p class="mt-1 text-xs text-text-secondary-light">
					Charts will populate as daily snapshots accumulate.
				</p>
			</div>
		{/if}
	</div>

	<!-- Two-column: Donut + Bar -->
	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
		<!-- Processing Method Distribution -->
		<div class="rounded-lg border border-border-light bg-background-primary-light p-6 shadow-sm">
			<h2 class="mb-1 text-xl font-semibold text-text-primary-light">Processing Methods</h2>
			<p class="mb-4 text-sm text-text-secondary-light">
				Distribution of processing methods across {stats.totalBeans} stocked beans
			</p>
			{#if processDistribution.length > 0}
				<div class="h-56 w-full">
					<ProcessDonutChart data={processDistribution} />
				</div>
			{:else}
				<div class="flex h-40 items-center justify-center rounded-lg bg-background-secondary-light">
					<p class="text-sm text-text-secondary-light">No catalog data yet.</p>
				</div>
			{/if}
		</div>

		<!-- Origin Price Comparison Bar Chart -->
		<div class="rounded-lg border border-border-light bg-background-primary-light p-6 shadow-sm">
			<h2 class="mb-1 text-xl font-semibold text-text-primary-light">Origin Price Comparison</h2>
			<p class="mb-4 text-sm text-text-secondary-light">
				Average $/lb by origin — most recent snapshot
			</p>
			{#if originBarData.length > 0}
				<div class="h-56 w-full">
					<OriginBarChart data={originBarData} />
				</div>
			{:else}
				<div
					class="flex h-40 flex-col items-center justify-center rounded-lg bg-background-secondary-light"
				>
					<p class="text-sm font-medium text-text-secondary-light">
						📊 Awaiting first price snapshot
					</p>
					<p class="mt-1 text-xs text-text-secondary-light">
						First chart will appear after today's scraper run.
					</p>
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- Gated Section -->
<div class="relative mb-8">
	<!-- Preview content (blurred for non-members) -->
	{#if !isPpiMember}
		<div class="pointer-events-none select-none">
			<div class="mb-3 blur-sm filter">
				<div
					class="rounded-lg border border-border-light bg-background-primary-light p-6 shadow-sm"
				>
					<h2 class="mb-4 text-xl font-semibold text-text-primary-light">
						Supplier Price Comparison Matrix
					</h2>
					<div class="grid grid-cols-3 gap-3">
						{#each Array(9) as _}
							<div class="rounded bg-background-secondary-light p-3">
								<div class="h-4 w-3/4 rounded bg-background-tertiary-light/30"></div>
								<div class="mt-2 h-6 w-1/2 rounded bg-background-tertiary-light/20"></div>
							</div>
						{/each}
					</div>
				</div>
			</div>
			<div class="grid grid-cols-1 gap-4 blur-sm filter lg:grid-cols-2">
				<div
					class="rounded-lg border border-border-light bg-background-primary-light p-6 shadow-sm"
				>
					<h2 class="mb-2 text-xl font-semibold text-text-primary-light">Price Tier Analysis</h2>
					<p class="text-sm text-text-secondary-light">Retail vs wholesale spread by origin</p>
					<div class="mt-4 h-40 rounded bg-background-secondary-light"></div>
				</div>
				<div
					class="rounded-lg border border-border-light bg-background-primary-light p-6 shadow-sm"
				>
					<h2 class="mb-2 text-xl font-semibold text-text-primary-light">90-Day Trend Detail</h2>
					<p class="text-sm text-text-secondary-light">Extended history with seasonal patterns</p>
					<div class="mt-4 h-40 rounded bg-background-secondary-light"></div>
				</div>
			</div>
		</div>

		<!-- CTA Overlay -->
		<div
			class="absolute inset-0 flex flex-col items-center justify-center rounded-lg bg-gradient-to-b from-background-primary-light/60 to-background-primary-light"
		>
			<div
				class="mx-4 max-w-md rounded-xl border border-background-tertiary-light/30 bg-background-primary-light p-8 text-center shadow-lg"
			>
				<div class="mb-3 text-3xl">📈</div>
				<h3 class="mb-2 text-2xl font-bold text-text-primary-light">
					Unlock Full Market Intelligence
				</h3>
				<p class="mb-6 text-text-secondary-light">
					PPI membership gives you supplier price comparison, retail/wholesale spread analysis, and
					extended 90-day + 1-year trend views — updated daily.
				</p>
				<div class="flex flex-col gap-3 sm:flex-row sm:justify-center">
					{#if session}
						<button
							onclick={() => goto('/subscription')}
							class="rounded-md bg-background-tertiary-light px-8 py-3 font-semibold text-white transition-all duration-200 hover:bg-opacity-90"
						>
							Upgrade to PPI Member
						</button>
					{:else}
						<button
							onclick={() => goto('/auth/signup')}
							class="rounded-md bg-background-tertiary-light px-8 py-3 font-semibold text-white transition-all duration-200 hover:bg-opacity-90"
						>
							Sign Up Free
						</button>
						<button
							onclick={() => goto('/auth/login')}
							class="rounded-md border border-background-tertiary-light px-8 py-3 font-semibold text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white"
						>
							Log In
						</button>
					{/if}
				</div>
				<p class="mt-4 text-xs text-text-secondary-light">Starting at $29/mo. Cancel anytime.</p>
			</div>
		</div>
	{:else}
		<!-- Full content for ppi-members -->
		<div class="space-y-6">
			<div
				class="rounded-lg border border-background-tertiary-light/20 bg-background-primary-light p-6 shadow-sm"
			>
				<div class="mb-4 flex items-center gap-2">
					<span class="text-sm font-semibold uppercase tracking-wide text-background-tertiary-light"
						>PPI Member</span
					>
					<span class="text-text-secondary-light">·</span>
					<h2 class="text-xl font-semibold text-text-primary-light">Supplier Price Comparison</h2>
				</div>
				{#if hasSnapshots}
					<div class="overflow-x-auto">
						<table class="min-w-full text-sm">
							<thead>
								<tr class="border-b border-border-light">
									<th class="py-2 pr-4 text-left font-semibold text-text-secondary-light">Origin</th
									>
									<th class="py-2 pr-4 text-right font-semibold text-text-secondary-light"
										>Avg $/lb</th
									>
									<th class="py-2 pr-4 text-right font-semibold text-text-secondary-light">Min</th>
									<th class="py-2 pr-4 text-right font-semibold text-text-secondary-light">Max</th>
									<th class="py-2 text-right font-semibold text-text-secondary-light">Suppliers</th>
								</tr>
							</thead>
							<tbody>
								{#each originBarData as row}
									<tr class="border-b border-border-light/50 hover:bg-background-secondary-light">
										<td class="py-2 pr-4 font-medium text-text-primary-light">{row.origin}</td>
										<td class="py-2 pr-4 text-right font-semibold text-text-primary-light"
											>${row.price_avg.toFixed(2)}</td
										>
										<td class="py-2 pr-4 text-right text-text-secondary-light">
											{#if snapshots.find((s) => s.origin === row.origin && s.price_min != null)}
												${snapshots.find((s) => s.origin === row.origin)?.price_min?.toFixed(2) ??
													'—'}
											{:else}
												—
											{/if}
										</td>
										<td class="py-2 pr-4 text-right text-text-secondary-light">
											{#if snapshots.find((s) => s.origin === row.origin && s.price_max != null)}
												${snapshots.find((s) => s.origin === row.origin)?.price_max?.toFixed(2) ??
													'—'}
											{:else}
												—
											{/if}
										</td>
										<td class="py-2 text-right text-text-secondary-light">{row.supplier_count}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{:else}
					<div
						class="flex h-24 items-center justify-center rounded-lg bg-background-secondary-light"
					>
						<p class="text-sm text-text-secondary-light">
							Awaiting first price snapshot (today's scraper run).
						</p>
					</div>
				{/if}
			</div>

			<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<div
					class="rounded-lg border border-background-tertiary-light/20 bg-background-primary-light p-6 shadow-sm"
				>
					<div class="mb-2 flex items-center gap-2">
						<span
							class="text-sm font-semibold uppercase tracking-wide text-background-tertiary-light"
							>PPI Member</span
						>
					</div>
					<h2 class="mb-1 text-xl font-semibold text-text-primary-light">Price Tier Analysis</h2>
					<p class="mb-4 text-sm text-text-secondary-light">
						Retail vs wholesale spread — coming as data accumulates
					</p>
					<div
						class="flex h-32 items-center justify-center rounded-lg bg-background-secondary-light"
					>
						<p class="text-sm text-text-secondary-light">Available after 7+ days of data</p>
					</div>
				</div>
				<div
					class="rounded-lg border border-background-tertiary-light/20 bg-background-primary-light p-6 shadow-sm"
				>
					<div class="mb-2 flex items-center gap-2">
						<span
							class="text-sm font-semibold uppercase tracking-wide text-background-tertiary-light"
							>PPI Member</span
						>
					</div>
					<h2 class="mb-1 text-xl font-semibold text-text-primary-light">Extended Trend Detail</h2>
					<p class="mb-4 text-sm text-text-secondary-light">
						90-day and 1-year views — coming as data accumulates
					</p>
					<div
						class="flex h-32 items-center justify-center rounded-lg bg-background-secondary-light"
					>
						<p class="text-sm text-text-secondary-light">Available after 30+ days of data</p>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- Data source note -->
<div class="mt-4 rounded-lg bg-background-secondary-light p-4 text-xs text-text-secondary-light">
	<strong class="text-text-primary-light">Data source:</strong> Prices aggregated daily from
	{stats.totalSuppliers} US green coffee importers and roasters. Retail (non-wholesale) beans only. The
	Purveyors Price Index (PPI) is updated each morning after scraper completion. Origin and processing
	method data is sourced directly from supplier listings.
</div>
