<script lang="ts">
	import type { Component } from 'svelte';
	import ChartSkeleton from '$lib/components/ChartSkeleton.svelte';
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

	let {
		coffee,
		parseTastingNotes,
		compact = false,
		highlighted = false,
		annotation = ''
	} = $props<{
		coffee: CoffeeCatalog;
		parseTastingNotes: (tastingNotesJson: string | null | object) => TastingNotes | null;
		compact?: boolean;
		highlighted?: boolean;
		annotation?: string;
	}>();

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

	let TastingNotesRadar = $state<Component | null>(null);
	let radarRequested = $state(false);
	let isVisible = $state(false);
	let cardEl = $state<HTMLElement | null>(null);

	let tastingNotes = $derived(parseTastingNotes(coffee.ai_tasting_notes));
	let priceTiers = $derived(parsePriceTiers(coffee.price_tiers));
	let displayPrice = $derived(getDisplayPrice(coffee));
	let priceText = $derived(
		displayPrice != null ? formatPricePerLb(displayPrice) : 'Price unavailable'
	);
	let hasMultiplePriceTiers = $derived((priceTiers?.length ?? 0) > 1);
	let bulkSavings = $derived(priceTiers ? getBulkSavings(priceTiers) : null);
	let savingsSummary = $derived.by(() => {
		if (!bulkSavings || !priceTiers) return '';
		const highestTier = priceTiers[priceTiers.length - 1];
		return `Save ${bulkSavings.percentOff}% at ${highestTier.min_lbs}+ lb`;
	});
	let processAnalysis = $derived.by(() =>
		buildProcessAnalysis(coffee as CoffeeWithStructuredProcess)
	);
	let proofBadges = $derived.by(() => {
		const coffeeWithProof = coffee as CoffeeWithStructuredProcess;
		const proof = coffeeWithProof.proof ?? createCatalogProofSummary(coffee as CatalogProofInput);
		return getCatalogProofBadges(proof);
	});

	let originLabel = $derived(
		[coffee.country, coffee.region].filter(Boolean).join(', ') || coffee.continent || ''
	);

	let auxFacts = $derived(
		[
			coffee.cultivar_detail ? { label: 'Cultivar', value: coffee.cultivar_detail } : null,
			coffee.grade ? { label: 'Elevation', value: coffee.grade } : null,
			coffee.appearance ? { label: 'Appearance', value: coffee.appearance } : null,
			coffee.type ? { label: 'Importer', value: coffee.type } : null,
			coffee.arrival_date ? { label: 'Arrival', value: coffee.arrival_date } : null,
			coffee.stocked_date ? { label: 'Stocked', value: coffee.stocked_date } : null
		].filter((entry): entry is { label: string; value: string } => Boolean(entry))
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
		const process = coffeeItem.process;
		if (!process) return null;

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

	$effect(() => {
		if (compact || !cardEl || typeof IntersectionObserver === 'undefined') {
			isVisible = true;
			return;
		}
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					isVisible = true;
					observer.disconnect();
				}
			},
			{ rootMargin: '200px 0px' }
		);
		observer.observe(cardEl);
		return () => observer.disconnect();
	});

	$effect(() => {
		if (!isVisible || !tastingNotes || radarRequested) return;
		radarRequested = true;
		import('$lib/components/TastingNotesRadar.svelte')
			.then((mod) => {
				TastingNotesRadar = mod.default;
			})
			.catch((error) => {
				console.error('Failed to load radar component:', error);
			});
	});
</script>

<article
	bind:this={cardEl}
	class="group relative flex flex-col rounded-lg bg-background-primary-light text-left shadow-sm ring-1 transition-colors {highlighted
		? 'ring-2 ring-background-tertiary-light'
		: 'ring-border-light hover:ring-background-tertiary-light/60'} {compact
		? 'gap-2 p-3'
		: 'gap-3 p-4 sm:p-5'}"
