<script lang="ts">
	import type { Component } from 'svelte';
	import ChartSkeleton from '$lib/components/ChartSkeleton.svelte';
	import SimilarCoffeePanel from '$lib/components/catalog/SimilarCoffeePanel.svelte';
	import {
		formatPricePerLb,
		getBulkSavings,
		getDisplayPrice,
		parsePriceTiers
	} from '$lib/utils/pricing';
	import type { TastingNotes } from '$lib/types/coffee.types';
	import type { CoffeeCatalog } from '$lib/types/component.types';
	import {
		formatProcessDisplayValue,
		normalizeProcessDisplayValue
	} from '$lib/catalog/processDisplay';
	import {
		createCatalogProofSummary,
		getCatalogProofBadges,
		type CatalogProofInput,
		type CatalogProofSummary
	} from '$lib/catalog/proofSummary';
	import { getPurveyorScoreSummary } from '$lib/catalog/purveyorScore';
	import type { LotPriceContext, LotPriceTier } from '$lib/catalog/priceContext';

	let {
		coffee,
		parseTastingNotes,
		compact = false,
		highlighted = false,
		annotation = '',
		showSimilarComparisonAction = false,
		canUseBeanMatching = false,
		enableDetails = true,
		priceContext = null,
		tracked = false,
		onToggleTrack = undefined,
		showCatalogLink = false,
		initialDetailsOpen = false
	} = $props<{
		coffee: CoffeeCatalog;
		parseTastingNotes: (tastingNotesJson: string | null | object) => TastingNotes | null;
		compact?: boolean;
		highlighted?: boolean;
		annotation?: string;
		showSimilarComparisonAction?: boolean;
		canUseBeanMatching?: boolean;
		similarComparisonActive?: boolean;
		onCompareSimilar?: (coffee: CoffeeCatalog) => void;
		enableDetails?: boolean;
		priceContext?: LotPriceContext | null;
		tracked?: boolean;
		onToggleTrack?: (id: number) => void;
		/** Show a "View in catalog" link in the detail panel (for surfaces outside /catalog, e.g. chat canvas). */
		showCatalogLink?: boolean;
		/** Open the detail panel on mount (used by /catalog?coffee=<id> deep links). */
		initialDetailsOpen?: boolean;
	}>();

	function priceContextColorClass(tier: LotPriceTier): string {
		switch (tier) {
			case 'well_below':
				return 'text-emerald-600';
			case 'below':
				return 'text-emerald-500';
			case 'at':
				return 'text-text-secondary-light';
			case 'above':
				return 'text-amber-600';
			case 'well_above':
				return 'text-red-500';
		}
	}

	type ProcessSummary = {
		base_method?: string | null;
		fermentation_type?: string | null;
		additives?: string[] | null;
		additive_detail?: string | null;
		fermentation_duration_hours?: number | null;
		drying_method?: string | null;
		notes?: string | null;
		disclosure_level?: string | null;
		confidence?: number | null;
		evidence_available?: boolean | null;
	};

	type CoffeeWithStructuredProcess = CoffeeCatalog & {
		process?: ProcessSummary | null;
		proof?: CatalogProofSummary | null;
	};

	type ProcessAnalysis = {
		headline: string;
		details: string[];
		confidenceLabel: string | null;
		disclosureLabel: string | null;
		evidenceLabel: string | null;
	};

	type DetailTab = 'overview' | 'taste-process' | 'pricing' | 'matches';

	const detailTabs: Array<{ id: DetailTab; label: string }> = [
		{ id: 'overview', label: 'Overview' },
		{ id: 'taste-process', label: 'Taste & Process' },
		{ id: 'pricing', label: 'Pricing' },
		{ id: 'matches', label: 'Matches' }
	];

	let TastingNotesRadar = $state<Component | null>(null);
	let radarComponentLoading = $state(true);
	// Deliberate initial-value capture: the prop seeds the open state only.
	// svelte-ignore state_referenced_locally
	let detailsOpen = $state(initialDetailsOpen);
	let activeTab = $state<DetailTab>('overview');

	$effect(() => {
		setTimeout(async () => {
			try {
				const module = await import('$lib/components/TastingNotesRadar.svelte');
				TastingNotesRadar = module.default;
				radarComponentLoading = false;
			} catch (error) {
				console.error('Failed to load radar component:', error);
				radarComponentLoading = false;
			}
		}, 250);
	});

	let tastingNotes = $derived(parseTastingNotes(coffee.ai_tasting_notes));
	let priceTiers = $derived(parsePriceTiers(coffee.price_tiers));
	let displayPrice = $derived(getDisplayPrice(coffee));
	let priceText = $derived(
		displayPrice != null ? formatPricePerLb(displayPrice) : 'Price unavailable'
	);
	let hasMultiplePriceTiers = $derived((priceTiers?.length ?? 0) > 1);
	let bulkSavings = $derived(priceTiers ? getBulkSavings(priceTiers) : null);
	let purveyorScore = $derived(getPurveyorScoreSummary(coffee));
	let scorePercent = $derived(`${Math.round(purveyorScore.confidence * 100)}%`);
	let tierSummary = $derived.by(() => {
		if (!priceTiers || priceTiers.length < 2) return '';
		const highestTier = priceTiers[priceTiers.length - 1];
		return `${priceTiers.length} pricing tiers from ${priceTiers[0].min_lbs}+ lb to ${highestTier.min_lbs}+ lb`;
	});
	let savingsSummary = $derived.by(() => {
		if (!bulkSavings || !priceTiers) return '';
		const highestTier = priceTiers[priceTiers.length - 1];
		return `Save up to ${bulkSavings.percentOff}% at ${highestTier.min_lbs}+ lb`;
	});
	let locationSummary = $derived.by(
		() =>
			[coffee.country, coffee.region].filter(Boolean).join(', ') ||
			coffee.continent ||
			'Origin unavailable'
	);
	let longLocationSummary = $derived.by(
		() =>
			[coffee.continent, coffee.country, coffee.region].filter(Boolean).join(' > ') ||
			'Origin unavailable'
	);
	let freshnessSummary = $derived.by(() => {
		if (coffee.stocked_date) return `Stocked ${coffee.stocked_date}`;
		if (coffee.arrival_date) return `Arrived ${coffee.arrival_date}`;
		if (coffee.stocked === true) return 'In stock';
		if (coffee.stocked === false) return 'Out of stock';
		return 'Availability unknown';
	});
	let processAnalysis = $derived.by(() =>
		buildProcessAnalysis(coffee as CoffeeWithStructuredProcess)
	);
	let proofBadges = $derived.by(() => {
		const coffeeWithProof = coffee as CoffeeWithStructuredProcess;
		const proof = coffeeWithProof.proof ?? createCatalogProofSummary(coffee as CatalogProofInput);
		return getCatalogProofBadges(proof);
	});
	let tastingPreview = $derived.by(() => {
		if (!tastingNotes) return [];
		return [
			tastingNotes.flavor,
			tastingNotes.acidity,
			tastingNotes.sweetness,
			tastingNotes.body,
			tastingNotes.fragrance_aroma
		]
			.filter((note) => note?.tag)
			.slice(0, 3);
	});
	let availableDetailTabs = $derived(
		detailTabs.filter((tab) => tab.id !== 'matches' || showSimilarComparisonAction)
	);

	function formatAdditives(additives: string[] | null | undefined): string | null {
		if (!additives?.length) return null;
		const cleaned = additives
			.map((additive) => normalizeProcessDisplayValue(additive))
			.filter((additive): additive is string => Boolean(additive));
		if (cleaned.length === 0) return null;

		const disclosedAdditives = cleaned.filter((additive) => additive.toLowerCase() !== 'none');
		if (disclosedAdditives.length === 0) {
			return 'No additives disclosed';
		}

		return `Additives disclosed: ${disclosedAdditives.map(formatProcessDisplayValue).join(', ')}`;
	}

	function formatDisclosureLabel(value: string | null | undefined): string | null {
		const cleaned = normalizeProcessDisplayValue(value);
		if (!cleaned) return null;
		const labels: Record<string, string> = {
			high_detail: 'High-detail disclosure',
			structured: 'Structured disclosure',
			minimal: 'Minimal disclosure'
		};
		return labels[cleaned] ?? formatProcessDisplayValue(cleaned);
	}

	function formatConfidenceLabel(confidence: number | null | undefined): string | null {
		if (confidence === undefined || confidence === null) return null;
		if (confidence >= 0.9) return 'Very high confidence';
		if (confidence >= 0.8) return 'High confidence';
		if (confidence >= 0.6) return 'Moderate confidence';
		return null;
	}

	function buildProcessAnalysis(coffeeItem: CoffeeWithStructuredProcess): ProcessAnalysis | null {
		const process = coffeeItem.process ?? {
			base_method: coffeeItem.processing_base_method,
			fermentation_type: coffeeItem.fermentation_type,
			additives: coffeeItem.process_additives,
			additive_detail: coffeeItem.process_additive_detail,
			fermentation_duration_hours: coffeeItem.fermentation_duration_hours,
			drying_method: coffeeItem.drying_method,
			notes: coffeeItem.processing_notes,
			disclosure_level: coffeeItem.processing_disclosure_level,
			confidence: coffeeItem.processing_confidence,
			evidence_available: coffeeItem.processing_evidence_available
		};

		const baseMethod = normalizeProcessDisplayValue(process.base_method);
		const fermentationType = normalizeProcessDisplayValue(process.fermentation_type);
		const additiveSummary = formatAdditives(process.additives);
		const additiveDetail = normalizeProcessDisplayValue(process.additive_detail);
		const dryingMethod = normalizeProcessDisplayValue(process.drying_method);
		const notes = normalizeProcessDisplayValue(process.notes);
		const disclosureLabel = formatDisclosureLabel(process.disclosure_level);
		const confidenceLabel = formatConfidenceLabel(process.confidence);
		const evidenceLabel = process.evidence_available ? 'Supplier evidence available' : null;

		const details = [
			fermentationType ? `Fermentation: ${formatProcessDisplayValue(fermentationType)}` : null,
			additiveSummary,
			additiveDetail ? `Additive detail: ${additiveDetail}` : null,
			process.fermentation_duration_hours
				? `Fermentation time: ${process.fermentation_duration_hours} hours`
				: null,
			dryingMethod ? `Drying: ${formatProcessDisplayValue(dryingMethod)}` : null,
			notes
		].filter((detail): detail is string => Boolean(detail));

		if (
			!baseMethod &&
			details.length === 0 &&
			!disclosureLabel &&
			!confidenceLabel &&
			!evidenceLabel
		) {
			return null;
		}

		return {
			headline: baseMethod
				? `${formatProcessDisplayValue(baseMethod)} process transparency`
				: 'Process transparency',
			details,
			confidenceLabel,
			disclosureLabel,
			evidenceLabel
		};
	}

	function openDetails(tab: DetailTab = 'overview') {
		activeTab = tab;
		detailsOpen = true;
	}

	function closeDetails() {
		detailsOpen = false;
		activeTab = 'overview';
	}

	function handleDialogKeydown(event: KeyboardEvent) {
		if (detailsOpen && event.key === 'Escape') closeDetails();
	}

	function handleCardKeydown(event: KeyboardEvent) {
		if (!enableDetails) return;
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			openDetails();
		}
	}
