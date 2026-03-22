<script lang="ts">
	export interface SupplierRow {
		source: string;
		stockedCount: number;
		origins: number;
		avgCostLb: number;
		minCostLb: number;
		maxCostLb: number;
		wholesaleCount: number;
		retailCount: number;
	}

	let { rows = [] }: { rows: SupplierRow[] } = $props();

	type SortKey = 'source' | 'stockedCount' | 'origins' | 'avgCostLb' | 'priceRange' | 'split';
	let sortKey = $state<SortKey>('stockedCount');
	let sortAsc = $state(false);

	function formatSourceName(source: string): string {
		return source
			.split(/[_-]+/)
			.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
			.join(' ');
	}

	let sorted = $derived.by(() => {
		const copy = [...rows];
		copy.sort((a, b) => {
			let cmp = 0;
			switch (sortKey) {
				case 'source':
					cmp = formatSourceName(a.source).localeCompare(formatSourceName(b.source));
					break;
				case 'stockedCount':
					cmp = a.stockedCount - b.stockedCount;
					break;
				case 'origins':
					cmp = a.origins - b.origins;
					break;
				case 'avgCostLb':
					cmp = a.avgCostLb - b.avgCostLb;
					break;
				case 'priceRange':
					cmp = a.maxCostLb - a.minCostLb - (b.maxCostLb - b.minCostLb);
					break;
				case 'split':
					cmp = a.wholesaleCount / (a.stockedCount || 1) - b.wholesaleCount / (b.stockedCount || 1);
					break;
			}
			return sortAsc ? cmp : -cmp;
		});
		return copy;
	});

	function setSort(key: SortKey) {
		if (sortKey === key) {
			sortAsc = !sortAsc;
		} else {
			sortKey = key;
			sortAsc = false;
		}
	}

	function sortIcon(key: SortKey): string {
		if (sortKey !== key) return '↕';
		return sortAsc ? '↑' : '↓';
	}

	// Top 3 by stocked count get accent highlight
	let top3Sources = $derived(
		[...rows]
			.sort((a, b) => b.stockedCount - a.stockedCount)
			.slice(0, 3)
			.map((r) => r.source)
	);

	let totalStocked = $derived(rows.reduce((s, r) => s + r.stockedCount, 0));
	let totalRetail = $derived(rows.reduce((s, r) => s + r.retailCount, 0));
	let totalWholesale = $derived(rows.reduce((s, r) => s + r.wholesaleCount, 0));

	// Overall avg cost
	let overallAvg = $derived.by(() => {
		if (rows.length === 0) return 0;
		const totalCost = rows.reduce((s, r) => s + r.avgCostLb * r.stockedCount, 0);
		return totalCost / (totalStocked || 1);
	});
</script>

<div class="overflow-x-auto rounded-lg border border-border-light shadow-sm">
	<table class="min-w-full text-sm">
		<thead>
			<tr class="border-b border-border-light bg-background-secondary-light">
				<th
					class="cursor-pointer select-none px-4 py-3 text-left font-semibold text-text-secondary-light hover:text-text-primary-light"
					onclick={() => setSort('source')}
				>
					Supplier {sortIcon('source')}
				</th>
				<th
					class="cursor-pointer select-none px-4 py-3 text-right font-semibold text-text-secondary-light hover:text-text-primary-light"
					onclick={() => setSort('stockedCount')}
				>
					Stocked {sortIcon('stockedCount')}
				</th>
				<th
					class="cursor-pointer select-none px-4 py-3 text-right font-semibold text-text-secondary-light hover:text-text-primary-light"
					onclick={() => setSort('origins')}
				>
					Origins {sortIcon('origins')}
				</th>
				<th
					class="cursor-pointer select-none px-4 py-3 text-right font-semibold text-text-secondary-light hover:text-text-primary-light"
					onclick={() => setSort('avgCostLb')}
				>
					Avg $/lb {sortIcon('avgCostLb')}
				</th>
				<th
					class="hidden cursor-pointer select-none px-4 py-3 text-right font-semibold text-text-secondary-light hover:text-text-primary-light sm:table-cell"
					onclick={() => setSort('priceRange')}
				>
					Price Range {sortIcon('priceRange')}
				</th>
				<th
					class="cursor-pointer select-none px-4 py-3 text-right font-semibold text-text-secondary-light hover:text-text-primary-light"
					onclick={() => setSort('split')}
				>
					R/W Split {sortIcon('split')}
				</th>
			</tr>
		</thead>
		<tbody>
			{#each sorted as row, i}
				{@const isTop3 = top3Sources.includes(row.source)}
				<tr
					class="border-b border-border-light/50 transition-colors
					{i % 2 === 0 ? 'bg-background-primary-light' : 'bg-background-secondary-light/40'}
					{isTop3 ? 'ring-1 ring-inset ring-background-tertiary-light/20' : ''}
					hover:bg-background-secondary-light"
				>
					<td class="px-4 py-2.5">
						<span class="font-medium text-text-primary-light">{formatSourceName(row.source)}</span>
						{#if isTop3}
							<span
								class="ml-2 inline-block rounded-full bg-background-tertiary-light/15 px-1.5 py-0.5 text-xs font-medium text-background-tertiary-light"
								>Top</span
							>
						{/if}
					</td>
					<td class="px-4 py-2.5 text-right font-semibold text-text-primary-light">
						{row.stockedCount}
					</td>
					<td class="px-4 py-2.5 text-right text-text-secondary-light">
						{row.origins}
					</td>
					<td class="px-4 py-2.5 text-right font-medium text-text-primary-light">
						${row.avgCostLb.toFixed(2)}
					</td>
					<td class="hidden px-4 py-2.5 text-right text-text-secondary-light sm:table-cell">
						${row.minCostLb.toFixed(2)} – ${row.maxCostLb.toFixed(2)}
					</td>
					<td class="px-4 py-2.5 text-right text-text-secondary-light">
						{row.retailCount}R / {row.wholesaleCount}W
					</td>
				</tr>
			{/each}
		</tbody>
		<tfoot>
			<tr class="border-t-2 border-border-light bg-background-secondary-light font-semibold">
				<td class="px-4 py-3 text-text-primary-light">
					{rows.length} suppliers
				</td>
				<td class="px-4 py-3 text-right text-text-primary-light">
					{totalStocked.toLocaleString()} total
				</td>
				<td class="px-4 py-3 text-right text-text-secondary-light">—</td>
				<td class="px-4 py-3 text-right text-text-primary-light">
					${overallAvg.toFixed(2)} avg
				</td>
				<td class="hidden px-4 py-3 text-right text-text-secondary-light sm:table-cell">—</td>
				<td class="px-4 py-3 text-right text-text-secondary-light">
					{totalRetail}R / {totalWholesale}W
				</td>
			</tr>
		</tfoot>
	</table>
</div>
