<script lang="ts">
	import { z } from 'zod';

	const count = z.number().int().nonnegative();
	const date = z.iso.date();
	const comparisonSchema = z.object({
		from: date,
		to: date,
		origin: z.string().min(1),
		wholesale: z.boolean(),
		status: z.literal('available'),
		changePercent: z.number(),
		sample: z.object({
			fromListings: count,
			toListings: count,
			matchedListings: count,
			matchedSuppliers: count,
			matchedCoverage: z.number().min(0).max(1)
		}),
		methodology: z.literal('matched-supplier-median-log-v1'),
		canonicalPublication: z.literal(false)
	});
	const responseSchema = z
		.object({
			windowDays: z.literal(30),
			from: date.nullable(),
			to: date.nullable(),
			comparisons: z.array(comparisonSchema)
		})
		.refine((result) => {
			if (result.from === null || result.to === null) {
				return result.from === null && result.to === null && result.comparisons.length === 0;
			}
			return (
				Date.parse(result.to) - Date.parse(result.from) === 30 * 86400000 &&
				result.comparisons.every((row) => row.from === result.from && row.to === result.to)
			);
		});
	type ComparisonResponse = z.infer<typeof responseSchema>;
	let { viewMode }: { viewMode: 'retail' | 'wholesale' | 'all' } = $props();
	let result = $state<ComparisonResponse | null>(null);
	let origin = $state('');
	let loading = $state(true);
	let failed = $state(false);
	let retry = $state(0);
	const origins = $derived([...new Set(result?.comparisons.map((row) => row.origin) ?? [])]);
	const selected = $derived(result?.comparisons.filter((row) => row.origin === origin) ?? []);

	$effect(() => {
		const market = viewMode;
		void retry;
		const controller = new AbortController();
		let active = true;
		result = null;
		origin = '';
		loading = true;
		failed = false;
		async function load() {
			try {
				const wholesale = market === 'all' ? 'all' : String(market === 'wholesale');
				const response = await fetch(`/api/analytics/price-comparisons?wholesale=${wholesale}`, {
					signal: controller.signal
				});
				if (!response.ok) throw new Error('unavailable');
				const payload = responseSchema.parse(await response.json());
				if (
					market !== 'all' &&
					payload.comparisons.some((row) => row.wholesale !== (market === 'wholesale'))
				) {
					throw new Error('market mismatch');
				}
				if (!active) return;
				result = payload;
				origin = payload.comparisons[0]?.origin ?? '';
			} catch {
				if (active) failed = true;
			} finally {
				if (active) loading = false;
			}
		}
		void load();
		return () => {
			active = false;
			controller.abort();
		};
	});
</script>

<section
	class="mb-6 rounded-lg border border-line bg-surface-canvas p-6"
	aria-label="Price changes"
	aria-busy={loading}
>
	<h2 class="mb-1 text-base font-semibold text-ink">Price changes</h2>
	<p class="mb-4 text-sm text-muted">
		See whether the same coffees are getting more or less expensive.
	</p>
	{#if loading}
		<p class="text-sm text-muted" role="status">Loading 30-day price changes…</p>
	{:else if failed}
		<p class="text-sm text-muted" role="alert">We couldn’t load price changes. Please try again.</p>
		<button
			class="mt-3 rounded border border-line px-4 py-2 text-sm text-ink"
			onclick={() => (retry += 1)}>Try again</button
		>
	{:else if !result?.comparisons.length}
		<p class="text-sm text-muted" role="status">
			No 30-day price comparisons are available for this market. There aren’t enough matching price
			observations to show a change.
		</p>
	{:else}
		<p class="mb-4 text-sm text-muted">30-day change · {result.from} to {result.to}</p>
		{#if origins.length > 1}
			<label class="mb-4 block text-sm text-ink"
				>Origin
				<select
					class="mt-1 block rounded border border-line bg-surface-panel p-2"
					value={origin}
					onchange={(event) => (origin = event.currentTarget.value)}
				>
					{#each origins as item}<option value={item}>{item}</option>{/each}
				</select>
			</label>
		{:else}
			<h3 class="mb-3 text-sm font-semibold text-ink">{origin}</h3>
		{/if}
		<div class="grid gap-4 sm:grid-cols-2" role="status">
			{#each selected as comparison}
				<div class="rounded border border-line p-4">
					<p class="text-sm text-muted">{comparison.wholesale ? 'Wholesale' : 'Retail'}</p>
					<p class="my-1 text-2xl font-semibold text-ink">
						{comparison.changePercent > 0 ? '+' : ''}{comparison.changePercent.toFixed(2)}%
					</p>
					<p class="text-sm text-muted">
						{comparison.sample.matchedListings} coffees · {comparison.sample.matchedSuppliers} suppliers
					</p>
					<p class="text-sm text-muted">
						{comparison.sample.matchedListings} of {comparison.sample.fromListings} starting coffees
						matched ({(comparison.sample.matchedCoverage * 100).toFixed(0)}%)
					</p>
				</div>
			{/each}
		</div>
	{/if}
</section>
