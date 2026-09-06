<script lang="ts">
	let { origins, viewMode }: { origins: string[]; viewMode: 'retail' | 'wholesale' | 'all' } =
		$props();
	let origin = $state('');
	let from = $state(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
	let to = $state(new Date(Date.now() - 86400000).toISOString().slice(0, 10));
	let loading = $state(false);
	let message = $state('');
	async function compare() {
		loading = true;
		message = '';
		try {
			const query = new URLSearchParams({
				from,
				to,
				origin: origin || origins[0] || '',
				wholesale: String(viewMode === 'wholesale')
			});
			const comparisonLabel = `${query.get('origin')} ${query.get('wholesale') === 'true' ? 'wholesale' : 'retail'}, ${from} to ${to}: `;
			const response = await fetch(`/api/analytics/price-comparison?${query}`);
			if (!response.ok) throw new Error('unavailable');
			const result = await response.json();
			message =
				comparisonLabel +
				(result.status === 'available' && typeof result.changePercent === 'number'
					? `${result.changePercent > 0 ? '+' : ''}${result.changePercent.toFixed(2)}% across ${result.sample.matchedListings} matched listings from ${result.sample.matchedSuppliers} suppliers (${(result.sample.matchedCoverage * 100).toFixed(0)}% matched coverage).`
					: 'Insufficient fresh matched coverage for these dates. No price movement estimate is available.');
		} catch {
			message =
				'Price comparison is currently unavailable. Catalog price history remains available.';
		} finally {
			loading = false;
		}
	}
</script>

<section
	class="mb-6 rounded-lg border border-line bg-surface-canvas p-6"
	aria-label="Matched price movement"
>
	<h2 class="mb-1 text-base font-semibold text-ink">Matched price movement</h2>
	<p class="mb-4 text-sm text-muted">
		Compare the same fresh-priced listings, with equal weight per supplier. New listings and
		supplier mix changes are not repricing. This is an observed comparison, not a continuous market
		index.
	</p>
	{#if viewMode === 'all'}
		<p class="text-sm text-muted">Select retail or wholesale to compare a consistent market.</p>
	{:else}
		<form
			class="flex flex-wrap items-end gap-3"
			onsubmit={(event) => {
				event.preventDefault();
				compare();
			}}
		>
			<label class="text-sm"
				>Origin<select
					class="block rounded border border-line bg-surface-panel p-2"
					bind:value={origin}
					required
					><option value="" disabled>Select origin</option>{#each origins as item}<option
							value={item}>{item}</option
						>{/each}</select
				></label
			>
			<label class="text-sm"
				>From<input
					class="block rounded border border-line bg-surface-panel p-2"
					type="date"
					bind:value={from}
					required
				/></label
			>
			<label class="text-sm"
				>To<input
					class="block rounded border border-line bg-surface-panel p-2"
					type="date"
					bind:value={to}
					required
				/></label
			>
			<button class="rounded bg-accent px-4 py-2 text-sm text-ink" disabled={loading}
				>{loading ? 'Comparing…' : 'Compare prices'}</button
			>
		</form>
	{/if}
	<p class="mt-3 text-sm text-muted" role="status">{message}</p>
</section>
