<script lang="ts">
	export interface ComparisonBean {
		name: string;
		country: string;
		processing: string | null;
		cost_lb: number;
		source: string;
		wholesale: boolean;
		bag_size: string | null;
	}

	let { beans = [] }: { beans: ComparisonBean[] } = $props();

	// Derive unique origins sorted by bean count descending
	let originCounts = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const b of beans) {
			counts.set(b.country, (counts.get(b.country) ?? 0) + 1);
		}
		return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
	});

	// Default to the origin with the most beans
	let selectedOrigin = $state('');

	$effect(() => {
		if (originCounts.length > 0 && !selectedOrigin) {
			selectedOrigin = originCounts[0][0];
		}
	});

	// Filter beans for selected origin, sorted by cost_lb ascending
	let filteredBeans = $derived.by(() => {
		if (!selectedOrigin) return [];
		return beans.filter((b) => b.country === selectedOrigin).sort((a, b) => a.cost_lb - b.cost_lb);
	});

	// Stats for the summary line
	let beanCount = $derived(filteredBeans.length);
	let supplierCount = $derived(new Set(filteredBeans.map((b) => b.source)).size);

	// Cheapest cost_lb (already sorted ascending, so index 0)
	let cheapestCostLb = $derived(filteredBeans.length > 0 ? filteredBeans[0].cost_lb : null);

	function formatSourceName(source: string): string {
		// Special-case known sources for better display names
		const overrides: Record<string, string> = {
			sweet_maria: "Sweet Maria's",
			royal_coffee: 'Royal Coffee',
			cafe_imports: 'Cafe Imports',
			red_fox: 'Red Fox Coffee Merchants',
			ml_trading: 'ML Trading',
			genuine_origin: 'Genuine Origin',
			st_helena: 'St. Helena Coffee'
		};
		if (overrides[source]) return overrides[source];
		return source
			.split('_')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}

	function formatProcessing(processing: string | null): string {
		if (!processing) return '—';
		const s = processing.trim();
		return s.length > 20 ? s.slice(0, 18) + '…' : s;
	}
</script>

<div class="rounded-lg border border-border-light bg-background-primary-light p-6 shadow-sm">
	<!-- Header -->
	<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h2 class="text-xl font-semibold text-text-primary-light">Supplier Price Comparison</h2>
			<p class="mt-0.5 text-sm text-text-secondary-light">
				All stocked beans for a selected origin, sorted by price — cheapest first.
			</p>
		</div>

		<!-- Origin selector -->
		<div class="flex items-center gap-2">
			<label for="origin-select" class="shrink-0 text-sm font-medium text-text-secondary-light">
				Origin:
			</label>
			<select
				id="origin-select"
				bind:value={selectedOrigin}
				class="rounded-md border border-border-light bg-background-secondary-light px-3 py-1.5 text-sm text-text-primary-light shadow-sm focus:border-background-tertiary-light focus:outline-none focus:ring-1 focus:ring-background-tertiary-light"
			>
				{#each originCounts as [origin, count]}
					<option value={origin}>{origin} ({count})</option>
				{/each}
			</select>
		</div>
	</div>

	<!-- Summary line -->
	{#if beanCount > 0}
		<p class="mb-3 text-xs text-text-secondary-light">
			<span class="font-semibold text-background-tertiary-light">{beanCount}</span>
			{beanCount === 1 ? 'bean' : 'beans'} from
			<span class="font-semibold text-background-tertiary-light">{supplierCount}</span>
			{supplierCount === 1 ? 'supplier' : 'suppliers'}
		</p>
	{/if}

	<!-- Table -->
	{#if filteredBeans.length > 0}
		<div class="overflow-x-auto">
			<table class="min-w-full text-sm">
				<thead>
					<tr class="border-b border-border-light">
						<th class="py-2 pr-3 text-left font-semibold text-text-secondary-light">Supplier</th>
						<th class="py-2 pr-3 text-left font-semibold text-text-secondary-light">Bean Name</th>
						<th class="py-2 pr-3 text-left font-semibold text-text-secondary-light">Processing</th>
						<th class="py-2 pr-3 text-right font-semibold text-text-secondary-light">Price</th>
						<th
							class="hidden py-2 pr-3 text-left font-semibold text-text-secondary-light sm:table-cell"
							>Bag Size</th
						>
						<th class="py-2 text-center font-semibold text-text-secondary-light">Type</th>
					</tr>
				</thead>
				<tbody>
					{#each filteredBeans as bean, i}
						{@const isCheapest = bean.cost_lb === cheapestCostLb}
						<tr
							class="border-b border-border-light/50 transition-colors
								{i % 2 === 0 ? 'bg-background-primary-light' : 'bg-background-secondary-light/50'}
								{isCheapest ? 'ring-1 ring-inset ring-background-tertiary-light/40' : ''}
								hover:bg-background-secondary-light"
						>
							<td class="py-2 pr-3 font-medium text-text-primary-light">
								{formatSourceName(bean.source)}
							</td>
							<td
								class="max-w-[10rem] truncate py-2 pr-3 text-text-primary-light sm:max-w-[14rem]"
								title={bean.name}
							>
								{bean.name}
							</td>
							<td class="py-2 pr-3 text-text-secondary-light">
								{formatProcessing(bean.processing)}
							</td>
							<td class="py-2 pr-3 text-right">
								<span
									class="font-semibold
										{isCheapest ? 'text-background-tertiary-light' : 'text-text-primary-light'}"
								>
									${bean.cost_lb.toFixed(2)}/lb
								</span>
								{#if isCheapest}
									<span
										class="ml-1 hidden rounded-full bg-background-tertiary-light/15 px-1.5 py-0.5 text-xs font-medium text-background-tertiary-light sm:inline"
									>
										Best
									</span>
								{/if}
							</td>
							<td class="hidden py-2 pr-3 text-text-secondary-light sm:table-cell">
								{bean.bag_size ?? '—'}
							</td>
							<td class="py-2 text-center">
								{#if bean.wholesale}
									<span
										class="rounded-full border border-text-secondary-light/30 px-2 py-0.5 text-xs italic text-text-secondary-light"
									>
										Wholesale
									</span>
								{:else}
									<span class="text-xs text-text-secondary-light/50">Retail</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<div class="flex h-24 items-center justify-center rounded-lg bg-background-secondary-light">
			<p class="text-sm text-text-secondary-light">
				{#if selectedOrigin}
					No stocked beans with pricing data for {selectedOrigin}.
				{:else}
					Select an origin to compare supplier prices.
				{/if}
			</p>
		</div>
	{/if}
</div>