>
	{#if annotation}
		<p class="text-sm italic text-text-secondary-light">{annotation}</p>
	{/if}

	<header class="flex items-start justify-between gap-3">
		<div class="min-w-0 flex-1">
			<h3
				class="font-semibold text-text-primary-light {compact
					? 'text-base leading-snug'
					: 'text-lg leading-snug'}"
			>
				{coffee.name}
			</h3>
			<div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
				{#if coffee.source}
					<span class="font-medium text-link-light">{coffee.source}</span>
				{/if}
				{#if coffee.wholesale}
					<span
						class="rounded-full bg-harvest-gold/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-harvest-gold"
					>
						Wholesale
					</span>
				{/if}
			</div>
		</div>
		<div class="shrink-0 text-right">
			<div
				class="font-bold text-text-primary-light {compact ? 'text-base' : 'text-xl'} leading-tight"
			>
				{priceText}
			</div>
			{#if hasMultiplePriceTiers}
				<div class="mt-0.5 text-[10px] uppercase tracking-wide text-text-secondary-light">
					Starts at
				</div>
			{/if}
		</div>
	</header>

	{#if originLabel || coffee.processing}
		<div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-text-secondary-light">
			{#if originLabel}
				<span class="truncate">{originLabel}</span>
			{/if}
			{#if originLabel && coffee.processing}
				<span aria-hidden="true">·</span>
			{/if}
			{#if coffee.processing}
				<span>Processing: {coffee.processing}</span>
			{/if}
		</div>
	{/if}

	{#if proofBadges.length > 0}
		<div class="flex flex-wrap gap-1.5" aria-label="Catalog proof signals">
			{#each proofBadges as badge (badge.key)}
				<span
					class="rounded-full bg-background-secondary-light px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-secondary-light ring-1 ring-border-light"
					title={badge.title}
				>
					{badge.label}
				</span>
			{/each}
		</div>
	{/if}

	{#if !compact && coffee.ai_description}
		<p class="line-clamp-4 whitespace-pre-line text-xs leading-relaxed text-text-secondary-light">
			{coffee.ai_description}
		</p>
	{/if}

	{#if !compact && tastingNotes}
		<div class="-mx-1 flex justify-center">
			{#if isVisible}
				{#if TastingNotesRadar}
					<TastingNotesRadar {tastingNotes} size={200} responsive={true} lazy={true} />
				{:else}
					<ChartSkeleton height="200px" title="Loading tasting profile..." />
				{/if}
			{:else}
				<div style="height: 200px"></div>
			{/if}
		</div>
	{/if}

	{#if processAnalysis}
		<details
			class="card-disclosure rounded-md ring-1 ring-border-light open:bg-background-secondary-light/40"
			open={!compact}
		>
			<summary
				class="flex cursor-pointer list-none items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-medium text-text-primary-light transition-colors hover:text-background-tertiary-light"
			>
				<span class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
					<span>Process analysis</span>
					<span class="text-xs font-normal text-text-secondary-light"
						>{processAnalysis.headline}</span
					>
				</span>
				<span
					class="card-disclosure__chevron select-none text-text-secondary-light transition-transform"
					aria-hidden="true">▾</span
				>
			</summary>
			<div class="space-y-2 px-3 pb-3 text-xs text-text-secondary-light">
				{#if processAnalysis.details.length > 0}
					<ul class="space-y-1">
						{#each processAnalysis.details as detail}
							<li>{detail}</li>
						{/each}
					</ul>
				{/if}
				{#if processAnalysis.disclosureLabel || processAnalysis.confidenceLabel || processAnalysis.evidenceLabel}
					<div class="flex flex-wrap gap-1.5">
						{#if processAnalysis.disclosureLabel}
							<span
								class="rounded-full bg-background-primary-light px-2 py-0.5 text-[10px] font-medium ring-1 ring-border-light"
							>
								{processAnalysis.disclosureLabel}
							</span>
						{/if}
						{#if processAnalysis.confidenceLabel}
							<span
								class="rounded-full bg-background-primary-light px-2 py-0.5 text-[10px] font-medium ring-1 ring-border-light"
							>
								{processAnalysis.confidenceLabel}
							</span>
						{/if}
						{#if processAnalysis.evidenceLabel}
							<span
								class="rounded-full bg-background-primary-light px-2 py-0.5 text-[10px] font-medium ring-1 ring-border-light"
							>
								{processAnalysis.evidenceLabel}
							</span>
						{/if}
					</div>
				{/if}
			</div>
		</details>
	{/if}

	{#if hasMultiplePriceTiers && priceTiers}
		<details class="card-disclosure rounded-md ring-1 ring-border-light">
			<summary
				class="flex cursor-pointer list-none items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-medium text-text-primary-light transition-colors hover:text-background-tertiary-light"
			>
				<span class="flex flex-wrap items-center gap-x-2 gap-y-1">
					<span>Volume pricing</span>
					<span class="text-xs font-normal text-text-secondary-light"
						>{priceTiers.length} tiers</span
					>
					{#if savingsSummary}
						<span
							class="rounded-full bg-growth-green/10 px-2 py-0.5 text-[10px] font-semibold text-growth-green ring-1 ring-growth-green/30"
						>
							{savingsSummary}
						</span>
					{/if}
				</span>
				<span
					class="card-disclosure__chevron select-none text-text-secondary-light transition-transform"
					aria-hidden="true">▾</span
				>
			</summary>
			<div class="grid gap-2 px-3 pb-3 sm:grid-cols-2">
				{#each priceTiers as tier (tier.min_lbs)}
					<div class="rounded-md bg-background-secondary-light px-3 py-2 ring-1 ring-border-light">
						<div
							class="text-[10px] font-semibold uppercase tracking-wide text-text-secondary-light"
						>
							{tier.min_lbs}+ lb
						</div>
						<div class="mt-0.5 text-sm font-semibold text-text-primary-light">
							{formatPricePerLb(tier.price)}
						</div>
					</div>
				{/each}
			</div>
		</details>
	{/if}

	{#if !compact && auxFacts.length > 0}
		<dl class="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-text-secondary-light">
			{#each auxFacts as fact (fact.label)}
				<div class="inline-flex items-baseline gap-1">
					<dt class="font-medium">{fact.label}:</dt>
					<dd>{fact.value}</dd>
				</div>
			{/each}
		</dl>
	{/if}

	{#if coffee.link}
		<div class="mt-auto flex items-center justify-end pt-1">
			<a
				href={coffee.link}
				target="_blank"
				rel="noopener noreferrer"
				class="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-background-tertiary-light px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-background-tertiary-light focus:ring-offset-2"
				aria-label={`Open supplier page for ${coffee.name}`}
			>
				<span>Supplier page</span>
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
						d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
					/>
				</svg>
			</a>
		</div>
	{/if}
</article>

<style>
	.card-disclosure summary::-webkit-details-marker {
		display: none;
	}
	.card-disclosure[open] > summary .card-disclosure__chevron {
		transform: rotate(180deg);
	}
</style>
