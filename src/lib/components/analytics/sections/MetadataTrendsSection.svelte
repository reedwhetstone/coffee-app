<script lang="ts">
	import AnalyticsSectionHeader from '$lib/components/analytics/sections/AnalyticsSectionHeader.svelte';
	import CompositionTrendChart from '$lib/components/analytics/CompositionTrendChart.svelte';
	import {
		CHART_SERIES,
		DISCLOSURE_COLORS,
		DISCLOSURE_LABELS,
		NEUTRAL_CATEGORY_COLOR,
		PROCESS_COLORS
	} from '$lib/styles/chartColors';
	import type { MetadataSeriesItem } from '$lib/types/marketIndex.types';

	type ViewMode = 'retail' | 'wholesale' | 'all';

	interface Props {
		processSeries: MetadataSeriesItem[] | null;
		disclosureSeries: MetadataSeriesItem[] | null;
		viewMode: ViewMode;
		isParchmentIntelligence: boolean;
	}

	let { processSeries, disclosureSeries, viewMode, isParchmentIntelligence }: Props = $props();

	// The metadata index is served from the retail market slice only; wholesale and
	// combined trends require expanded coverage that is not fetched here. When the
	// page scope is not retail, say so plainly instead of implying these charts
	// followed the scope toggle.
	let retailScopeNote = $derived(
		viewMode === 'retail'
			? null
			: 'Metadata trends reflect the retail market and do not change with the selected scope.'
	);

	const processFallback = new Map<string, string>();
	function processColor(key: string): string {
		if (key === 'undisclosed') return NEUTRAL_CATEGORY_COLOR;
		if (PROCESS_COLORS[key]) return PROCESS_COLORS[key];
		if (!processFallback.has(key)) {
			processFallback.set(key, CHART_SERIES[processFallback.size % CHART_SERIES.length]);
		}
		return processFallback.get(key) as string;
	}

	function disclosureColor(key: string): string {
		return DISCLOSURE_COLORS[key] ?? NEUTRAL_CATEGORY_COLOR;
	}

	function disclosureLabel(key: string): string {
		return DISCLOSURE_LABELS[key] ?? key;
	}

	let hasAnySeries = $derived(Boolean(processSeries?.length || disclosureSeries?.length));
</script>

{#if hasAnySeries}
	<AnalyticsSectionHeader
		title="How is the market changing?"
		description="The metadata index: what the market is offering and disclosing over time — not just what it costs."
	/>

	{#if retailScopeNote}
		<p class="mb-4 text-sm text-muted" aria-label="Metadata scope note">
			{retailScopeNote}
		</p>
	{/if}

	<section class="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2" aria-label="Metadata trends">
		{#if processSeries && processSeries.length > 0}
			<div class="rounded-lg border border-line bg-surface-canvas p-6 shadow-sm">
				<h3 class="text-base font-semibold text-ink">How is processing changing?</h3>
				<p class="mb-4 mt-1 text-sm text-muted">
					Share of stocked retail supply by processing method, month over month.
				</p>
				<CompositionTrendChart series={processSeries} colorFor={processColor} />
			</div>
		{/if}

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
		{:else}
			<div
				class="rounded-lg border border-line bg-surface-panel p-6"
				aria-label="Gated metadata trends"
			>
				<div class="flex h-full flex-col items-start justify-between gap-4">
					<div>
						<h3 class="font-serif text-lg font-medium text-ink">
							The transparency trend runs deeper.
						</h3>
						<p class="mt-1 text-sm text-muted">
							Parchment Intelligence adds the disclosure-level trend and origin-level metadata
							composition over time.
						</p>
					</div>
					<a
						href="/subscription?plan=intelligence-monthly&intent=checkout"
						class="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-ink transition-all duration-200 hover:bg-accent/85"
					>
						Start Intelligence
					</a>
				</div>
			</div>
		{/if}
	</section>
{/if}
