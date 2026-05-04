<script lang="ts">
	import { onMount } from 'svelte';
	import {
		formatCanonicalBaselinePrice,
		formatPriceDelta,
		formatPriceTierSummary
	} from '$lib/utils/pricing';
	import type { CoffeeCatalog } from '$lib/types/component.types';
	import type { Json } from '$lib/types/database.types';

	type BaselineSource = 'price_per_lb' | 'price_tiers' | 'cost_lb' | null;

	type SimilarityPricing = {
		price_per_lb: number | null;
		price_tiers: Json | null;
		cost_lb: number | null;
		baseline_quantity_lbs: 1;
		baseline_price_per_lb: number | null;
		baseline_source: BaselineSource;
	};

	type SimilarityTarget = {
		id: number;
		name: string;
		source: string | null;
		origin: string | null;
		country: string | null;
		continent: string | null;
		processing: string | null;
		processing_base_method: string | null;
		fermentation_type: string | null;
		drying_method: string | null;
		stocked: boolean | null;
		price_per_lb: number | null;
		price_tiers: Json | null;
		cost_lb: number | null;
		pricing: SimilarityPricing;
	};

	type SimilarityMatch = {
		coffee: {
			id: number;
			name: string;
			source: string | null;
			origin: string | null;
			country: string | null;
			continent: string | null;
			processing: string | null;
			processing_base_method: string | null;
			fermentation_type: string | null;
			drying_method: string | null;
			stocked: boolean | null;
		};
		pricing: SimilarityPricing;
		price_delta_1lb: {
			amount: number | null;
			percent: number | null;
			currency: 'USD';
		};
		score: {
			average: number;
			dimensions: {
				origin: number | null;
				processing: number | null;
				tasting: number | null;
			};
			chunk_matches: number;
		};
		match: {
			category: 'likely_same' | 'similar_profile';
			confidence: 'high_beta' | 'medium_beta' | 'low_beta';
			beta: true;
			language: string;
		};
		explanation: {
			summary: string;
			signals: string[];
		};
	};

	type SimilarityResponse = {
		data: {
			target: SimilarityTarget;
			matches: SimilarityMatch[];
		};
		meta: {
			copy?: {
				confidence?: string;
			};
		};
	};

	type SimilarityErrorResponse = {
		error?: string;
		message?: string;
		code?: string;
		teaser?: {
			locked?: boolean;
			similar_match_count?: number | null;
			beta?: boolean;
		};
	};

	let { coffee, onClose } = $props<{
		coffee: CoffeeCatalog;
		onClose?: () => void;
	}>();

	let loading = $state(true);
	let errorMessage = $state<string | null>(null);
	let entitlementTeaser = $state<SimilarityErrorResponse['teaser'] | null>(null);
	let response = $state<SimilarityResponse | null>(null);

	function stockLabel(stocked: boolean | null): string {
		if (stocked === true) return 'In stock';
		if (stocked === false) return 'Out of stock';
		return 'Stock unknown';
	}

	function confidenceLabel(confidence: SimilarityMatch['match']['confidence']): string {
		if (confidence === 'high_beta') return 'High beta confidence';
		if (confidence === 'medium_beta') return 'Medium beta confidence';
		return 'Low beta confidence';
	}

	function categoryLabel(category: SimilarityMatch['match']['category']): string {
		return category === 'likely_same' ? 'Likely same coffee' : 'Similar profile';
	}

	function percentScore(score: number | null): string {
		if (score === null) return 'Not enough data';
		return `${Math.round(score * 100)}%`;
	}

	function priceSourceLabel(source: BaselineSource): string {
		if (source === 'price_per_lb') return 'catalog $/lb';
		if (source === 'price_tiers') return '1 lb tier';
		if (source === 'cost_lb') return 'legacy fallback';
		return 'unavailable';
	}

	function tierSummary(pricing: SimilarityPricing): string {
		return formatPriceTierSummary(pricing.price_tiers) ?? 'No tier summary available';
	}

	async function loadSimilarity() {
		loading = true;
		errorMessage = null;
		entitlementTeaser = null;
		response = null;

		try {
			const result = await fetch(`/v1/catalog/${coffee.id}/similar?limit=8&stocked_only=true`, {
				headers: { Accept: 'application/json' }
			});
			const body = (await result.json()) as SimilarityResponse | SimilarityErrorResponse;

			if (!result.ok) {
				const errorBody = body as SimilarityErrorResponse;
				entitlementTeaser = errorBody.teaser ?? null;
				errorMessage = errorBody.message ?? 'Unable to load similar coffee matches.';
				return;
			}

			response = body as SimilarityResponse;
		} catch {
			errorMessage = 'Unable to load similar coffee matches. Try again in a moment.';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		void loadSimilarity();
	});
