<script lang="ts">
	type ComparisonResult = {
		status?: string;
		changePercent?: number | null;
		sample?: {
			matchedListings?: number;
			matchedSuppliers?: number;
			matchedCoverage?: number;
		};
	};
	type ComparisonResponse = { data?: ComparisonResult };

	let { origins, viewMode }: { origins: string[]; viewMode: 'retail' | 'wholesale' | 'all' } =
		$props();
	let origin = $state('');
	let from = $state(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
	let to = $state(new Date(Date.now() - 86400000).toISOString().slice(0, 10));
	let loading = $state(false);
	let message = $state('');
	let activeAbortController: AbortController | null = null;
	let requestSequence = 0;

	$effect(() => {
		// The page-wide scope is part of the comparison's identity. Invalidate
		// both visible evidence and any response that was started for the old
		// scope before it can repopulate this component.
		const currentViewMode = viewMode;
		void currentViewMode;
		requestSequence += 1;
		activeAbortController?.abort();
		activeAbortController = null;
		loading = false;
		message = '';
	});

	async function compare() {
		const comparisonViewMode = viewMode;
		const requestId = ++requestSequence;
		activeAbortController?.abort();
		const controller = new AbortController();
		activeAbortController = controller;
		loading = true;
		message = '';
		try {
			const query = new URLSearchParams({
				from,
				to,
				origin: origin || origins[0] || '',
				wholesale: String(comparisonViewMode === 'wholesale')
			});
			const comparisonLabel = `${query.get('origin')} ${query.get('wholesale') === 'true' ? 'wholesale' : 'retail'}, ${from} to ${to}: `;
			const response = await fetch(`/api/analytics/price-comparison?${query}`, {
				signal: controller.signal
			});
			if (!response.ok) throw new Error('unavailable');
			const payload = (await response.json()) as ComparisonResponse;
			if (requestId !== requestSequence) return;
			const result = payload.data;
			const sample = result?.sample;
			message =
				comparisonLabel +
				(result?.status === 'available' &&
				typeof result.changePercent === 'number' &&
				typeof sample?.matchedListings === 'number' &&
				typeof sample.matchedSuppliers === 'number' &&
				typeof sample.matchedCoverage === 'number'
					? `${result.changePercent > 0 ? '+' : ''}${result.changePercent.toFixed(2)}% across ${sample.matchedListings} coffees from ${sample.matchedSuppliers} suppliers (${(sample.matchedCoverage * 100).toFixed(0)}% matched coverage).`
					: 'We’re collecting fresh price observations. A comparison will appear once enough coffees have been checked on both dates.');
		} catch {
			if (requestId !== requestSequence) return;
			message =
				'Price comparison is currently unavailable. Catalog price history remains available.';
		} finally {
			if (requestId === requestSequence) {
				loading = false;
				if (activeAbortController === controller) activeAbortController = null;
			}
		}
	}
</script>

<section
	class="mb-6 rounded-lg border border-line bg-surface-canvas p-6"
	aria-label="Price changes"
>
	<h2 class="mb-1 text-base font-semibold text-ink">Price changes</h2>
	<p class="mb-4 text-sm text-muted">
		See whether the same coffees are getting more or less expensive.
	</p>
	{#if viewMode === 'all'}
		<p class="text-sm text-muted">Select retail or wholesale to see price changes.</p>
	{:else}
		<details>
			<summary class="mb-3 cursor-pointer text-sm text-muted">Choose dates and origin</summary>
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
		</details>
	{/if}
	<p class="mt-3 text-sm text-muted" role="status">{message}</p>
</section>
