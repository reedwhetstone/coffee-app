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

	function sortLabel(key: SortKey): string {
		if (sortKey !== key) return 'not sorted';
		return sortAsc ? 'sorted ascending' : 'sorted descending';
	}

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

<div class="overflow-x-auto">
	<table class="min-w-full text-sm">
		<thead>
			<tr class="border-b border-line">
				<th
					class="cursor-pointer select-none py-2 pr-4 text-left font-semibold text-muted hover:text-ink"
					onclick={() => setSort('source')}
					aria-sort={sortKey === 'source' ? (sortAsc ? 'ascending' : 'descending') : 'none'}
				>
					Supplier
					<span class="sr-only">{sortLabel('source')}</span>
				</th>
				<th
					class="cursor-pointer select-none py-2 pr-4 text-right font-semibold text-muted hover:text-ink"
					onclick={() => setSort('stockedCount')}
					aria-sort={sortKey === 'stockedCount' ? (sortAsc ? 'ascending' : 'descending') : 'none'}
				>
					Stocked
					<span class="sr-only">{sortLabel('stockedCount')}</span>
				</th>
				<th
					class="cursor-pointer select-none py-2 pr-4 text-right font-semibold text-muted hover:text-ink"
					onclick={() => setSort('origins')}
					aria-sort={sortKey === 'origins' ? (sortAsc ? 'ascending' : 'descending') : 'none'}
				>
					Origins
					<span class="sr-only">{sortLabel('origins')}</span>
				</th>
				<th
					class="cursor-pointer select-none py-2 pr-4 text-right font-semibold text-muted hover:text-ink"
					onclick={() => setSort('avgCostLb')}
					aria-sort={sortKey === 'avgCostLb' ? (sortAsc ? 'ascending' : 'descending') : 'none'}
				>
					Avg $/lb
					<span class="sr-only">{sortLabel('avgCostLb')}</span>
				</th>
				<th
					class="hidden cursor-pointer select-none py-2 pr-4 text-right font-semibold text-muted hover:text-ink sm:table-cell"
					onclick={() => setSort('priceRange')}
					aria-sort={sortKey === 'priceRange' ? (sortAsc ? 'ascending' : 'descending') : 'none'}
				>
					Price range
					<span class="sr-only">{sortLabel('priceRange')}</span>
				</th>
				<th
					class="cursor-pointer select-none py-2 text-right font-semibold text-muted hover:text-ink"
					onclick={() => setSort('split')}
					aria-sort={sortKey === 'split' ? (sortAsc ? 'ascending' : 'descending') : 'none'}
				>
					Retail / wholesale
					<span class="sr-only">{sortLabel('split')}</span>
				</th>
			</tr>
		</thead>
		<tbody>
			{#each sorted as row, i}
				<tr
					class="border-b border-line/50 transition-colors
					{i % 2 === 0 ? 'bg-surface-canvas' : 'bg-surface-panel/40'}
					hover:bg-surface-panel"
				>
					<td class="py-2 pr-4">
						<span class="font-medium text-ink">{formatSourceName(row.source)}</span>
					</td>
					<td class="py-2 pr-4 text-right font-semibold text-ink">
						{row.stockedCount}
					</td>
					<td class="py-2 pr-4 text-right text-muted">
						{row.origins}
					</td>
					<td class="py-2 pr-4 text-right font-medium text-ink">
						${row.avgCostLb.toFixed(2)}
					</td>
					<td class="hidden py-2 pr-4 text-right text-muted sm:table-cell">
						${row.minCostLb.toFixed(2)} – ${row.maxCostLb.toFixed(2)}
					</td>
					<td class="py-2 text-right text-muted">
						{row.retailCount} / {row.wholesaleCount}
					</td>
				</tr>
			{/each}
		</tbody>
		<tfoot>
			<tr class="border-t border-line bg-surface-panel/50 font-semibold">
				<td class="py-3 pr-4 text-ink">
					{rows.length} suppliers
				</td>
				<td class="py-3 pr-4 text-right text-ink">
					{totalStocked.toLocaleString()} total
				</td>
				<td class="py-3 pr-4 text-right text-muted">—</td>
				<td class="py-3 pr-4 text-right text-ink">
					${overallAvg.toFixed(2)} avg
				</td>
				<td class="hidden py-3 pr-4 text-right text-muted sm:table-cell">—</td>
				<td class="py-3 text-right text-muted">
					{totalRetail} / {totalWholesale}
				</td>
			</tr>
		</tfoot>
	</table>
</div>