</script>

<svelte:window onkeydown={handleDialogKeydown} />

<article
	class="group relative flex h-full flex-col rounded-lg bg-background-primary-light p-4 text-left shadow-sm ring-1 transition-all focus-within:ring-2 focus-within:ring-background-tertiary-light/60 hover:shadow-md hover:ring-background-tertiary-light/50 {highlighted
		? 'border-l-4 border-background-tertiary-light ring-background-tertiary-light/40'
		: 'ring-border-light'} {compact ? 'gap-3' : 'gap-4'}"
>
	{#if enableDetails}
		<button
			type="button"
			class="absolute inset-0 z-0 cursor-pointer rounded-lg focus:outline-none"
			aria-label={`View details for ${coffee.name}`}
			onclick={() => openDetails()}
			onkeydown={handleCardKeydown}
		></button>
	{/if}

	<div class="pointer-events-none relative z-10 flex h-full flex-col {compact ? 'gap-3' : 'gap-4'}">
		{#if annotation}
			<p class="text-sm italic text-muted">{annotation}</p>
		{/if}

		<div class="flex items-start justify-between gap-3">
			<div class="min-w-0">
				<h3 class="{compact ? 'text-sm' : 'text-base'} font-semibold leading-snug text-ink">
					{coffee.name}
				</h3>
				<div class="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-sm">
					<span class="break-words font-medium text-accent"
						>{coffee.source ?? 'Unknown supplier'}</span
					>
					{#if coffee.wholesale}
						<span
							class="rounded-full bg-intelligence-subtle px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-intelligence"
						>
							Wholesale
						</span>
					{/if}
				</div>
			</div>
			<div class="shrink-0 text-right">
				<div class="{compact ? 'text-sm' : 'text-lg'} font-bold text-ink">{priceText}</div>
				{#if hasMultiplePriceTiers}
					<div class="text-[11px] text-muted">{priceTiers?.length} tiers</div>
				{/if}
				{#if priceContext}
					<div
						class="mt-0.5 text-[11px] font-medium {priceContextColorClass(priceContext.tier)}"
						title="Price relative to {coffee.country ?? 'origin'} median across all stocked lots"
					>
						{priceContext.label}
					</div>
				{/if}
			</div>
		</div>

		<div class="flex items-center justify-between gap-3 border-y border-border-light py-2">
			<div class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
				<span>
					<span class="font-medium text-ink">Origin</span>
					{locationSummary}
				</span>
				{#if coffee.processing}
					<span>
						<span class="font-medium text-ink">Process</span>
						{coffee.processing}
					</span>
				{/if}
				<span>
					<span class="font-medium text-ink">Freshness</span>
					{freshnessSummary}
				</span>
			</div>
			<div
				class="flex shrink-0 items-center gap-1.5 text-xs"
				title="Purveyor Score"
				aria-label={`Purveyor Score ${purveyorScore.score} ${purveyorScore.tier}`}
			>
				<span class="h-2 w-2 rounded-full bg-background-tertiary-light"></span>
				<span class="sr-only">Purveyor Score</span>
				<span class="font-semibold text-ink">{purveyorScore.score}</span>
				<span class="text-muted">{purveyorScore.tier}</span>
			</div>
		</div>

		{#if tastingPreview.length > 0}
			<div class="flex flex-wrap gap-x-3 gap-y-1.5" aria-label="Tasting preview">
				{#each tastingPreview as note}
					<span class="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
						<span
							class="h-2 w-2 rounded-full ring-1 ring-border-light"
							style:background-color={note.color}
						></span>
						{note.tag}
						{note.score ? `(${note.score}/5)` : ''}
					</span>
				{/each}
			</div>
		{/if}

		{#if !compact && coffee.ai_description}
			<p
				class="max-h-[3.4rem] overflow-hidden border-l-4 border-background-tertiary-light pl-3 text-xs leading-relaxed text-muted"
			>
				{coffee.ai_description}
			</p>
		{/if}

		<div class="mt-auto flex items-center justify-between gap-2 pt-1 text-muted">
			{#if showSimilarComparisonAction}
				<button
					type="button"
					class="pointer-events-auto inline-flex size-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-background-tertiary-light/10 hover:text-accent"
					aria-label={canUseBeanMatching
						? `Compare matches for ${coffee.name}`
						: `Unlock matches for ${coffee.name}`}
					title={canUseBeanMatching ? 'Compare matches' : 'Unlock matches'}
					onclick={(event) => {
						event.stopPropagation();
						openDetails('matches');
					}}
				>
					<svg
						class="h-4 w-4"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M7 7h10M7 7l3-3M7 7l3 3M17 17H7m10 0l-3-3m3 3l-3 3"
						/>
					</svg>
				</button>
			{:else}
				<span></span>
			{/if}

			{#if onToggleTrack}
				<button
					type="button"
					class="pointer-events-auto inline-flex size-8 items-center justify-center rounded-md transition-colors hover:bg-background-tertiary-light/10 {tracked
						? 'text-background-tertiary-light'
						: 'text-muted hover:text-accent'}"
					aria-label={tracked ? `Untrack ${coffee.name}` : `Track ${coffee.name}`}
					aria-pressed={tracked}
					title={tracked ? 'Remove from watchlist' : 'Add to watchlist'}
					onclick={(event) => {
						event.stopPropagation();
						onToggleTrack(coffee.id as unknown as number);
					}}
				>
					<svg
						class="h-4 w-4"
						fill={tracked ? 'currentColor' : 'none'}
						stroke="currentColor"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
						/>
					</svg>
				</button>
			{/if}
			<div class="flex items-center gap-2">
				{#if coffee.link}
					<a
						href={coffee.link}
						target="_blank"
						rel="noopener noreferrer"
						class="pointer-events-auto inline-flex size-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-background-tertiary-light/10 hover:text-accent"
						aria-label={`Open supplier page for ${coffee.name}`}
						title="Open supplier page"
						onclick={(event) => event.stopPropagation()}
					>
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
							/>
						</svg>
					</a>
				{/if}
				<span
					class="inline-flex size-8 items-center justify-center rounded-md transition-colors group-hover:bg-background-tertiary-light/10 group-hover:text-accent"
					aria-hidden="true"
				>
					<svg
						class="h-4 w-4 transition-transform group-hover:translate-x-0.5"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 5l7 7-7 7"
						/>
					</svg>
				</span>
			</div>
		</div>
	</div>
</article>

{#if detailsOpen}
	<div class="pointer-events-none fixed inset-y-0 right-0 z-50 flex w-full justify-end">
		<aside
			class="pointer-events-auto flex h-dvh w-full flex-col overflow-hidden border-l border-line bg-background-primary-light shadow-2xl sm:max-w-xl xl:max-w-2xl"
			aria-labelledby="coffee-detail-title-{coffee.id}"
		>
			<header class="border-b border-line bg-background-primary-light px-4 py-4 md:px-6">
				<div class="flex items-start justify-between gap-4">
					<div>
						<p class="text-xs font-semibold uppercase tracking-wide text-accent">
							{coffee.source ?? 'Unknown supplier'}
						</p>
						<h2 id="coffee-detail-title-{coffee.id}" class="mt-1 text-xl font-bold text-ink">
							{coffee.name}
						</h2>
						<p class="mt-1 text-sm text-muted">{longLocationSummary}</p>
						{#if coffee.link || showCatalogLink}
							<div class="mt-2 flex flex-wrap items-center gap-3 text-sm">
								{#if coffee.link}
									<a
										href={coffee.link}
										target="_blank"
										rel="noopener noreferrer"
										class="inline-flex items-center gap-1 font-semibold text-accent transition-colors hover:underline"
									>
										Buy from {coffee.source ?? 'supplier'}
										<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
											/>
										</svg>
									</a>
								{/if}
								{#if showCatalogLink}
									<a
										href="/catalog?coffee={coffee.id}"
										class="font-semibold text-muted transition-colors hover:text-accent hover:underline"
									>
										View in catalog
									</a>
								{/if}
							</div>
						{/if}
					</div>
					<button
						type="button"
						class="rounded-md border border-line px-3 py-2 text-sm font-semibold text-muted transition-colors hover:border-accent hover:text-accent"
						onclick={closeDetails}
					>
						Close
					</button>
				</div>
				<div class="mt-4 flex gap-2 overflow-x-auto" role="tablist" aria-label="Coffee detail tabs">
					{#each availableDetailTabs as tab}
						<button
							type="button"
							role="tab"
							aria-selected={activeTab === tab.id}
							class="shrink-0 rounded-md px-3 py-2 text-sm font-semibold transition-colors {activeTab ===
							tab.id
								? 'bg-accent text-ink'
								: 'border border-line text-muted hover:border-accent hover:text-accent'}"
							onclick={() => (activeTab = tab.id)}
						>
							{tab.label}
						</button>
					{/each}
				</div>
			</header>

			<div
				class="overflow-y-auto bg-surface-panel/45 px-4 py-5 md:px-6"
				data-coffee-detail-scroll-region
			>
				{#if activeTab === 'overview'}
					<div class="grid gap-4 lg:grid-cols-[1fr_20rem]">
						<div class="space-y-4">
							<div class="rounded-lg border border-line bg-surface-panel p-4">
								<p class="text-xs font-semibold uppercase tracking-wide text-muted">
									Sourcing snapshot
								</p>
								<dl class="mt-3 grid gap-3 text-sm sm:grid-cols-2">
									<div>
										<dt class="font-semibold text-ink">Origin</dt>
										<dd class="text-muted">{longLocationSummary}</dd>
									</div>
									<div>
										<dt class="font-semibold text-ink">Process</dt>
										<dd class="text-muted">{coffee.processing ?? 'Not disclosed'}</dd>
									</div>
									<div>
										<dt class="font-semibold text-ink">Availability</dt>
										<dd class="text-muted">{freshnessSummary}</dd>
									</div>
									<div>
										<dt class="font-semibold text-ink">Importer type</dt>
										<dd class="text-muted">{coffee.type ?? 'Not disclosed'}</dd>
									</div>
									{#if coffee.cultivar_detail}
										<div>
											<dt class="font-semibold text-ink">Cultivar</dt>
											<dd class="text-muted">{coffee.cultivar_detail}</dd>
										</div>
									{/if}
									{#if coffee.grade}
										<div>
											<dt class="font-semibold text-ink">Grade / elevation</dt>
											<dd class="text-muted">{coffee.grade}</dd>
										</div>
									{/if}
								</dl>
							</div>
							{#if coffee.ai_description}
								<div class="rounded-lg border border-line bg-surface-panel p-4">
									<p class="text-xs font-semibold uppercase tracking-wide text-muted">
										Catalog note
									</p>
									<p class="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">
										{coffee.ai_description}
									</p>
								</div>
							{/if}
						</div>

						<aside class="space-y-4">
							{#if onToggleTrack}
								<div class="rounded-lg border border-line bg-surface-panel p-4">
									<p class="text-xs font-semibold uppercase tracking-wide text-muted">Watchlist</p>
									<p class="mt-2 text-sm font-semibold text-ink">
										{tracked ? 'Tracking this lot' : 'Not on your watchlist'}
									</p>
									<p class="mt-1 text-xs leading-relaxed text-muted">
										Tracked lots report price moves and delistings on your dashboard, feed the
										Market Index watchlist panel, and give chat the context to reference them by
										name.
									</p>
									<button
										type="button"
										class="mt-3 rounded-md px-4 py-2 text-sm font-medium transition-all duration-200 {tracked
											? 'border border-line text-muted hover:border-red-300 hover:text-red-600'
											: 'bg-accent text-white hover:bg-opacity-90'}"
										aria-pressed={tracked}
										onclick={() => onToggleTrack(coffee.id as unknown as number)}
									>
										{tracked ? 'Stop tracking' : 'Track this lot'}
									</button>
								</div>
							{/if}
							<div class="rounded-lg border border-line bg-surface-panel p-4">
								<p class="text-xs font-semibold uppercase tracking-wide text-muted">
									Purveyor Score
								</p>
								<div class="mt-2 flex items-baseline gap-2">
									<span class="text-4xl font-bold text-ink">{purveyorScore.score}</span>
									<span class="font-semibold text-accent">{purveyorScore.tier}</span>
								</div>
								<p class="mt-2 text-sm text-muted">Input confidence: {scorePercent}</p>
								<p class="mt-3 text-xs leading-relaxed text-muted">
									A proprietary metadata and listing-intelligence score. It rewards structured,
									comparable sourcing facts and does not rate cup quality or certify suppliers.
								</p>
							</div>
							<div class="rounded-lg border border-line bg-surface-panel p-4">
								<p class="text-xs font-semibold uppercase tracking-wide text-muted">
									Proof families
								</p>
								{#if proofBadges.length > 0}
									<div class="mt-3 flex flex-wrap gap-2">
										{#each proofBadges as badge (badge.key)}
											<span
												class="rounded-full bg-accent-subtle/15 px-2.5 py-1 text-xs font-semibold text-ink"
												title={badge.title}
											>
												{badge.label}
											</span>
										{/each}
									</div>
								{:else}
									<p class="mt-2 text-sm text-muted">No proof-family signals are available yet.</p>
								{/if}
							</div>
						</aside>
					</div>
				{:else if activeTab === 'taste-process'}
					<div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
						<div class="space-y-4">
							{#if processAnalysis}
								<div class="rounded-lg border border-line bg-surface-panel p-4">
									<p class="text-xs font-semibold uppercase tracking-wide text-accent">
										Process transparency
									</p>
									<h3 class="mt-1 font-semibold text-ink">{processAnalysis.headline}</h3>
									{#if processAnalysis.details.length > 0}
										<ul class="mt-3 space-y-2 text-sm text-muted">
											{#each processAnalysis.details as detail}
												<li>{detail}</li>
											{/each}
										</ul>
									{/if}
									<div class="mt-3 flex flex-wrap gap-2">
										{#if processAnalysis.disclosureLabel}
											<span
												class="rounded-full bg-surface-raised px-2 py-1 text-xs text-muted ring-1 ring-line"
											>
												{processAnalysis.disclosureLabel}
											</span>
										{/if}
										{#if processAnalysis.confidenceLabel}
											<span
												class="rounded-full bg-surface-raised px-2 py-1 text-xs text-muted ring-1 ring-line"
											>
												{processAnalysis.confidenceLabel}
											</span>
										{/if}
										{#if processAnalysis.evidenceLabel}
											<span
												class="rounded-full bg-surface-raised px-2 py-1 text-xs text-muted ring-1 ring-line"
											>
												{processAnalysis.evidenceLabel}
											</span>
										{/if}
									</div>
								</div>
							{:else}
								<div class="rounded-lg border border-line bg-surface-panel p-4">
									<h3 class="font-semibold text-ink">Process transparency unavailable</h3>
									<p class="mt-1 text-sm text-muted">
										This listing has not disclosed enough structured process metadata for a deeper
										process summary.
									</p>
								</div>
							{/if}

							{#if tastingPreview.length > 0}
								<div class="rounded-lg border border-line bg-surface-panel p-4">
									<p class="text-xs font-semibold uppercase tracking-wide text-muted">
										Tasting cues
									</p>
									<div class="mt-3 flex flex-wrap gap-2">
										{#each tastingPreview as note}
											<span
												class="rounded-full bg-accent-subtle/15 px-3 py-1.5 text-sm font-medium text-ink"
											>
												{note.tag}
												{note.score ? `(${note.score}/5)` : ''}
											</span>
										{/each}
									</div>
								</div>
							{/if}
						</div>
						<div class="rounded-lg border border-line bg-surface-panel p-4">
							<p class="text-xs font-semibold uppercase tracking-wide text-muted">
								Tasting profile
							</p>
							<div class="mt-3">
								{#if tastingNotes}
									{#if radarComponentLoading}
										<ChartSkeleton height="280px" title="Loading tasting profile..." />
									{:else if TastingNotesRadar}
										<TastingNotesRadar {tastingNotes} size={280} responsive={true} lazy={true} />
									{/if}
								{:else}
									<p class="text-sm text-muted">No structured tasting profile is available yet.</p>
								{/if}
							</div>
						</div>
					</div>
				{:else if activeTab === 'pricing'}
					<div class="space-y-4">
						<div class="rounded-lg border border-line bg-surface-panel p-4">
							<p class="text-xs font-semibold uppercase tracking-wide text-muted">
								{hasMultiplePriceTiers ? 'Starts at' : 'Price'}
							</p>
							<div class="mt-1 text-3xl font-bold text-ink">{priceText}</div>
							{#if savingsSummary}
								<p class="mt-2 text-sm font-semibold text-success">{savingsSummary}</p>
							{/if}
							{#if tierSummary}
								<p class="mt-1 text-sm text-muted">{tierSummary}</p>
							{/if}
						</div>
						{#if priceTiers && priceTiers.length > 0}
							<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
								{#each priceTiers as tier (tier.min_lbs)}
									<div class="rounded-lg border border-line bg-surface-panel p-4">
										<div class="text-xs font-semibold uppercase tracking-wide text-muted">
											{tier.min_lbs}+ lb
										</div>
										<div class="mt-1 text-lg font-semibold text-ink">
											{formatPricePerLb(tier.price)}
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{:else if activeTab === 'matches'}
					{#if canUseBeanMatching}
						<SimilarCoffeePanel {coffee} />
					{:else}
						<div class="rounded-lg border border-line bg-surface-panel p-5">
							<p class="text-xs font-semibold uppercase tracking-wide text-intelligence">
								Member comparison
							</p>
							<h3 class="mt-1 text-lg font-semibold text-ink">Unlock similar coffee matches</h3>
							<p class="mt-2 text-sm leading-relaxed text-muted">
								Parchment Intelligence compares origin, process, tasting, and canonical pricing
								signals. Treat matches as sourcing leads, not accepted identity claims.
							</p>
							<a
								href="/subscription"
								class="mt-4 inline-flex rounded-md bg-accent px-4 py-2 text-sm font-semibold text-ink transition-opacity hover:opacity-90"
							>
								Compare paid products
							</a>
						</div>
					{/if}
				{/if}
			</div>
		</aside>
	</div>
{/if}
