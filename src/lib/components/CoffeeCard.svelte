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
	};

	type ProcessAnalysis = {
		headline: string;
		details: string[];
		confidenceLabel: string | null;
		disclosureLabel: string | null;
		evidenceLabel: string | null;
	};

	let TastingNotesRadar = $state<Component | null>(null);
	let radarComponentLoading = $state(true);
	let showPricingDetails = $state(false);

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
	let processAnalysis = $derived.by(() =>
		buildProcessAnalysis(coffee as CoffeeWithStructuredProcess)
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

	function togglePricingDetails(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		showPricingDetails = !showPricingDetails;
	}

	$effect(() => {
		if (coffee.ai_tasting_notes && !tastingNotes) {
			console.log(
				'Debug - Raw ai_tasting_notes:',
				coffee.ai_tasting_notes,
				'Type:',
				typeof coffee.ai_tasting_notes
			);
		}
	});
</script>

<div
	class="group relative rounded-lg bg-background-primary-light text-left shadow-sm ring-1 transition-all hover:ring-background-tertiary-light {highlighted
		? 'border-l-4 border-background-tertiary-light ring-background-tertiary-light/40'
		: 'ring-border-light'} {compact ? 'p-3' : 'p-4'} {compact ? '' : 'hover:scale-[1.02]'}"
