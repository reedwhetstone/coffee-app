<script lang="ts">
	import AccentSpine from '$lib/components/ui/AccentSpine.svelte';
	import AnalyticsSectionHeader from '$lib/components/analytics/sections/AnalyticsSectionHeader.svelte';
	import type { InsightModuleContract } from '$lib/analytics/insightModules';
	import type { MarketSignalItem, MarketSignalsSummary } from '$lib/types/marketIndex.types';

	type ViewMode = 'retail' | 'wholesale' | 'all';

	interface Props {
		valueSignals: MarketSignalItem[] | null;
		signalsSummary: MarketSignalsSummary | null;
		signalsAsOf: string | null;
		isParchmentIntelligence: boolean;
		isSignedIn: boolean;
		viewMode: ViewMode;
		module?: InsightModuleContract;
	}

	let {
		valueSignals,
		signalsSummary,
		signalsAsOf,
		isParchmentIntelligence,
		isSignedIn,
		viewMode,
		module
	}: Props = $props();

	const SIGNAL_LABELS: Record<MarketSignalItem['signalType'], string> = {
		price_drop: 'Price drop',
		below_market: 'Below market',
		value_quality: 'Value for quality'
	};

	const MAX_CARDS = 6;

	// Teaser total excludes value_quality (not displayed; see scopedSignals note).
	let displayedSummaryTotal = $derived(
		signalsSummary ? signalsSummary.byType.price_drop + signalsSummary.byType.below_market : 0
	);
	let summaryScopeLabel = $derived(signalsSummary?.market === 'retail' ? 'retail' : 'all-market');
	let selectedScopeLabel = $derived(viewMode === 'all' ? 'all-market' : viewMode);

	// value_quality is excluded from display: it ranks on supplier-stated cup
	// scores, which are inconsistent across suppliers and deliberately not
	// surfaced on the front end. It returns once signals rank on the Purveyors
	// Metadata Score instead (parchment-api follow-up).
	let scopedSignals = $derived.by(() => {
		if (!valueSignals) return [];
		const filtered = valueSignals.filter(
			(s) => s.signalType !== 'value_quality' && (viewMode === 'all' || s.market === viewMode)
		);
		return filtered.slice(0, MAX_CARDS);
	});
	let renderedModule = $derived.by(() => {
		if (isParchmentIntelligence && valueSignals !== null && scopedSignals.length === 0) {
			return undefined;
		}
		return module;
	});

	function formatPct(value: number | null): string {
		if (value == null) return '';
		return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
	}

	function formatMoney(value: number | null): string {
		return value == null ? '—' : `$${value.toFixed(2)}/lb`;
	}

	function signalTitle(signal: MarketSignalItem): string {
		if (signal.name) return signal.name;
		const origin = signal.origin ?? 'Unknown origin';
		const process = signal.process === 'undisclosed' ? '' : ` · ${signal.process}`;
		return `${origin}${process}`;
	}

	function evidenceSentence(signal: MarketSignalItem): string {
		const e = signal.evidence;
		const segment = [
			e.segment.origin,
			e.segment.process === 'undisclosed' ? null : e.segment.process
		]
			.filter(Boolean)
			.join(' ');
		if (signal.signalType === 'price_drop') {
			return `${formatPct(e.drop_vs_own_median_pct)} vs its own ${e.own_trailing_window ?? ''} median of ${formatMoney(e.own_trailing_median)}.`;
		}
		if (signal.signalType === 'below_market') {
			return `${formatPct(e.discount_vs_median_pct)} vs the ${segment} median of ${formatMoney(e.segment_median)}${e.price_percentile_in_segment != null ? ` · p${e.price_percentile_in_segment} of segment` : ''}.`;
		}
		return `Scores ${signal.scoreValue ?? '—'} at ${formatMoney(signal.currentPriceLb)} — ${e.value_z_score != null ? `${e.value_z_score.toFixed(1)}σ better` : 'an outlier'} price-for-quality within ${segment || 'its origin'}.`;
	}

	function catalogHref(signal: MarketSignalItem): string {
		try {
			const url = new URL(signal.catalogUrl);
			return `${url.pathname}${url.search}`;
		} catch {
			return '/catalog';
		}
	}

	function formatAsOf(dateStr: string | null): string | null {
		if (!dateStr) return null;
		return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
			month: 'long',
			day: 'numeric'
		});
	}