</script>

<section
	class="rounded-2xl border border-background-tertiary-light/30 bg-background-secondary-light p-4 shadow-sm"
	aria-label={`Similar coffee comparison for ${coffee.name}`}
>
	<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
		<div>
			<p class="text-xs font-semibold uppercase tracking-wide text-background-tertiary-light">
				Member comparison beta
			</p>
			<h4 class="mt-1 text-lg font-semibold text-text-primary-light">Similar coffee matches</h4>
			<p class="mt-1 text-sm text-text-secondary-light">
				Fetched on demand from the canonical similarity endpoint. Treat matches as sourcing leads,
				not accepted bean identities.
			</p>
		</div>
		<div class="flex gap-2">
			<button
				type="button"
				onclick={loadSimilarity}
				class="rounded-full border border-border-light px-3 py-1.5 text-xs font-semibold text-text-secondary-light transition-colors hover:border-background-tertiary-light hover:text-background-tertiary-light"
			>
				Refresh
			</button>
			{#if onClose}
				<button
					type="button"
					onclick={onClose}
					class="rounded-full border border-border-light px-3 py-1.5 text-xs font-semibold text-text-secondary-light transition-colors hover:border-background-tertiary-light hover:text-background-tertiary-light"
				>
					Close
				</button>
			{/if}
		</div>
	</div>

	{#if loading}
		<div class="mt-4 rounded-xl border border-border-light bg-background-primary-light p-4">
			<div class="flex items-center gap-3 text-sm text-text-secondary-light">
				<div
					class="h-5 w-5 animate-spin rounded-full border-2 border-background-tertiary-light/30 border-t-background-tertiary-light"
				></div>
				<span>Loading beta similarity matches...</span>
			</div>
		</div>
	{:else if errorMessage}
		<div class="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
			<h5 class="text-sm font-semibold">Comparison unavailable</h5>
			<p class="mt-1 text-sm">{errorMessage}</p>
			{#if entitlementTeaser}
				<p class="mt-2 text-xs">
					{entitlementTeaser.similar_match_count === null ||
					entitlementTeaser.similar_match_count === undefined
						? 'Upgrade to unlock beta match details.'
						: `${entitlementTeaser.similar_match_count} beta match${entitlementTeaser.similar_match_count === 1 ? '' : 'es'} may be available after upgrade.`}
				</p>
			{/if}
		</div>
	{:else if response}
		<div class="mt-4 rounded-xl border border-border-light bg-background-primary-light p-4">
			<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<p class="text-xs font-semibold uppercase tracking-wide text-text-secondary-light">
						Target coffee
					</p>
					<h5 class="mt-1 font-semibold text-text-primary-light">{response.data.target.name}</h5>
					<p class="mt-1 text-sm text-text-secondary-light">
						{response.data.target.source ?? 'Unknown supplier'} · {stockLabel(
							response.data.target.stocked
						)}
					</p>
					<p class="mt-1 text-sm text-text-secondary-light">
						{[response.data.target.country, response.data.target.origin]
							.filter(Boolean)
							.join(', ') ||
							response.data.target.continent ||
							'Origin unavailable'}
						{response.data.target.processing ? ` · ${response.data.target.processing}` : ''}
					</p>
				</div>
				<div
					class="rounded-xl bg-background-secondary-light px-4 py-3 text-sm text-text-secondary-light"
				>
					<div class="text-xs font-semibold uppercase tracking-wide">1 lb baseline</div>
					<div class="mt-1 text-lg font-bold text-background-tertiary-light">
						{formatCanonicalBaselinePrice(response.data.target.pricing)}
					</div>
					<div class="mt-1 text-xs">
						Source: {priceSourceLabel(response.data.target.pricing.baseline_source)}
					</div>
					<div class="mt-1 text-xs">{tierSummary(response.data.target.pricing)}</div>
				</div>
			</div>
		</div>

		{#if response.meta.copy?.confidence}
			<p
				class="mt-3 rounded-xl bg-background-tertiary-light/10 p-3 text-xs text-text-secondary-light"
			>
				{response.meta.copy.confidence}
			</p>
		{/if}

		{#if response.data.matches.length === 0}
			<div class="mt-4 rounded-xl border border-border-light bg-background-primary-light p-4">
				<h5 class="text-sm font-semibold text-text-primary-light">No beta matches found</h5>
				<p class="mt-1 text-sm text-text-secondary-light">
					This coffee may not have enough embeddings yet, or no stocked matches cleared the current
					threshold.
				</p>
			</div>
		{:else}
			<div class="mt-4 space-y-3">
				{#each response.data.matches as match (match.coffee.id)}
					<article class="rounded-xl border border-border-light bg-background-primary-light p-4">
						<div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
							<div class="min-w-0">
								<div class="flex flex-wrap gap-2">
									<span
										class="rounded-full bg-background-tertiary-light/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-background-tertiary-light"
									>
										{categoryLabel(match.match.category)}
									</span>
									<span
										class="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-100"
									>
										{confidenceLabel(match.match.confidence)}
									</span>
								</div>
								<h5 class="mt-2 font-semibold text-text-primary-light">{match.coffee.name}</h5>
								<p class="mt-1 text-sm text-text-secondary-light">
									{match.coffee.source ?? 'Unknown supplier'} · {stockLabel(match.coffee.stocked)}
								</p>
								<p class="mt-1 text-sm text-text-secondary-light">
									{[match.coffee.country, match.coffee.origin].filter(Boolean).join(', ') ||
										match.coffee.continent ||
										'Origin unavailable'}
									{match.coffee.processing ? ` · ${match.coffee.processing}` : ''}
								</p>
								<p class="mt-2 text-sm text-text-secondary-light">{match.match.language}</p>
							</div>
							<div
								class="rounded-xl bg-background-secondary-light px-4 py-3 text-sm text-text-secondary-light lg:min-w-[15rem]"
							>
								<div class="text-xs font-semibold uppercase tracking-wide">1 lb baseline</div>
								<div class="mt-1 text-lg font-bold text-background-tertiary-light">
									{formatCanonicalBaselinePrice(match.pricing)}
								</div>
								<div class="mt-1 text-xs">
									Source: {priceSourceLabel(match.pricing.baseline_source)}
								</div>
								<div class="mt-1 text-xs">{tierSummary(match.pricing)}</div>
								<div class="mt-2 text-sm font-semibold text-text-primary-light">
									{formatPriceDelta(match.price_delta_1lb.amount, match.price_delta_1lb.percent)}
								</div>
							</div>
						</div>

						<div
							class="mt-4 grid gap-2 text-xs text-text-secondary-light sm:grid-cols-2 lg:grid-cols-4"
						>
							<div class="rounded-lg bg-background-secondary-light p-2">
								<span class="font-semibold text-text-primary-light">Average:</span>
								{percentScore(match.score.average)}
							</div>
							<div class="rounded-lg bg-background-secondary-light p-2">
								<span class="font-semibold text-text-primary-light">Origin:</span>
								{percentScore(match.score.dimensions.origin)}
							</div>
							<div class="rounded-lg bg-background-secondary-light p-2">
								<span class="font-semibold text-text-primary-light">Process:</span>
								{percentScore(match.score.dimensions.processing)}
							</div>
							<div class="rounded-lg bg-background-secondary-light p-2">
								<span class="font-semibold text-text-primary-light">Tasting:</span>
								{percentScore(match.score.dimensions.tasting)}
							</div>
						</div>

						<div
							class="mt-3 rounded-lg bg-background-secondary-light p-3 text-xs text-text-secondary-light"
						>
							<p class="font-medium text-text-primary-light">{match.explanation.summary}</p>
							{#if match.explanation.signals.length > 0}
								<ul class="mt-2 list-disc space-y-1 pl-4">
									{#each match.explanation.signals as signal}
										<li>{signal}</li>
									{/each}
								</ul>
							{/if}
							<p class="mt-2">
								Chunk evidence: {match.score.chunk_matches} matched embedding chunk{match.score
									.chunk_matches === 1
									? ''
									: 's'}.
							</p>
						</div>
					</article>
				{/each}
			</div>
		{/if}
	{/if}
</section>
