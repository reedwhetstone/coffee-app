<script lang="ts">
	import { formatSourceName } from '$lib/utils/formatters';
	import type { CatalogComparison, ComparisonLot, ComparisonRow } from '$lib/catalog/compareTypes';

	let {
		comparison,
		quantityOptions,
		onQuantityChange,
		onRemove
	}: {
		comparison: CatalogComparison;
		quantityOptions: number[];
		onQuantityChange: (quantityLbs: number) => void;
		onRemove: (id: number) => void;
	} = $props();

	let showDifferencesOnly = $state(false);
	let baselineId = $state<number | null>(null);

	let lots = $derived(comparison.lots);
	let differenceCount = $derived(comparison.rows.filter((row) => row.relation !== 'same').length);

	const PRICE_KEYS = new Set(['price_at_quantity', 'smallest_tier_price']);
	// Rows Purveyors derives rather than reads from the listing (Parchment rowSpecs);
	// a null means the derived value is missing, not that the supplier withheld it.
	const DERIVED_UNAVAILABLE: Record<string, string> = {
		vs_origin_median: 'Benchmark unavailable',
		disclosure: 'Not assessed',
		purveyor_score: 'Not scored'
	};

	function unavailableLabel(key: string): string {
		if (key.startsWith('taste_')) return 'Not rated';
		return DERIVED_UNAVAILABLE[key] ?? 'Not disclosed';
	}

	// A shared link can carry any positive quantity; keep it selectable.
	let pickerOptions = $derived(
		[...new Set([...quantityOptions, comparison.quantityLbs])].sort((a, b) => a - b)
	);
	const GROUP_ORDER: ComparisonRow['group'][] = [
		'Price',
		'Availability',
		'Origin',
		'Process',
		'Coffee',
		'Grading',
		'Taste',
		'Listing'
	];

	// A group Parchment adds later is drawn after the known ones instead of being dropped.
	let groupOrder = $derived([
		...GROUP_ORDER,
		...new Set(
			comparison.rows.map((row) => row.group).filter((group) => !GROUP_ORDER.includes(group))
		)
	]);

	let groups = $derived(
		groupOrder
			.map((group) => ({
				group,
				rows: comparison.rows.filter(
					(row) => row.group === group && (!showDifferencesOnly || row.relation !== 'same')
				)
			}))
			.filter((entry) => entry.rows.length > 0)
	);

	function money(value: number): string {
		return `$${value.toFixed(2)}/lb`;
	}

	function display(row: ComparisonRow, value: string | number | null, lot: ComparisonLot): string {
		if (value === null) {
			if (row.key === 'price_at_quantity' && lot.price.minOrderLbs) {
				return `Minimum order ${lot.price.minOrderLbs} lb`;
			}
			return unavailableLabel(row.key);
		}
		if (typeof value === 'number') {
			if (PRICE_KEYS.has(row.key)) return money(value);
			if (row.key === 'vs_origin_median') return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
			if (row.key === 'min_order') return `${value} lb`;
			return String(value);
		}
		return row.key === 'source' ? formatSourceName(value) : value;
	}

	function baselineDelta(row: ComparisonRow, index: number): string | null {
		if (baselineId === null || !PRICE_KEYS.has(row.key)) return null;
		const baseIndex = lots.findIndex((lot) => lot.id === baselineId);
		if (baseIndex < 0 || baseIndex === index) return null;
		const base = row.values[baseIndex];
		const value = row.values[index];
		if (typeof base !== 'number' || typeof value !== 'number' || base === 0) return null;
		const delta = value - base;
		if (Math.abs(delta) < 0.005) return 'Same as baseline';
		const sign = delta > 0 ? '+' : '−';
		return `${sign}$${Math.abs(delta).toFixed(2)} (${sign}${Math.abs((delta / base) * 100).toFixed(1)}%) vs baseline`;
	}
</script>

