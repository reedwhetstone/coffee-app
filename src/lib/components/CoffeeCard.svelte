<script lang="ts">
	import type { Component } from 'svelte';
	import ChartSkeleton from '$lib/components/ChartSkeleton.svelte';
	import { formatPricePerLb, getDisplayPrice, parsePriceTiers } from '$lib/utils/pricing';
	import type { TastingNotes } from '$lib/types/coffee.types';
	import type { CoffeeCatalog } from '$lib/types/component.types';

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

	// Lazy load the tasting notes radar component
	let TastingNotesRadar = $state<Component | null>(null);
	let radarComponentLoading = $state(true);
	let showTierPopover = $state(false);

	// Load radar component after initial render
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
		}, 250); // Further delayed for catalog cards
	});

	// Parse tasting notes for this coffee
	let tastingNotes = $derived(parseTastingNotes(coffee.ai_tasting_notes));

	let priceTiers = $derived(parsePriceTiers(coffee.price_tiers));
	let displayPrice = $derived(getDisplayPrice(coffee));
	let priceText = $derived(
		displayPrice != null ? formatPricePerLb(displayPrice) : 'Price unavailable'
	);
	let hasTierPopover = $derived((priceTiers?.length ?? 0) > 1);

	function toggleTierPopover(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		showTierPopover = !showTierPopover;
	}

	// Debug logging (preserved from original)
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
		<!-- Compact mode: condensed for chat context -->
		{#if annotation}
			<p class="mb-2 text-sm italic text-text-secondary-light">{annotation}</p>
		{/if}
		<div>
			<div class="flex items-start justify-between gap-2">
				<h3 class="font-semibold text-text-primary-light">{coffee.name}</h3>
				{#if coffee.link}
					<a
						href={coffee.link}
						target="_blank"
						rel="noopener noreferrer"
						class="shrink-0 text-text-secondary-light transition-colors hover:text-background-tertiary-light"
						aria-label={`Open supplier link for ${coffee.name}`}
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
			</div>
			<div class="mt-1 flex items-center justify-between gap-2">
				<div class="flex items-center gap-2">
					<span class="text-sm font-medium text-background-tertiary-light">{coffee.source}</span>
					{#if coffee.wholesale}
						<span
							class="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700"
							>Wholesale</span
						>
					{/if}
				</div>
				<span class="shrink-0 font-bold text-background-tertiary-light">{priceText}</span>
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
		</div>
	{:else}
		<!-- Full mode: detailed card for catalog/home pages -->
		{#if annotation}
			<p class="mb-2 text-sm italic text-background-tertiary-light">{annotation}</p>
		{/if}
		<div class="flex flex-col space-y-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
			<!-- Content section -->
			<div class="flex-1">
				<div class="flex items-start justify-between gap-2">
					<h3
						class="font-semibold text-text-primary-light group-hover:text-background-tertiary-light"
					>
						{coffee.name}
					</h3>
					{#if coffee.link}
						<a
							href={coffee.link}
							target="_blank"
							rel="noopener noreferrer"
							class="shrink-0 text-text-secondary-light transition-colors hover:text-background-tertiary-light"
							aria-label={`Open supplier link for ${coffee.name}`}
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
				</div>

				<div class="mt-1 flex items-center justify-between gap-2">
					<div class="flex items-center gap-2">
						<p class="text-sm font-medium text-background-tertiary-light">{coffee.source}</p>
						{#if coffee.wholesale}
							<span
								class="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700"
								>Wholesale</span
							>
						{/if}
					</div>

					<!-- Mobile: Price next to supplier name -->
					<div class="sm:hidden">
						<div class="group/tier relative flex items-center gap-1">
							<div class="font-bold text-background-tertiary-light">{priceText}</div>
							{#if hasTierPopover}
								<button
									type="button"
									onclick={toggleTierPopover}
									class="rounded p-0.5 text-text-secondary-light transition-colors hover:text-background-tertiary-light"
									aria-label={`Show volume pricing for ${coffee.name}`}
								>
									<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
										/>
									</svg>
								</button>

								<div
									class="absolute right-0 top-full z-20 mt-2 w-44 rounded-md border border-border-light bg-background-primary-light p-2 text-xs shadow-lg transition-opacity duration-150 {showTierPopover
										? 'pointer-events-auto opacity-100'
										: 'pointer-events-none opacity-0'} md:group-hover/tier:pointer-events-auto md:group-hover/tier:opacity-100"
								>
									<div class="mb-1 font-semibold text-text-primary-light">Volume Pricing</div>
									{#if priceTiers}
										{#each priceTiers as tier (tier.min_lbs)}
											<div class="flex justify-between py-0.5 text-text-secondary-light">
												<span>{tier.min_lbs}+ lb</span>
												<span class="font-medium text-text-primary-light"
													>{formatPricePerLb(tier.price)}</span
												>
											</div>
										{/each}
									{/if}
								</div>
							{/if}
						</div>
					</div>
				</div>

				{#if coffee.ai_description}
					<p class="my-4 whitespace-pre-wrap text-xs text-text-secondary-light">
						{coffee.ai_description}
					</p>
				{/if}

				<!-- Mobile: Chart full width -->
				{#if tastingNotes}
					<div class="mt-2 px-6 sm:hidden">
						{#if radarComponentLoading}
							<ChartSkeleton height="300px" title="Loading tasting profile..." />
						{:else if TastingNotesRadar}
							<TastingNotesRadar {tastingNotes} size={300} responsive={true} lazy={true} />
						{/if}
					</div>
				{/if}

				<div class="mt-3 flex-col gap-2 text-xs text-text-secondary-light sm:grid-cols-2">
					<div>
						<span class="font-medium">Location:</span>
						{[coffee.continent, coffee.country, coffee.region].filter(Boolean).join(' > ') || '-'}
					</div>
					<div>
						{#if coffee.processing}
							<span>Processing: {coffee.processing}</span>
						{/if}
					</div>
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

			<!-- Desktop: Price and chart in sidebar -->
			<div class="hidden flex-col items-end space-y-2 sm:flex">
				<div class="group/tier relative text-right">
					<div class="flex items-center justify-end gap-1">
						<div class="font-bold text-background-tertiary-light">{priceText}</div>
						{#if hasTierPopover}
							<button
								type="button"
								onclick={toggleTierPopover}
								class="rounded p-0.5 text-text-secondary-light transition-colors hover:text-background-tertiary-light"
								aria-label={`Show volume pricing for ${coffee.name}`}
							>
								<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
							</button>
						{/if}
					</div>

					{#if hasTierPopover}
						<div
							class="absolute right-0 top-full z-20 mt-2 w-44 rounded-md border border-border-light bg-background-primary-light p-2 text-left text-xs shadow-lg transition-opacity duration-150 {showTierPopover
								? 'pointer-events-auto opacity-100'
								: 'pointer-events-none opacity-0'} md:group-hover/tier:pointer-events-auto md:group-hover/tier:opacity-100"
						>
							<div class="mb-1 font-semibold text-text-primary-light">Volume Pricing</div>
							{#if priceTiers}
								{#each priceTiers as tier (tier.min_lbs)}
									<div class="flex justify-between py-0.5 text-text-secondary-light">
										<span>{tier.min_lbs}+ lb</span>
										<span class="font-medium text-text-primary-light"
											>{formatPricePerLb(tier.price)}</span
										>
									</div>
								{/each}
							{/if}
						</div>
					{/if}
				</div>

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
