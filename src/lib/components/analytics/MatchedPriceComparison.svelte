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

	/** Moves smaller than this stay in the detail list instead of the headline strip. */
	const NOTABLE_MOVE_PCT = 2;

	function formatChange(value: number): string {
		return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
	}

	function label(comparison: { origin: string; wholesale: boolean }): string {
		return viewMode === 'all'
			? `${comparison.origin} (${comparison.wholesale ? 'Wholesale' : 'Retail'})`
			: comparison.origin;
	}

	let result = $state<ComparisonResponse | null>(null);
	let loading = $state(true);
	let failed = $state(false);
	let retry = $state(0);

	let byMagnitude = $derived(
		[...(result?.comparisons ?? [])].sort(
			(a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent)
		)
	);
	let notable = $derived(
		byMagnitude.filter((row) => Math.abs(row.changePercent) >= NOTABLE_MOVE_PCT)
	);
	let quietCount = $derived(byMagnitude.length - notable.length);

	$effect(() => {
		const market = viewMode;
		void retry;
		const controller = new AbortController();
		let active = true;
		result = null;
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
	class="mb-6 rounded-lg border border-line bg-surface-canvas px-4 py-3"
	aria-label="Price changes"
	aria-busy={loading}
>
	<div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
		<h2 class="shrink-0 font-semibold text-ink">
			Same-coffee prices <span class="font-normal text-muted">· 30 days</span>
		</h2>
		{#if loading}
			<p class="text-muted" role="status">Loading price changes…</p>
		{:else if failed}
			<p class="text-muted" role="alert">We couldn’t load price changes.</p>
			<button class="rounded border border-line px-2 py-1 text-ink" onclick={() => (retry += 1)}
				>Try again</button
			>
		{:else if !result?.comparisons.length}
			<p class="text-muted" role="status">
				No 30-day price comparisons available for this market yet.
			</p>
		{:else if notable.length === 0}
			<p class="text-muted" role="status">
				No origin moved {NOTABLE_MOVE_PCT}% or more on like-for-like prices. Largest move:
				<span class="font-semibold tabular-nums text-ink"
					>{label(byMagnitude[0])} {formatChange(byMagnitude[0].changePercent)}</span
				>.
			</p>
		{:else}
			<ul class="flex flex-wrap items-center gap-x-5 gap-y-2" aria-label="30-day price signals">
				{#each notable as comparison (comparison.origin + comparison.wholesale)}
					<li class="flex items-baseline gap-2">
						<span class="text-muted">{label(comparison)}</span>
						<span class="font-semibold tabular-nums text-ink"
							>{formatChange(comparison.changePercent)}</span
						>
					</li>
				{/each}
			</ul>
			{#if quietCount > 0}
				<p class="text-muted">
					{quietCount}
					{quietCount === 1 ? 'other origin' : 'other origins'} moved less than {NOTABLE_MOVE_PCT}%.
				</p>
			{/if}
		{/if}
	</div>
	{#if !loading && !failed && result?.comparisons.length}
		<details class="mt-2 text-xs text-muted">
			<summary
				class="w-fit cursor-pointer rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
				>All origins, dates &amp; coverage</summary
			>
			<p class="mt-2">30-day change · {result.from} to {result.to}</p>
			<p class="mt-1">Price changes in the same coffees, with equal weight per supplier.</p>
			<ul class="mt-2 space-y-1">
				{#each byMagnitude as comparison (comparison.origin + comparison.wholesale)}
					<li>
						<span class="font-medium text-ink"
							>{comparison.origin} · {comparison.wholesale ? 'Wholesale' : 'Retail'}:</span
						>
						{formatChange(comparison.changePercent)} ·
						{comparison.sample.matchedListings} of {comparison.sample.fromListings} starting coffees
						matched ({(comparison.sample.matchedCoverage * 100).toFixed(0)}%) · {comparison.sample
							.matchedSuppliers} suppliers
					</li>
				{/each}
			</ul>
		</details>
	{/if}
</section>
