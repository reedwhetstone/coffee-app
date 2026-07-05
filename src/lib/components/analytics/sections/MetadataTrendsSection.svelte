<script lang="ts">
	import AnalyticsSectionHeader from '$lib/components/analytics/sections/AnalyticsSectionHeader.svelte';
	import CompositionTrendChart from '$lib/components/analytics/CompositionTrendChart.svelte';
	import ScoreBandChart from '$lib/components/analytics/ScoreBandChart.svelte';
	import {
		CHART_SERIES,
		DISCLOSURE_COLORS,
		DISCLOSURE_LABELS,
		PROCESS_COLORS
	} from '$lib/styles/chartColors';
	import type { MetadataSeriesItem } from '$lib/types/marketIndex.types';

	interface Props {
		processSeries: MetadataSeriesItem[] | null;
		disclosureSeries: MetadataSeriesItem[] | null;
		scoreSeries: MetadataSeriesItem[] | null;
		isParchmentIntelligence: boolean;
	}

	let { processSeries, disclosureSeries, scoreSeries, isParchmentIntelligence }: Props = $props();

	const processFallback = new Map<string, string>();
	function processColor(key: string): string {
		if (key === 'undisclosed') return '#A8A29E';
		if (PROCESS_COLORS[key]) return PROCESS_COLORS[key];
		if (!processFallback.has(key)) {
			processFallback.set(key, CHART_SERIES[processFallback.size % CHART_SERIES.length]);
		}
		return processFallback.get(key) as string;
	}

	function disclosureColor(key: string): string {
		return DISCLOSURE_COLORS[key] ?? '#A8A29E';
	}

	function disclosureLabel(key: string): string {
		return DISCLOSURE_LABELS[key] ?? key;
	}

	let hasAnySeries = $derived(
		Boolean(processSeries?.length || disclosureSeries?.length || scoreSeries?.length)
	);
</script>

{#if hasAnySeries}
	<AnalyticsSectionHeader
		title="How is the market changing?"
		description="The metadata index: what the market is offering and disclosing over time — not just what it costs."
	/>

	<section class="mb-6 space-y-6" aria-label="Metadata trends">
		{#if processSeries && processSeries.length > 0}
			<div class="rounded-lg border border-line bg-surface-canvas p-6 shadow-sm">
				<h3 class="text-base font-semibold text-ink">How is processing changing?</h3>
				<p class="mb-4 mt-1 text-sm text-muted">
					Share of stocked retail supply by processing method, month over month.
				</p>
				<CompositionTrendChart series={processSeries} colorFor={processColor} />
			</div>
		{/if}

		<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
			{#if isParchmentIntelligence}
				{#if disclosureSeries && disclosureSeries.length > 0}
					<div class="rounded-lg border border-line bg-surface-canvas p-6 shadow-sm">
						<h3 class="text-base font-semibold text-ink">Is the market disclosing more?</h3>
						<p class="mb-4 mt-1 text-sm text-muted">
							Processing disclosure levels across stocked supply — the transparency trend.
						</p>
						<CompositionTrendChart
							series={disclosureSeries}
							colorFor={disclosureColor}
							labelFor={disclosureLabel}
						/>
					</div>
				{/if}
				{#if scoreSeries && scoreSeries.length > 0}
					<div class="rounded-lg border border-line bg-surface-canvas p-6 shadow-sm">
						<h3 class="text-base font-semibold text-ink">How is quality shifting?</h3>
						<p class="mb-4 mt-1 text-sm text-muted">
							Cup-score distribution of stocked supply over time.
						</p>
						<ScoreBandChart series={scoreSeries} />
					</div>
				{/if}
			{:else}
				<div
					class="rounded-lg border border-line bg-surface-panel p-6 lg:col-span-2"
					aria-label="Gated metadata trends"
				>
					<div class="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
						<div>
							<h3 class="font-serif text-lg font-medium text-ink">
								Disclosure and quality trends run deeper.
							</h3>
							<p class="mt-1 text-sm text-muted">
								Parchment Intelligence adds the transparency trend, origin-level metadata
								composition, and cup-score distribution over time.
							</p>
						</div>
						<a
							href="/subscription?plan=intelligence-monthly&intent=checkout"
							class="shrink-0 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-ink transition-all duration-200 hover:bg-accent/85"
						>
							Start Intelligence
						</a>
					</div>
				</div>
			{/if}
		</div>
	</section>
{/if}
