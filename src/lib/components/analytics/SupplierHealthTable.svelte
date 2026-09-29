<script lang="ts">
	import { formatSourceName } from '$lib/utils/formatters';

	export interface SupplierRow {
		source: string;
		stockedCount: number;
		origins: number;
		/** Retail price fields; null when the supplier has no priced retail lots. */
		avgCostLb: number | null;
		minCostLb: number | null;
		maxCostLb: number | null;
		wholesaleCount: number;
		retailCount: number;
	}

	let {
		rows = [],
		market = 'all'
	}: { rows: SupplierRow[]; market?: 'retail' | 'wholesale' | 'all' } = $props();

	/** Stocked lots in the selected scope, so the retail view never counts wholesale lots. */
	function scopedCount(row: SupplierRow): number {
		if (market === 'retail') return row.retailCount;
		if (market === 'wholesale') return row.wholesaleCount;
		return row.stockedCount;
	}

	function priceRange(row: SupplierRow): number | null {
		return row.minCostLb == null || row.maxCostLb == null ? null : row.maxCostLb - row.minCostLb;
	}

	/** Missing prices always sort last, whichever direction is selected. */
	function compareNullable(a: number | null, b: number | null): number | null {
		if (a == null && b == null) return 0;
		if (a == null) return null;
		if (b == null) return null;
		return a - b;
	}

	type SortKey = 'source' | 'stockedCount' | 'origins' | 'avgCostLb' | 'priceRange' | 'split';
	let sortKey = $state<SortKey>('stockedCount');
	let sortAsc = $state(false);

	let sorted = $derived.by(() => {
		const copy = [...rows];
		copy.sort((a, b) => {
			let cmp = 0;
			if (sortKey === 'avgCostLb' || sortKey === 'priceRange') {
				const left = sortKey === 'avgCostLb' ? a.avgCostLb : priceRange(a);
				const right = sortKey === 'avgCostLb' ? b.avgCostLb : priceRange(b);
				const result = compareNullable(left, right);
				if (result === null) return left == null ? 1 : -1;
				return sortAsc ? result : -result;
			}
			switch (sortKey) {
				case 'source':
					cmp = formatSourceName(a.source).localeCompare(formatSourceName(b.source));
					break;
				case 'stockedCount':
					cmp = scopedCount(a) - scopedCount(b);
					break;
				case 'origins':
					cmp = a.origins - b.origins;
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

	let totalStocked = $derived(rows.reduce((s, r) => s + scopedCount(r), 0));
	let totalRetail = $derived(rows.reduce((s, r) => s + r.retailCount, 0));
	let totalWholesale = $derived(rows.reduce((s, r) => s + r.wholesaleCount, 0));

	// Retail average weighted by priced retail lots; unpriced suppliers are excluded.
	let overallAvg = $derived.by(() => {
		const priced = rows.filter((r) => r.avgCostLb != null && r.retailCount > 0);
		const weight = priced.reduce((s, r) => s + r.retailCount, 0);
		if (weight === 0) return null;
		return priced.reduce((s, r) => s + (r.avgCostLb ?? 0) * r.retailCount, 0) / weight;
	});

	function money(value: number | null): string {
		return value == null ? '—' : `$${value.toFixed(2)}`;
	}
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
					Retail avg $/lb
					<span class="sr-only">{sortLabel('avgCostLb')}</span>
				</th>
				<th
					class="hidden cursor-pointer select-none py-2 pr-4 text-right font-semibold text-muted hover:text-ink sm:table-cell"
					onclick={() => setSort('priceRange')}
					aria-sort={sortKey === 'priceRange' ? (sortAsc ? 'ascending' : 'descending') : 'none'}
				>
					Retail range
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
						{scopedCount(row)}
					</td>
					<td class="py-2 pr-4 text-right text-muted">
						{row.origins}
					</td>
					<td class="py-2 pr-4 text-right font-medium text-ink">
						{money(row.avgCostLb)}
					</td>
					<td class="hidden py-2 pr-4 text-right text-muted sm:table-cell">
						{#if row.minCostLb == null || row.maxCostLb == null}
							—
						{:else}
							{money(row.minCostLb)} – {money(row.maxCostLb)}
						{/if}
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
					{overallAvg == null ? '—' : `${money(overallAvg)} avg`}
				</td>
				<td class="hidden py-3 pr-4 text-right text-muted sm:table-cell">—</td>
				<td class="py-3 text-right text-muted">
					{totalRetail} / {totalWholesale}
				</td>
			</tr>
		</tfoot>
	</table>
</div>