</script>

{#if valueSignals !== null || signalsSummary !== null}
	<AnalyticsSectionHeader
		title="What should I consider buying?"
		description="Evidence-backed value signals from this morning's market pass: price drops against a lot's own history, and lots priced below their origin and process segment."
		module={renderedModule}
	/>

	{#if isParchmentIntelligence && valueSignals !== null}
		{#if scopedSignals.length > 0}
			<section class="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Value signals">
				{#each scopedSignals as signal (signal.signalType + signal.signalWindow + signal.catalogId + signal.market)}
					<article
						class="relative flex flex-col overflow-hidden rounded-lg border border-line bg-surface-raised p-5 pl-7 shadow-sm"
					>
						<AccentSpine />
						<div class="flex items-center justify-between gap-2">
							<span
								class="rounded-full bg-accent-subtle/15 px-2.5 py-0.5 text-xs font-semibold text-ink ring-1 ring-accent/25"
							>
								{SIGNAL_LABELS[signal.signalType]}
							</span>
							<span class="text-sm font-semibold tabular-nums text-ink"
								>{formatMoney(signal.currentPriceLb)}</span
							>
						</div>
						<h3 class="mt-3 font-serif text-lg font-medium leading-6 text-ink">
							{signalTitle(signal)}
						</h3>
						<p class="mt-0.5 text-xs text-muted">
							{signal.source ?? 'Supplier undisclosed'} · {signal.market}
						</p>
						<p class="mt-2 flex-1 text-sm leading-6 text-muted">{evidenceSentence(signal)}</p>
						<a
							href={catalogHref(signal)}
							class="mt-3 text-sm font-semibold text-link hover:text-accent"
						>
							View in the catalog <span aria-hidden="true">→</span>
						</a>
					</article>
				{/each}
			</section>
		{:else}
			<section
				class="mb-6 rounded-lg border border-line bg-surface-panel p-5"
				aria-label="Value signals"
			>
				<p class="text-sm text-muted">
					No strong {viewMode === 'all' ? '' : `${viewMode} `}buy signals this morning — that's a
					signal too. The pass runs again tomorrow morning.
				</p>
			</section>
		{/if}
	{:else if signalsSummary !== null}
		<section
			class="relative mb-6 overflow-hidden rounded-lg border border-accent/20 bg-accent-subtle/10 p-6 pl-8"
			aria-label="Value signals summary"
		>
			<AccentSpine />
			<div class="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
				<div>
					<h3 class="font-serif text-lg font-medium text-ink">
						{displayedSummaryTotal.toLocaleString()}
						{summaryScopeLabel}
						{displayedSummaryTotal === 1 ? 'buy signal is' : 'buy signals are'} active
						{#if formatAsOf(signalsAsOf)}as of {formatAsOf(signalsAsOf)}{:else}this morning{/if}.
					</h3>
					<p class="mt-1 text-sm text-muted">
						{#if signalsSummary.market !== viewMode && viewMode !== 'all'}
							{summaryScopeLabel.charAt(0).toUpperCase() + summaryScopeLabel.slice(1)} count shown while
							the {selectedScopeLabel} scope is selected:
						{:else}
							{summaryScopeLabel.charAt(0).toUpperCase() + summaryScopeLabel.slice(1)} proof slice:
						{/if}
						{signalsSummary.byType.price_drop} price drops · {signalsSummary.byType.below_market} below-market
						lots. Parchment Intelligence members see scoped retail, wholesale, and all-market lots with
						the evidence behind each one.
					</p>
				</div>
				<div class="flex shrink-0 flex-col gap-2 sm:flex-row">
					<a
						href="/subscription?plan=intelligence-monthly&intent=checkout"
						class="rounded-md bg-accent px-4 py-2 text-center text-sm font-semibold text-ink transition-all duration-200 hover:bg-accent/85"
					>
						Start Intelligence
					</a>
					{#if !isSignedIn}
						<a
							href="/auth"
							class="rounded-md border border-accent px-4 py-2 text-center text-sm font-medium text-ink transition-all duration-200 hover:bg-accent"
						>
							Sign in
						</a>
					{/if}
				</div>
			</div>
		</section>
	{/if}
{/if}
