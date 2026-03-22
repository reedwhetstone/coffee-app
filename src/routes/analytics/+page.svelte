<script lang="ts">
	import type { PageData } from './$types';
	import type {
		PriceSnapshot,
		ProcessBucket,
		OriginRangeRow,
		ArrivalBean,
		DelistingBean,
		ComparisonBean,
		SupplierHealthRow
	} from './+page.server';
	import { goto } from '$app/navigation';
	import OriginLineChart from '$lib/components/analytics/OriginLineChart.svelte';
	import OriginBarChart from '$lib/components/analytics/OriginBarChart.svelte';
	import ProcessDonutChart from '$lib/components/analytics/ProcessDonutChart.svelte';
	import SupplierComparisonTable from '$lib/components/analytics/SupplierComparisonTable.svelte';
	import SupplierHealthTable from '$lib/components/analytics/SupplierHealthTable.svelte';
	import ExpandablePanel from '$lib/components/analytics/ExpandablePanel.svelte';

	let { data } = $props<{ data: PageData }>();

	let {
		session,
		isPpiMember,
		stats,
		snapshots,
		processDistribution,
		originRangeData,
		recentArrivals,
		recentDelistings,
		comparisonBeans,
		supplierHealth
	} = $derived(
		data as {
			session: PageData['session'];
			isPpiMember: boolean;
			stats: {
				totalBeansTracked: number;
				stockedRetailBeans: number;
				stockedWholesaleBeans: number;
				totalSuppliers: number;
				originsCount: number;
				lastUpdated: string | null;
			};
			snapshots: PriceSnapshot[];
			processDistribution: ProcessBucket[];
			originRangeData: OriginRangeRow[];
			recentArrivals: ArrivalBean[];
			recentDelistings: DelistingBean[];
			comparisonBeans: ComparisonBean[];
			supplierHealth: SupplierHealthRow[];
		}
	);

	// Wholesale/Retail/All toggle state
	type ViewMode = 'retail' | 'wholesale' | 'all';
	let viewMode = $state<ViewMode>('retail');

	// Derive filtered snapshots based on viewMode
	let filteredSnapshots = $derived.by(() => {
		if (viewMode === 'retail') return snapshots.filter((s) => !s.wholesale_only);
		if (viewMode === 'wholesale') return snapshots.filter((s) => s.wholesale_only);
		return snapshots;
	});

	// Derive filtered process distribution based on viewMode
	let filteredProcessDist = $derived.by((): ProcessBucket[] => {
		if (viewMode === 'retail') return processDistribution.filter((b) => !b.wholesale);
		if (viewMode === 'wholesale') return processDistribution.filter((b) => b.wholesale);
		// All: merge retail + wholesale counts by name
		const merged = new Map<string, number>();
		for (const b of processDistribution) {
			merged.set(b.name, (merged.get(b.name) ?? 0) + b.count);
		}
		return Array.from(merged.entries())
			.sort((a, b) => b[1] - a[1])
			.map(([name, count]) => ({ name, count, wholesale: false }));
	});

	// Stocked count shown in the stats tile based on viewMode
	let displayStockedCount = $derived.by(() => {
		if (viewMode === 'retail') return stats.stockedRetailBeans;
		if (viewMode === 'wholesale') return stats.stockedWholesaleBeans;
		return stats.stockedRetailBeans + stats.stockedWholesaleBeans;
	});

	// Derive origin bar chart data from most-recent snapshot date (filtered)
	let originBarData = $derived.by(() => {
		if (!filteredSnapshots || filteredSnapshots.length === 0) return [];
		const latestDate = filteredSnapshots.reduce(
			(max, s) => (s.snapshot_date > max ? s.snapshot_date : max),
			''
		);
		const byOrigin = new Map<
			string,
			{ sum: number; count: number; suppliers: number; sample_size: number }
		>();
		for (const s of filteredSnapshots) {
			if (s.snapshot_date !== latestDate || s.price_avg == null) continue;
			const cur = byOrigin.get(s.origin) ?? { sum: 0, count: 0, suppliers: 0, sample_size: 0 };
			cur.sum += s.price_avg;
			cur.count += 1;
			cur.suppliers = Math.max(cur.suppliers, s.supplier_count);
			cur.sample_size += s.sample_size ?? 0;
			byOrigin.set(s.origin, cur);
		}
		return Array.from(byOrigin.entries()).map(([origin, v]) => ({
			origin,
			price_avg: Math.round((v.sum / v.count) * 100) / 100,
			supplier_count: v.suppliers,
			sample_size: v.sample_size
		}));
	});

	// Line chart: filtered snapshots with price data
	let lineSnapshots = $derived(filteredSnapshots.filter((s) => s.price_avg != null));

	let hasSnapshots = $derived(filteredSnapshots.length > 0);

	// Stocked beans count for lead headline (retail + wholesale combined)
	let stockedBeans = $derived(stats.stockedRetailBeans + stats.stockedWholesaleBeans);

	function formatDate(dateStr: string | null) {
		if (!dateStr) return 'N/A';
		return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		});
	}

	// Relative time for freshness indicator
	function formatRelativeTime(dateStr: string | null): string {
		if (!dateStr) return 'Daily';
		const now = new Date();
		const todayStr = now.toISOString().split('T')[0];
		const yesterdayDate = new Date(now);
		yesterdayDate.setDate(yesterdayDate.getDate() - 1);
		const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

		if (dateStr === todayStr) {
			const updated = new Date(dateStr + 'T00:00:00');
			const hoursAgo = Math.floor((now.getTime() - updated.getTime()) / 3600000);
			if (hoursAgo < 1) return 'Just now';
			if (hoursAgo === 1) return '1h ago';
			return `${hoursAgo}h ago`;
		}
		if (dateStr === yesterdayStr) return 'Yesterday';
		return formatDate(dateStr);
	}

	const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
		{ value: 'retail', label: 'Retail' },
		{ value: 'wholesale', label: 'Wholesale' },
		{ value: 'all', label: 'All' }
	];

	// Arrivals/Delistings window toggle
	type WindowMode = '7d' | '30d';
	let windowMode = $state<WindowMode>('7d');

	const WINDOW_OPTIONS: { value: WindowMode; label: string }[] = [
		{ value: '7d', label: 'Last 7 days' },
		{ value: '30d', label: 'Last 30 days' }
	];

	let filteredArrivals = $derived.by(() => {
		if (!recentArrivals) return [];
		if (windowMode === '30d') return recentArrivals;
		const cutoff = new Date();
		cutoff.setDate(cutoff.getDate() - 7);
		const cutoffStr = cutoff.toISOString().split('T')[0];
		return recentArrivals.filter((b) => b.stocked_date != null && b.stocked_date >= cutoffStr);
	});

	let filteredDelistings = $derived.by(() => {
		if (!recentDelistings) return [];
		if (windowMode === '30d') return recentDelistings;
		const cutoff = new Date();
		cutoff.setDate(cutoff.getDate() - 7);
		const cutoffStr = cutoff.toISOString().split('T')[0];
		return recentDelistings.filter(
			(b) => b.unstocked_date != null && b.unstocked_date >= cutoffStr
		);
	});

	let delistingsByCountry = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const b of filteredDelistings) {
			const key = b.country ?? 'Unknown';
			counts.set(key, (counts.get(key) ?? 0) + 1);
		}
		return Array.from(counts.entries())
			.sort((a, b) => b[1] - a[1])
			.map(([country, count]) => ({ country, count }));
	});

	function daysSince(dateStr: string | null): number {
		if (!dateStr) return 0;
		const then = new Date(dateStr + 'T00:00:00');
		const now = new Date();
		return Math.floor((now.getTime() - then.getTime()) / 86400000);
	}

	function formatSource(source: string | null): string {
		if (!source) return '—';
		return source
			.split(/[_-]+/)
			.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
			.join(' ');
	}

	function truncateName(name: string | null): string {
		if (!name) return '—';
		return name.length > 30 ? name.slice(0, 28) + '…' : name;
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
		<div class="text-3xl font-bold text-background-tertiary-light">
			{displayStockedCount.toLocaleString()}
		</div>
		<div class="mt-1 text-sm text-text-secondary-light">
			{#if viewMode === 'retail'}
				Stocked retail
			{:else if viewMode === 'wholesale'}
				Stocked wholesale
			{:else}
				Stocked beans
			{/if}
		</div>
		{#if viewMode === 'all'}
			<div class="mt-0.5 text-xs text-text-secondary-light/60">
				{stats.stockedRetailBeans.toLocaleString()} retail · {stats.stockedWholesaleBeans.toLocaleString()}
				wholesale
			</div>
		{:else}
			<div class="mt-0.5 text-xs text-text-secondary-light/60">
				{stats.totalBeansTracked.toLocaleString()} total tracked
			</div>
		{/if}
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
			{formatRelativeTime(stats.lastUpdated)}
		</div>
		<div class="mt-1 text-sm text-text-secondary-light">Last updated</div>
	</div>
</div>

<!-- Wholesale/Retail Toggle -->
<div class="mb-6 flex items-center gap-3">
	<span class="text-sm font-medium text-text-secondary-light">View:</span>
	<div
		class="flex rounded-full border border-border-light bg-background-secondary-light p-1 shadow-sm"
	>
		{#each VIEW_OPTIONS as opt}
			<button
				onclick={() => (viewMode = opt.value)}
				class="rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-150
				{viewMode === opt.value
					? 'bg-background-tertiary-light text-white shadow-sm'
					: 'text-text-secondary-light hover:text-text-primary-light'}"
			>
				{opt.label}
			</button>
		{/each}
	</div>
</div>

<!-- Lead Insight Headline -->
<div class="mb-6 rounded-lg border border-border-light bg-background-secondary-light px-5 py-3">
	<p class="text-sm font-medium text-text-primary-light">
		Tracking live prices across <span class="text-background-tertiary-light"
			>{stats.totalSuppliers}</span
		>
		suppliers. <span class="text-background-tertiary-light">{stockedBeans.toLocaleString()}</span>
		stocked beans from <span class="text-background-tertiary-light">{stats.originsCount}</span> origins.
	</p>
</div>

<!-- Public Charts Section -->
<div class="mb-8 space-y-6">
	<!-- Price Over Time — Origin Line Chart -->
	<ExpandablePanel
		title="Price Trends by Origin"
		subtitle="Average $/lb by top origins over the last 30 days — ranked by market volume"
		collapsedMaxHeight="360px"
		showGradient={false}
	>
		<div class="rounded-lg border border-border-light bg-background-primary-light p-6 shadow-sm">
			<h2 class="mb-1 text-xl font-semibold text-text-primary-light">Price Trends by Origin</h2>
			<p class="mb-4 text-sm text-text-secondary-light">
				Average $/lb by top origins over the last 30 days — ranked by market volume
				{#if viewMode === 'retail'}(retail){:else if viewMode === 'wholesale'}(wholesale){:else}(all){/if}
			</p>
			<div class="h-64 w-full">
				<OriginLineChart snapshots={lineSnapshots} />
			</div>
		</div>
	</ExpandablePanel>

	<!-- Two-column: Donut + Bar -->
	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
		<!-- Processing Method Distribution -->
		<ExpandablePanel
			title="Processing Methods"
			subtitle="Distribution across stocked beans"
			collapsedMaxHeight="360px"
			showGradient={false}
		>
			<div class="rounded-lg border border-border-light bg-background-primary-light p-6 shadow-sm">
				<h2 class="mb-1 text-xl font-semibold text-text-primary-light">Processing Methods</h2>
				<p class="mb-4 text-sm text-text-secondary-light">
					Distribution across {displayStockedCount.toLocaleString()} stocked beans
					{#if viewMode === 'retail'}(retail){:else if viewMode === 'wholesale'}(wholesale){:else}(all){/if}
				</p>
				{#if filteredProcessDist.length > 0}
					<div class="h-56 w-full">
						<ProcessDonutChart data={filteredProcessDist} />
					</div>
				{:else}
					<div
						class="flex h-40 items-center justify-center rounded-lg bg-background-secondary-light"
					>
						<p class="text-sm text-text-secondary-light">No catalog data yet.</p>
					</div>
				{/if}
			</div>
		</ExpandablePanel>

		<!-- Origin Price Range Chart -->
		<ExpandablePanel
			title="Origin Price Ranges"
			subtitle="Price spread by origin — IQR box, median & mean markers, full min/max range"
			collapsedMaxHeight="400px"
			showGradient={false}
		>
			<div class="rounded-lg border border-border-light bg-background-primary-light p-6 shadow-sm">
				<h2 class="mb-1 text-xl font-semibold text-text-primary-light">Origin Price Ranges</h2>
				<p class="mb-4 text-sm text-text-secondary-light">
					Price spread by origin — IQR box, median &amp; mean markers, full min/max range. Live from
					catalog.
				</p>
				{#if originRangeData.length > 0}
					<div class="h-64 w-full sm:h-80">
						<OriginBarChart data={originRangeData} />
					</div>
				{:else}
					<div
						class="flex h-40 flex-col items-center justify-center rounded-lg bg-background-secondary-light"
					>
						<p class="text-sm font-medium text-text-secondary-light">📊 No origin data available</p>
						<p class="mt-1 text-xs text-text-secondary-light">
							Requires stocked beans with price_per_lb values in the catalog.
						</p>
					</div>
				{/if}
			</div>
		</ExpandablePanel>
	</div>
</div>

<!-- Supplier Price Comparison -->
<div class="mb-8">
	<ExpandablePanel
		title="Supplier Price Comparison"
		subtitle="All stocked beans for a selected origin, sorted by price — cheapest first."
		totalItems={comparisonBeans.length}
	>
		<SupplierComparisonTable beans={comparisonBeans} />
	</ExpandablePanel>
</div>

<!-- Supplier Overview -->
<div class="mb-8">
	<div class="mb-3">
		<h2 class="text-xl font-semibold text-text-primary-light">Supplier Catalog Health</h2>
		<p class="mt-1 text-sm text-text-secondary-light">
			Catalog breadth and pricing by supplier — click any column header to sort. A quick answer to
			"which suppliers should I be looking at?"
		</p>
	</div>
	{#if supplierHealth && supplierHealth.length > 0}
		<ExpandablePanel
			title="Supplier Catalog Health"
			subtitle="Catalog breadth and pricing by supplier — click any column header to sort."
			totalItems={supplierHealth.length}
		>
			<SupplierHealthTable rows={supplierHealth} />
		</ExpandablePanel>
	{:else}
		<div
			class="flex h-24 items-center justify-center rounded-lg border border-border-light bg-background-secondary-light"
		>
			<p class="text-sm text-text-secondary-light">No supplier data available yet.</p>
		</div>
	{/if}
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
					<h2 class="mb-4 text-xl font-semibold text-text-primary-light">Origin Price Index</h2>
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
											{#if filteredSnapshots.find((s) => s.origin === row.origin && s.price_min != null)}
												${filteredSnapshots
													.find((s) => s.origin === row.origin)
													?.price_min?.toFixed(2) ?? '—'}
											{:else}
												—
											{/if}
										</td>
										<td class="py-2 pr-4 text-right text-text-secondary-light">
											{#if filteredSnapshots.find((s) => s.origin === row.origin && s.price_max != null)}
												${filteredSnapshots
													.find((s) => s.origin === row.origin)
													?.price_max?.toFixed(2) ?? '—'}
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

<!-- New Arrivals + Recent Delistings -->
<div class="mb-8">
	{#if session}
		<!-- Window Toggle -->
		<div class="mb-4 flex items-center gap-3">
			<span class="text-sm font-medium text-text-secondary-light">Show:</span>
			<div
				class="flex rounded-full border border-border-light bg-background-secondary-light p-1 shadow-sm"
			>
				{#each WINDOW_OPTIONS as opt}
					<button
						onclick={() => (windowMode = opt.value)}
						class="rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-150
						{windowMode === opt.value
							? 'bg-background-tertiary-light text-white shadow-sm'
							: 'text-text-secondary-light hover:text-text-primary-light'}"
					>
						{opt.label}
					</button>
				{/each}
			</div>
		</div>

		<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
			<!-- New Arrivals -->
			<ExpandablePanel
				title="New Arrivals"
				badge="+{filteredArrivals.length}"
				badgeColor="amber"
				totalItems={filteredArrivals.length}
			>
				<div class="rounded-lg border border-amber-200 bg-background-primary-light p-6 shadow-sm">
					<div class="mb-3 flex items-center justify-between">
						<div>
							<h2 class="text-xl font-semibold text-text-primary-light">New Arrivals</h2>
							<p class="mt-0.5 text-sm text-text-secondary-light">
								{filteredArrivals.length} new arrival{filteredArrivals.length === 1 ? '' : 's'} this
								{windowMode === '7d' ? 'week' : 'month'}
							</p>
						</div>
						<span class="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700"
							>+{filteredArrivals.length}</span
						>
					</div>
					{#if filteredArrivals.length > 0}
						<div class="overflow-x-auto">
							<table class="min-w-full text-sm">
								<thead>
									<tr class="border-b border-border-light">
										<th
											class="pb-2 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary-light"
											>Bean</th
										>
										<th
											class="pb-2 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary-light"
											>Origin</th
										>
										<th
											class="pb-2 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary-light"
											>Process</th
										>
										<th
											class="pb-2 pr-3 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary-light"
											>$/lb</th
										>
										<th
											class="pb-2 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary-light"
											>Supplier</th
										>
										<th
											class="pb-2 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary-light"
											>Days</th
										>
									</tr>
								</thead>
								<tbody>
									{#each filteredArrivals as bean}
										{@const days = daysSince(bean.stocked_date)}
										<tr class="border-b border-border-light/40 hover:bg-amber-50">
											<td class="py-2 pr-3 font-medium text-text-primary-light" title={bean.name}
												>{truncateName(bean.name)}</td
											>
											<td class="py-2 pr-3 text-text-secondary-light">{bean.country ?? '—'}</td>
											<td class="py-2 pr-3 text-text-secondary-light">{bean.processing ?? '—'}</td>
											<td class="py-2 pr-3 text-right font-semibold text-text-primary-light"
												>{bean.price_per_lb != null ? '$' + bean.price_per_lb.toFixed(2) : '—'}</td
											>
											<td class="py-2 pr-3 text-text-secondary-light"
												>{formatSource(bean.source)}</td
											>
											<td class="py-2 text-right"
												><span
													class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700"
													>{days === 0 ? 'Today' : days + 'd'}</span
												></td
											>
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
								No new arrivals in the selected window.
							</p>
						</div>
					{/if}
				</div>
			</ExpandablePanel>

			<!-- Recent Delistings -->
			<ExpandablePanel
				title="Recent Delistings"
				badge="-{filteredDelistings.length}"
				badgeColor="red"
				totalItems={filteredDelistings.length}
			>
				<div class="rounded-lg border border-red-200 bg-background-primary-light p-6 shadow-sm">
					<div class="mb-3 flex items-center justify-between">
						<div>
							<h2 class="text-xl font-semibold text-text-primary-light">Recent Delistings</h2>
							<p class="mt-0.5 text-sm text-text-secondary-light">
								{filteredDelistings.length} bean{filteredDelistings.length === 1 ? '' : 's'} delisted
								this
								{windowMode === '7d' ? 'week' : 'month'}
							</p>
						</div>
						<span class="rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-600"
							>-{filteredDelistings.length}</span
						>
					</div>
					{#if delistingsByCountry.length > 0}
						<p class="mb-3 text-xs text-text-secondary-light">
							{delistingsByCountry
								.slice(0, 5)
								.map((d) => d.country + ': ' + d.count)
								.join(' · ')}
						</p>
					{/if}
					{#if filteredDelistings.length > 0}
						<div class="overflow-x-auto">
							<table class="min-w-full text-sm">
								<thead>
									<tr class="border-b border-border-light">
										<th
											class="pb-2 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary-light"
											>Bean</th
										>
										<th
											class="pb-2 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary-light"
											>Origin</th
										>
										<th
											class="pb-2 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary-light"
											>Process</th
										>
										<th
											class="pb-2 pr-3 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary-light"
											>Last $/lb</th
										>
										<th
											class="pb-2 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary-light"
											>Supplier</th
										>
										<th
											class="pb-2 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary-light"
											>Days</th
										>
									</tr>
								</thead>
								<tbody>
									{#each filteredDelistings as bean}
										{@const days = daysSince(bean.unstocked_date)}
										<tr class="border-b border-border-light/40 hover:bg-red-50">
											<td class="py-2 pr-3 font-medium text-text-secondary-light" title={bean.name}
												>{truncateName(bean.name)}</td
											>
											<td class="py-2 pr-3 text-text-secondary-light">{bean.country ?? '—'}</td>
											<td class="py-2 pr-3 text-text-secondary-light">{bean.processing ?? '—'}</td>
											<td class="py-2 pr-3 text-right text-text-secondary-light"
												>{bean.price_per_lb != null ? '$' + bean.price_per_lb.toFixed(2) : '—'}</td
											>
											<td class="py-2 pr-3 text-text-secondary-light"
												>{formatSource(bean.source)}</td
											>
											<td class="py-2 text-right"
												><span
													class="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600"
													>{days === 0 ? 'Today' : days + 'd'}</span
												></td
											>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{:else}
						<div
							class="flex h-24 items-center justify-center rounded-lg bg-background-secondary-light"
						>
							<p class="text-sm text-text-secondary-light">No delistings in the selected window.</p>
						</div>
					{/if}
				</div>
			</ExpandablePanel>
		</div>
	{:else}
		<!-- Blurred preview for unauthenticated users -->
		<div class="relative">
			<div class="pointer-events-none select-none blur-sm filter">
				<div class="mb-4 flex items-center gap-3">
					<span class="text-sm font-medium text-text-secondary-light">Show:</span>
					<div
						class="flex rounded-full border border-border-light bg-background-secondary-light p-1 shadow-sm"
					>
						<button
							class="rounded-full bg-background-tertiary-light px-4 py-1.5 text-sm font-medium text-white shadow-sm"
						>
							Last 7 days
						</button>
						<button class="rounded-full px-4 py-1.5 text-sm font-medium text-text-secondary-light">
							Last 30 days
						</button>
					</div>
				</div>
				<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
					<!-- Arrivals skeleton -->
					<div class="rounded-lg border border-amber-200 bg-background-primary-light p-6 shadow-sm">
						<div class="mb-3 flex items-center justify-between">
							<div>
								<h2 class="text-xl font-semibold text-text-primary-light">New Arrivals</h2>
								<p class="mt-0.5 text-sm text-text-secondary-light">12 new arrivals this week</p>
							</div>
							<span class="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700"
								>+12</span
							>
						</div>
						<div class="space-y-2">
							{#each Array(5) as _}
								<div class="flex items-center gap-3 border-b border-border-light/40 py-2">
									<div class="h-4 w-32 rounded bg-background-secondary-light"></div>
									<div class="h-4 w-16 rounded bg-background-secondary-light"></div>
									<div class="h-4 w-16 rounded bg-background-secondary-light"></div>
									<div class="ml-auto h-4 w-12 rounded bg-amber-100"></div>
								</div>
							{/each}
						</div>
					</div>
					<!-- Delistings skeleton -->
					<div class="rounded-lg border border-red-200 bg-background-primary-light p-6 shadow-sm">
						<div class="mb-3 flex items-center justify-between">
							<div>
								<h2 class="text-xl font-semibold text-text-primary-light">Recent Delistings</h2>
								<p class="mt-0.5 text-sm text-text-secondary-light">8 beans delisted this week</p>
							</div>
							<span class="rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-600"
								>-8</span
							>
						</div>
						<div class="space-y-2">
							{#each Array(5) as _}
								<div class="flex items-center gap-3 border-b border-border-light/40 py-2">
									<div class="h-4 w-32 rounded bg-background-secondary-light"></div>
									<div class="h-4 w-16 rounded bg-background-secondary-light"></div>
									<div class="h-4 w-16 rounded bg-background-secondary-light"></div>
									<div class="ml-auto h-4 w-12 rounded bg-red-100"></div>
								</div>
							{/each}
						</div>
					</div>
				</div>
			</div>

			<!-- CTA overlay -->
			<div
				class="absolute inset-0 flex flex-col items-center justify-center rounded-lg bg-gradient-to-b from-background-primary-light/60 to-background-primary-light"
			>
				<div
					class="mx-4 max-w-md rounded-xl border border-background-tertiary-light/30 bg-background-primary-light p-8 text-center shadow-lg"
				>
					<div class="mb-3 text-3xl">📦</div>
					<h3 class="mb-2 text-2xl font-bold text-text-primary-light">
						Track New Arrivals & Delistings
					</h3>
					<p class="mb-6 text-text-secondary-light">
						Sign up free to track new arrivals and delistings across {stats.totalSuppliers} suppliers
						— updated daily.
					</p>
					<div class="flex flex-col gap-3 sm:flex-row sm:justify-center">
						<button
							onclick={() => goto('/auth')}
							class="rounded-md bg-background-tertiary-light px-8 py-3 font-semibold text-white transition-all duration-200 hover:bg-opacity-90"
						>
							Sign Up Free
						</button>
						<button
							onclick={() => goto('/auth')}
							class="rounded-md border border-background-tertiary-light px-8 py-3 font-semibold text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white"
						>
							Sign In
						</button>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- Data source note -->
<div class="mt-4 rounded-lg bg-background-secondary-light p-4 text-xs text-text-secondary-light">
	<strong class="text-text-primary-light">Data source:</strong> Prices aggregated daily from
	{stats.totalSuppliers} US green coffee importers and roasters. The Purveyors Price Index (PPI) is updated
	each morning after scraper completion. Origin and processing method data is sourced directly from supplier
	listings.
</div>