>
	{#if compact}
		{#if annotation}
			<p class="mb-2 text-sm italic text-text-secondary-light">{annotation}</p>
		{/if}
		<div>
			<div class="flex items-start justify-between gap-2">
				<h3 class="font-semibold text-text-primary-light">{coffee.name}</h3>
				<span class="shrink-0 font-bold text-background-tertiary-light">{priceText}</span>
			</div>
			<div class="mt-1 flex items-center gap-2">
				<span class="text-sm font-medium text-background-tertiary-light">{coffee.source}</span>
				{#if coffee.wholesale}
					<span
						class="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700"
						>Wholesale</span
					>
				{/if}
			</div>
			<div class="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-text-secondary-light">
				<span
					>{[coffee.country, coffee.region].filter(Boolean).join(', ') ||
						coffee.continent ||
						'-'}</span
				>
				{#if coffee.processing}
					<span>{coffee.processing}</span>
				{/if}
			</div>

			{#if processAnalysis}
				<p class="mt-2 text-xs font-medium text-background-tertiary-light">
					{processAnalysis.headline}
				</p>
			{/if}

			<div class="mt-3 flex flex-wrap gap-2">
				{#if hasMultiplePriceTiers}
					<button
						type="button"
						onclick={togglePricingDetails}
						class="inline-flex items-center gap-2 rounded-full border border-border-light px-3 py-1.5 text-sm font-medium text-text-primary-light transition-colors hover:border-background-tertiary-light hover:text-background-tertiary-light"
						aria-expanded={showPricingDetails}
					>
						<span>{showPricingDetails ? 'Hide volume pricing' : 'View volume pricing'}</span>
						<span class="text-xs text-text-secondary-light">{priceTiers?.length} tiers</span>
					</button>
				{/if}
				{#if coffee.link}
					<a
						href={coffee.link}
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center gap-2 rounded-full bg-background-tertiary-light px-3 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
						aria-label={`Open supplier page for ${coffee.name}`}
					>
						<span>Open supplier page</span>
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
			</div>

			{#if hasMultiplePriceTiers && showPricingDetails && priceTiers}
				<div
					class="mt-3 rounded-xl border border-border-light bg-background-secondary-light/60 p-3"
				>
					<div class="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary-light">
						Volume pricing
					</div>
					<div class="grid gap-2 sm:grid-cols-2">
						{#each priceTiers as tier (tier.min_lbs)}
							<div
								class="rounded-lg bg-background-primary-light p-2.5 shadow-sm ring-1 ring-border-light"
							>
								<div
									class="text-[11px] font-medium uppercase tracking-wide text-text-secondary-light"
								>
									{tier.min_lbs}+ lb
								</div>
								<div class="mt-1 text-sm font-semibold text-text-primary-light">
									{formatPricePerLb(tier.price)}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{:else}
		{#if annotation}
			<p class="mb-2 text-sm italic text-background-tertiary-light">{annotation}</p>
		{/if}
		<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
			<div class="flex-1">
				<div class="flex items-start justify-between gap-3">
					<div>
						<h3
							class="font-semibold text-text-primary-light group-hover:text-background-tertiary-light"
						>
							{coffee.name}
						</h3>
						<div class="mt-1 flex flex-wrap items-center gap-2">
							<p class="text-sm font-medium text-background-tertiary-light">{coffee.source}</p>
							{#if coffee.wholesale}
								<span
									class="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700"
									>Wholesale</span
								>
							{/if}
						</div>
					</div>
				</div>

				{#if coffee.ai_description}
					<p class="mt-4 whitespace-pre-wrap text-xs text-text-secondary-light">
						{coffee.ai_description}
					</p>
				{/if}

				<div
					class="mt-4 rounded-2xl border border-border-light bg-background-secondary-light/70 p-4 shadow-sm"
				>
					<div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
						<div class="min-w-0">
							<div class="text-xs font-semibold uppercase tracking-wide text-text-secondary-light">
								{hasMultiplePriceTiers ? 'Starts at' : 'Price'}
							</div>
							<div class="mt-1 flex flex-wrap items-center gap-2">
								<div class="text-2xl font-bold text-background-tertiary-light">{priceText}</div>
								{#if savingsSummary}
									<span
										class="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700"
									>
										{savingsSummary}
									</span>
								{/if}
							</div>
							{#if tierSummary}
								<p class="mt-2 text-sm text-text-secondary-light">{tierSummary}</p>
							{/if}
						</div>

						<div class="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[13rem]">
							{#if hasMultiplePriceTiers}
								<button
									type="button"
									onclick={togglePricingDetails}
									class="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border-light px-4 py-2.5 text-sm font-semibold text-text-primary-light transition-colors hover:border-background-tertiary-light hover:text-background-tertiary-light"
									aria-expanded={showPricingDetails}
								>
									<span>{showPricingDetails ? 'Hide volume pricing' : 'View volume pricing'}</span>
									<span class="text-xs text-text-secondary-light">{priceTiers?.length} tiers</span>
								</button>
							{/if}
							{#if coffee.link}
								<a
									href={coffee.link}
									target="_blank"
									rel="noopener noreferrer"
									class="inline-flex w-full items-center justify-center gap-2 rounded-full bg-background-tertiary-light px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
									aria-label={`Open supplier page for ${coffee.name}`}
								>
									<span>Open supplier page</span>
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
						</div>
					</div>

					{#if hasMultiplePriceTiers && showPricingDetails && priceTiers}
						<div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
							{#each priceTiers as tier (tier.min_lbs)}
								<div
									class="rounded-xl bg-background-primary-light p-3 shadow-sm ring-1 ring-border-light"
								>
									<div
										class="text-[11px] font-semibold uppercase tracking-wide text-text-secondary-light"
									>
										{tier.min_lbs}+ lb
									</div>
									<div class="mt-1 text-base font-semibold text-text-primary-light">
										{formatPricePerLb(tier.price)}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				{#if tastingNotes}
					<div class="mt-4 px-6 sm:hidden">
						{#if radarComponentLoading}
							<ChartSkeleton height="300px" title="Loading tasting profile..." />
						{:else if TastingNotesRadar}
							<TastingNotesRadar {tastingNotes} size={300} responsive={true} lazy={true} />
						{/if}
					</div>
				{/if}

				<div class="mt-4 grid gap-2 text-xs text-text-secondary-light sm:grid-cols-2">
					<div>
						<span class="font-medium">Location:</span>
						{[coffee.continent, coffee.country, coffee.region].filter(Boolean).join(' > ') || '-'}
					</div>
					<div>
						{#if coffee.processing}
							<span>Processing: {coffee.processing}</span>
						{/if}
					</div>

					{#if processAnalysis}
						<div class="sm:col-span-2">
							<div
								class="rounded-xl border border-background-tertiary-light/20 bg-background-tertiary-light/5 p-3 text-text-secondary-light"
							>
								<div
									class="text-xs font-semibold uppercase tracking-wide text-background-tertiary-light"
								>
									Process analysis
								</div>
								<p class="mt-1 font-medium text-text-primary-light">{processAnalysis.headline}</p>
								{#if processAnalysis.details.length > 0}
									<ul class="mt-2 space-y-1">
										{#each processAnalysis.details as detail}
											<li>{detail}</li>
										{/each}
									</ul>
								{/if}
								<div class="mt-2 flex flex-wrap gap-2">
									{#if processAnalysis.disclosureLabel}
										<span
											class="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-text-secondary-light ring-1 ring-border-light"
										>
											{processAnalysis.disclosureLabel}
										</span>
									{/if}
									{#if processAnalysis.confidenceLabel}
										<span
											class="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-text-secondary-light ring-1 ring-border-light"
										>
											{processAnalysis.confidenceLabel}
										</span>
									{/if}
									{#if processAnalysis.evidenceLabel}
										<span
											class="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-text-secondary-light ring-1 ring-border-light"
										>
											{processAnalysis.evidenceLabel}
										</span>
									{/if}
								</div>
							</div>
						</div>
					{/if}
					<div>
						{#if coffee.cultivar_detail}
							<span>Cultivar: {coffee.cultivar_detail}</span>
						{/if}
					</div>
					<div>
						{#if coffee.grade}
							<span>Elevation: {coffee.grade}</span>
						{/if}
					</div>
					<div>
						{#if coffee.appearance}
							<span>Appearance: {coffee.appearance}</span>
						{/if}
					</div>
					<div>
						{#if coffee.type}
							<span>Importer: {coffee.type}</span>
						{/if}
					</div>
					<div>
						{#if coffee.arrival_date}
							<span>Arrival: {coffee.arrival_date}</span>
						{/if}
					</div>
					<div>
						{#if coffee.stocked_date}
							<span>Stocked: {coffee.stocked_date}</span>
						{/if}
					</div>
				</div>
			</div>

			<div class="hidden shrink-0 sm:block sm:w-[200px]">
				{#if tastingNotes}
					<div class="pt-4">
						{#if radarComponentLoading}
							<ChartSkeleton height="180px" title="Loading tasting profile..." />
						{:else if TastingNotesRadar}
							<TastingNotesRadar {tastingNotes} size={180} lazy={true} />
						{/if}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