<div class="space-y-4">
	<div class="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
		<label class="flex items-center gap-2 text-muted">
			Price at
			<select
				class="rounded-md border border-line bg-surface-panel px-2 py-1 text-ink"
				value={comparison.quantityLbs}
				onchange={(event) => onQuantityChange(Number(event.currentTarget.value))}
			>
				{#each pickerOptions as option (option)}
					<option value={option}>{option} lb</option>
				{/each}
			</select>
		</label>
		<label class="flex items-center gap-2 text-muted">
			<input type="checkbox" bind:checked={showDifferencesOnly} />
			Show differences only
		</label>
		<p class="text-muted">
			{differenceCount} of {comparison.rows.length} facts differ
		</p>
	</div>

	<div class="overflow-x-auto rounded-lg border border-line bg-surface-canvas">
		<table class="w-full min-w-[40rem] border-collapse text-sm" aria-label="Coffee comparison">
			<thead>
				<tr class="border-b border-line align-top">
					<th
						scope="col"
						class="sticky left-0 z-10 w-44 bg-surface-canvas p-3 text-left text-xs font-medium text-muted"
					>
						{lots.length} coffees
					</th>
					{#each lots as lot (lot.id)}
						<th scope="col" class="min-w-[12rem] p-3 text-left font-normal">
							<a
								href={`/catalog?coffee=${lot.id}`}
								class="block font-semibold leading-snug text-ink hover:text-accent">{lot.name}</a
							>
							<p class="mt-0.5 text-xs text-muted">
								{formatSourceName(lot.source ?? '') || 'Supplier undisclosed'}
							</p>
							<div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
								{#if comparison.bestPriceLotIds.includes(lot.id)}
									<span
										class="rounded-full bg-success-subtle px-2 py-0.5 font-semibold text-success-strong"
										>Lowest at {comparison.quantityLbs} lb</span
									>
								{/if}
								<button
									type="button"
									class="rounded px-1.5 py-0.5 ring-1 {baselineId === lot.id
										? 'bg-accent-subtle/25 text-ink ring-accent/40'
										: 'text-muted ring-line hover:text-ink'}"
									aria-pressed={baselineId === lot.id}
									onclick={() => (baselineId = baselineId === lot.id ? null : lot.id)}
								>
									{baselineId === lot.id ? 'Baseline' : 'Set as baseline'}
								</button>
								<button
									type="button"
									class="text-muted hover:text-ink"
									aria-label={`Remove ${lot.name} from comparison`}
									onclick={() => onRemove(lot.id)}>Remove</button
								>
							</div>
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each groups as entry (entry.group)}
					<tr class="bg-surface-panel">
						<th
							scope="colgroup"
							colspan={lots.length + 1}
							class="sticky left-0 px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-muted"
						>
							{entry.group}
						</th>
					</tr>
					{#each entry.rows as row (row.key)}
						<tr class="border-t border-line/60 align-top" data-relation={row.relation}>
							<th
								scope="row"
								class="sticky left-0 z-10 bg-surface-canvas p-3 text-left text-xs font-medium {row.relation ===
								'same'
									? 'text-muted'
									: 'border-l-2 border-accent text-ink'}"
							>
								{row.label}
							</th>
							{#if row.relation === 'same'}
								<td colspan={lots.length} class="p-3 text-muted">
									{display(row, row.values[0] ?? null, lots[0] as ComparisonLot)}
									<span class="ml-2 text-xs">Same for all</span>
								</td>
							{:else}
								{#each lots as lot, index (lot.id)}
									{@const value = row.values[index] ?? null}
									{@const best = row.bestLotIds.includes(lot.id)}
									{@const delta = baselineDelta(row, index)}
									<td class="p-3 {value === null ? 'italic text-muted' : 'text-ink'}">
										<span
											class={best
												? 'rounded bg-success-subtle px-1.5 py-0.5 font-semibold text-success-strong'
												: PRICE_KEYS.has(row.key)
													? 'font-semibold tabular-nums'
													: ''}>{display(row, value, lot)}</span
										>
										{#if best}
											<span class="ml-1 text-xs font-semibold text-success-strong">Lowest</span>
										{/if}
										{#if delta}
											<p class="mt-1 text-xs not-italic text-muted">{delta}</p>
										{/if}
									</td>
								{/each}
							{/if}
						</tr>
					{/each}
				{/each}
			</tbody>
		</table>
	</div>
	<p class="text-xs text-muted">
		Prices are per pound at the tier that applies to the selected quantity. Purveyor Score measures
		how complete a listing is, not cup quality. "Not disclosed" means the supplier does not list it;
		"Benchmark unavailable" means there is no origin median to compare against. "Not assessed", "Not
		rated", and "Not scored" mean Purveyors has not derived that value for the listing yet.
	</p>
</div>
