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

	const TASTING_AXES: Array<{ key: keyof TastingNotes; label: string; short: string }> = [
		{ key: 'body', label: 'Body', short: 'Body' },
		{ key: 'flavor', label: 'Flavor', short: 'Flavor' },
		{ key: 'acidity', label: 'Acidity', short: 'Acidity' },
		{ key: 'sweetness', label: 'Sweetness', short: 'Sweet' },
		{ key: 'fragrance_aroma', label: 'Aroma', short: 'Aroma' }
	];

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

	let hasBreakoutContent = $derived(
		Boolean(coffee.ai_description) ||
			Boolean(tastingNotes) ||
			Boolean(processAnalysis) ||
			(hasMultiplePriceTiers && Boolean(priceTiers)) ||
			auxFacts.length > 0
	);

	function clampScore(value: unknown): number {
		const numeric = typeof value === 'number' ? value : Number(value);
		if (!Number.isFinite(numeric)) return 0;
		return Math.max(0, Math.min(5, numeric));
	}

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
			headline: baseMethod ? `${formatProcessDisplayValue(baseMethod)} process` : 'Process',
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
	class="group relative flex flex-col overflow-hidden rounded-xl bg-background-primary-light text-left shadow-md ring-1 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl {highlighted
		? 'ring-2 ring-background-tertiary-light'
		: 'ring-border-light hover:ring-background-tertiary-light/70'}"
>
	<span class="block h-1 w-full bg-background-tertiary-light" aria-hidden="true"></span>

	<div class="flex flex-1 flex-col {compact ? 'gap-2 p-3' : 'gap-3 p-4'}">
		{#if annotation}
			<p class="text-sm italic text-text-secondary-light">{annotation}</p>
		{/if}

		<header class="flex items-start justify-between gap-3">
			<div class="min-w-0 flex-1">
				<h3
					class="font-semibold leading-snug text-text-primary-light group-hover:text-background-tertiary-light {compact
						? 'text-sm'
						: 'text-base sm:text-lg'}"
				>
					{coffee.name}
				</h3>
				<div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
					{#if coffee.source}
						<span class="font-medium text-link-light">{coffee.source}</span>
					{/if}
					{#if coffee.wholesale}
						<span
							class="rounded-full bg-background-tertiary-light/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-background-tertiary-light"
						>
							Wholesale
						</span>
					{/if}
				</div>
			</div>
			<div
				class="shrink-0 rounded-md bg-background-tertiary-light/10 px-2.5 py-1.5 text-right ring-1 ring-background-tertiary-light/30"
			>
				<div
					class="font-bold leading-none text-background-tertiary-light {compact
						? 'text-base'
						: 'text-lg sm:text-xl'}"
				>
					{priceText}
				</div>
				{#if hasMultiplePriceTiers}
					<div
						class="mt-1 text-[9px] font-medium uppercase tracking-wide text-text-secondary-light"
					>
						from
					</div>
				{/if}
			</div>
		</header>

		{#if originLabel || coffee.processing}
			<div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
				{#if originLabel}
					<span class="inline-flex items-center gap-1.5 font-medium text-text-primary-light">
						<span
							class="inline-block h-1.5 w-1.5 rounded-full bg-background-tertiary-light"
							aria-hidden="true"
						></span>
						<span class="truncate">{originLabel}</span>
					</span>
				{/if}
				{#if coffee.processing}
					<span class="text-text-secondary-light">Processing: {coffee.processing}</span>
				{/if}
			</div>
		{/if}

		{#if proofBadges.length > 0}
			<div class="flex flex-wrap gap-1.5" aria-label="Catalog proof signals">
				{#each proofBadges as badge (badge.key)}
					<span
						class="rounded-full bg-background-tertiary-light/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-background-tertiary-light"
						title={badge.title}
					>
						{badge.label}
					</span>
				{/each}
			</div>
		{/if}

		{#if !compact && tastingNotes}
			<section
				class="rounded-md bg-background-secondary-light px-3 py-2.5 ring-1 ring-border-light"
				aria-label="AI tasting profile"
			>
				<div class="mb-2 flex items-baseline justify-between gap-2">
					<span class="text-[10px] font-semibold uppercase tracking-wider text-text-secondary-light"
						>Tasting profile</span
					>
					<span class="text-[10px] text-text-secondary-light">scale 1–5</span>
				</div>
				<div class="space-y-1">
					{#each TASTING_AXES as axis (axis.key)}
						{@const note = tastingNotes[axis.key]}
						{@const score = clampScore(note?.score)}
						{@const fill = note?.color || '#F9A57B'}
						<div class="flex items-center gap-2">
							<span
								class="w-12 shrink-0 text-[10px] font-medium uppercase tracking-wide text-text-secondary-light"
								>{axis.short}</span
							>
							<div
								class="h-1.5 flex-1 overflow-hidden rounded-full bg-border-light"
								role="progressbar"
								aria-label={axis.label}
								aria-valuenow={score}
								aria-valuemin="0"
								aria-valuemax="5"
							>
								<div
									class="h-full rounded-full"
									style="width: {(score / 5) * 100}%; background-color: {fill};"
								></div>
							</div>
							<span
								class="w-3 shrink-0 text-right text-[10px] font-semibold tabular-nums text-text-primary-light"
								>{score || '–'}</span
							>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		{#if !compact && hasBreakoutContent}
			<details class="card-disclosure -mx-1 rounded-lg ring-1 ring-border-light">
				<summary
					class="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg bg-background-secondary-light px-3 py-2.5 text-sm font-semibold text-text-primary-light transition-colors hover:bg-background-tertiary-light/10 hover:text-background-tertiary-light"
				>
					<span class="flex items-center gap-2">
						<svg
							class="h-4 w-4 text-background-tertiary-light"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							aria-hidden="true"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						<span>Coffee details</span>
						{#if savingsSummary}
							<span
								class="rounded-full bg-background-primary-light px-2 py-0.5 text-[10px] font-medium text-background-tertiary-light ring-1 ring-background-tertiary-light/30"
								>{savingsSummary}</span
							>
						{/if}
					</span>
					<span
						class="card-disclosure__chevron select-none text-text-secondary-light transition-transform"
						aria-hidden="true">▾</span
					>
				</summary>

				<div class="space-y-4 px-3 pb-4 pt-3">
					{#if coffee.ai_description}
						<section>
							<h4
								class="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-secondary-light"
							>
								Description
							</h4>
							<p
								class="whitespace-pre-line border-l-2 border-background-tertiary-light/40 pl-3 text-xs italic leading-relaxed text-text-secondary-light"
							>
								{coffee.ai_description}
							</p>
						</section>
					{/if}

					{#if tastingNotes}
						<section>
							<h4
								class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-secondary-light"
							>
								Full tasting profile
							</h4>
							<div class="flex justify-center">
								{#if isVisible}
									{#if TastingNotesRadar}
										<TastingNotesRadar {tastingNotes} size={220} responsive={true} lazy={true} />
									{:else}
										<ChartSkeleton height="220px" title="Loading tasting profile..." />
									{/if}
								{:else}
									<div style="height: 220px"></div>
								{/if}
							</div>
						</section>
					{/if}

					{#if processAnalysis}
						<section>
							<div class="mb-1.5 flex flex-wrap items-baseline gap-x-2">
								<h4 class="text-xs font-semibold text-text-primary-light">Process analysis</h4>
								<span class="text-xs text-text-secondary-light">{processAnalysis.headline}</span>
							</div>
							{#if processAnalysis.details.length > 0}
								<ul class="space-y-1 text-xs text-text-secondary-light">
									{#each processAnalysis.details as detail}
										<li>{detail}</li>
									{/each}
								</ul>
							{/if}
							{#if processAnalysis.disclosureLabel || processAnalysis.confidenceLabel || processAnalysis.evidenceLabel}
								<div class="mt-2 flex flex-wrap gap-1.5">
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
						</section>
					{/if}

					{#if hasMultiplePriceTiers && priceTiers}
						<section>
							<h4
								class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-secondary-light"
							>
								Volume pricing · {priceTiers.length} tiers
							</h4>
							<div class="grid gap-2 sm:grid-cols-2">
								{#each priceTiers as tier (tier.min_lbs)}
									<div
										class="rounded-md bg-background-primary-light px-3 py-2 ring-1 ring-border-light"
									>
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
						</section>
					{/if}

					{#if auxFacts.length > 0}
						<section>
							<h4
								class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-secondary-light"
							>
								Specs
							</h4>
							<dl class="grid grid-cols-1 gap-x-3 gap-y-1 text-[11px] sm:grid-cols-2">
								{#each auxFacts as fact (fact.label)}
									<div class="flex items-baseline gap-1">
										<dt class="font-medium text-text-primary-light">{fact.label}:</dt>
										<dd class="text-text-secondary-light">{fact.value}</dd>
									</div>
								{/each}
							</dl>
						</section>
					{/if}
				</div>
			</details>
		{/if}

		{#if coffee.link}
			<div class="mt-auto flex items-center justify-end pt-1">
				<a
					href={coffee.link}
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-background-tertiary-light px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-background-tertiary-light focus:ring-offset-2"
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
	</div>
</article>

<style>
	.card-disclosure summary::-webkit-details-marker {
		display: none;
	}
	.card-disclosure[open] > summary .card-disclosure__chevron {
		transform: rotate(180deg);
	}
</style>
