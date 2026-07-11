<script lang="ts">
	import { onMount } from 'svelte';
	import {
		formatCanonicalBaselinePrice,
		formatPriceDelta,
		formatPriceTierSummary
	} from '$lib/utils/pricing';
	import { getCatalogProofBadges, type CatalogProofSummary } from '$lib/catalog/proofSummary';
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
		arrival_date: string | null;
		stocked_date: string | null;
		proof: CatalogProofSummary | null;
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
			arrival_date: string | null;
			stocked_date: string | null;
			proof: CatalogProofSummary | null;
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
			classification?: {
				kind: 'canonical_candidate' | 'similar_recommendation';
				identity_eligibility: 'eligible' | 'blocked' | 'insufficient_evidence';
				confidence: 'high_beta' | 'medium_beta' | 'low_beta';
				blockers: Array<{
					code: string;
					severity: 'hard' | 'soft';
					target_value: string | null;
					candidate_value: string | null;
				}>;
				evidence: string[];
			};
			confidence: 'high_beta' | 'medium_beta' | 'low_beta';
			beta: true;
			language: string;
			same_supplier?: boolean;
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

	function categoryLabel(match: SimilarityMatch): string {
		if (match.match.classification?.kind === 'canonical_candidate') {
			return 'Likely same coffee candidate';
		}
		if (match.match.classification?.kind === 'similar_recommendation') {
			return 'Similar recommendation';
		}
		return match.match.category === 'likely_same'
			? 'Likely same coffee candidate'
			: 'Similar recommendation';
	}

	function blockerLabel(code: string): string {
		if (code === 'processing_base_method_conflict') return 'Processing method differs';
		if (code === 'fermentation_type_conflict') return 'Fermentation type differs';
		if (code === 'country_conflict') return 'Country differs';
		if (code === 'decaf_conflict') return 'Decaf status differs';
		if (code === 'blend_single_origin_conflict') return 'Blend status differs';
		if (code === 'harvest_year_conflict') return 'Harvest year differs';
		if (code === 'insufficient_structured_process')
			return 'Structured process evidence is incomplete';
		return code.replaceAll('_', ' ');
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

	function freshnessLabel(item: {
		stocked_date: string | null;
		arrival_date: string | null;
	}): string | null {
		if (item.stocked_date) return `Stocked: ${item.stocked_date}`;
		if (item.arrival_date) return `Arrival: ${item.arrival_date}`;
		return null;
	}

	function proofBadges(proof: CatalogProofSummary | null | undefined) {
		return proof ? getCatalogProofBadges(proof) : [];
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
			const result = await fetch(`/api/catalog/${coffee.id}/similar?limit=8&stocked_only=true`, {
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
	class="rounded-2xl border border-accent/30 bg-surface-panel p-4 shadow-sm"
	aria-label={`Similar coffee comparison for ${coffee.name}`}
>
	<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
		<div>
			<p class="text-xs font-semibold text-accent">Member comparison beta</p>
			<h4 class="mt-1 text-lg font-semibold text-ink">Similar coffee matches</h4>
			<p class="mt-1 text-sm text-muted">
				Fetched on demand from the canonical similarity endpoint. Treat matches as sourcing leads,
				not accepted bean identities.
			</p>
		</div>
		<div class="flex gap-2">
			<button
				type="button"
				onclick={loadSimilarity}
				class="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-accent hover:text-accent"
			>
				Refresh
			</button>
			{#if onClose}
				<button
					type="button"
					onclick={onClose}
					class="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-accent hover:text-accent"
				>
					Close
				</button>
			{/if}
		</div>
	</div>

	{#if loading}
		<div class="mt-4 rounded-xl border border-line bg-surface-canvas p-4">
			<div class="flex items-center gap-3 text-sm text-muted">
				<div
					class="h-5 w-5 animate-spin rounded-full border-2 border-accent/30 border-t-accent"
				></div>
				<span>Loading beta similarity matches...</span>
			</div>
		</div>
	{:else if errorMessage}
		<div class="mt-4 rounded-xl border border-warning/30 bg-warning-subtle p-4 text-warning-strong">
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
		<div class="mt-4 rounded-xl border border-line bg-surface-canvas p-4">
			<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<p class="text-xs font-semibold text-muted">Target coffee</p>
					<h5 class="mt-1 font-semibold text-ink">{response.data.target.name}</h5>
					<p class="mt-1 text-sm text-muted">
						{response.data.target.source ?? 'Unknown supplier'} · {stockLabel(
							response.data.target.stocked
						)}
					</p>
					<p class="mt-1 text-sm text-muted">
						{[response.data.target.country, response.data.target.origin]
							.filter(Boolean)
							.join(', ') ||
							response.data.target.continent ||
							'Origin unavailable'}
						{response.data.target.processing ? ` · ${response.data.target.processing}` : ''}
					</p>
					{#if freshnessLabel(response.data.target)}
						<p class="mt-1 text-xs text-muted">
							{freshnessLabel(response.data.target)} · date signal, not a quality claim
						</p>
					{/if}
					{#if proofBadges(response.data.target.proof).length > 0}
						<div class="mt-2 flex flex-wrap gap-1.5" aria-label="Target catalog proof signals">
							{#each proofBadges(response.data.target.proof) as badge (badge.key)}
								<span
									class="rounded-full bg-success-subtle px-2 py-0.5 text-[10px] font-semibold text-success-strong ring-1 ring-success/20"
									title={badge.title}
								>
									{badge.label}
								</span>
							{/each}
						</div>
					{/if}
				</div>
				<div class="rounded-xl bg-surface-panel px-4 py-3 text-sm text-muted">
					<div class="text-xs font-semibold">1 lb baseline</div>
					<div class="mt-1 text-lg font-bold text-accent">
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
			<p class="mt-3 rounded-xl bg-accent/10 p-3 text-xs text-muted">
				{response.meta.copy.confidence}
			</p>
		{/if}

		{#if response.data.matches.length === 0}
			<div class="mt-4 rounded-xl border border-line bg-surface-canvas p-4">
				<h5 class="text-sm font-semibold text-ink">No beta matches found</h5>
				<p class="mt-1 text-sm text-muted">
					This coffee may not have enough embeddings yet, or no stocked matches cleared the current
					threshold.
				</p>
			</div>
		{:else}
			<div class="mt-4 space-y-3">
				{#each response.data.matches as match (match.coffee.id)}
					<article class="rounded-xl border border-line bg-surface-canvas p-4">
						<div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
							<div class="min-w-0">
								<div class="flex flex-wrap gap-2">
									<span
										class="rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-semibold text-accent"
									>
										{categoryLabel(match)}
									</span>
									<span
										class="rounded-full bg-success-subtle px-2.5 py-1 text-[11px] font-semibold text-success-strong ring-1 ring-success/20"
									>
										{confidenceLabel(match.match.confidence)}
									</span>
									{#if match.match.same_supplier}
										<span
											class="rounded-full bg-warning-subtle px-2.5 py-1 text-[11px] font-semibold text-warning-strong ring-1 ring-warning/20"
											title="Listed by the same supplier as this coffee — deprioritized so competing suppliers surface first"
										>
											Same supplier
										</span>
									{/if}
								</div>
								<h5 class="mt-2 font-semibold text-ink">{match.coffee.name}</h5>
								<p class="mt-1 text-sm text-muted">
									{match.coffee.source ?? 'Unknown supplier'} · {stockLabel(match.coffee.stocked)}
								</p>
								<p class="mt-1 text-sm text-muted">
									{[match.coffee.country, match.coffee.origin].filter(Boolean).join(', ') ||
										match.coffee.continent ||
										'Origin unavailable'}
									{match.coffee.processing ? ` · ${match.coffee.processing}` : ''}
								</p>
								{#if freshnessLabel(match.coffee)}
									<p class="mt-1 text-xs text-muted">
										{freshnessLabel(match.coffee)} · date signal, not a quality claim
									</p>
								{/if}
								{#if proofBadges(match.coffee.proof).length > 0}
									<div class="mt-2 flex flex-wrap gap-1.5" aria-label="Match catalog proof signals">
										{#each proofBadges(match.coffee.proof) as badge (badge.key)}
											<span
												class="rounded-full bg-success-subtle px-2 py-0.5 text-[10px] font-semibold text-success-strong ring-1 ring-success/20"
												title={badge.title}
											>
												{badge.label}
											</span>
										{/each}
									</div>
								{/if}
								<p class="mt-2 text-sm text-muted">{match.match.language}</p>
								{#if match.match.classification?.blockers?.length}
									<ul
										class="mt-2 space-y-1 text-xs text-warning-strong"
										aria-label="Identity blockers"
									>
										{#each match.match.classification.blockers as blocker}
											<li>
												{blockerLabel(blocker.code)}{blocker.target_value && blocker.candidate_value
													? `: ${blocker.target_value} vs ${blocker.candidate_value}`
													: ''}
											</li>
										{/each}
									</ul>
								{/if}
							</div>
							<div
								class="rounded-xl bg-surface-panel px-4 py-3 text-sm text-muted lg:min-w-[15rem]"
							>
								<div class="text-xs font-semibold">1 lb baseline</div>
								<div class="mt-1 text-lg font-bold text-accent">
									{formatCanonicalBaselinePrice(match.pricing)}
								</div>
								<div class="mt-1 text-xs">
									Source: {priceSourceLabel(match.pricing.baseline_source)}
								</div>
								<div class="mt-1 text-xs">{tierSummary(match.pricing)}</div>
								<div class="mt-2 text-sm font-semibold text-ink">
									{formatPriceDelta(match.price_delta_1lb.amount, match.price_delta_1lb.percent)}
								</div>
							</div>
						</div>

						<div class="mt-4 grid gap-2 text-xs text-muted sm:grid-cols-2 lg:grid-cols-4">
							<div class="rounded-lg bg-surface-panel p-2">
								<span class="font-semibold text-ink">Average:</span>
								{percentScore(match.score.average)}
							</div>
							<div class="rounded-lg bg-surface-panel p-2">
								<span class="font-semibold text-ink">Origin:</span>
								{percentScore(match.score.dimensions.origin)}
							</div>
							<div class="rounded-lg bg-surface-panel p-2">
								<span class="font-semibold text-ink">Process:</span>
								{percentScore(match.score.dimensions.processing)}
							</div>
							<div class="rounded-lg bg-surface-panel p-2">
								<span class="font-semibold text-ink">Tasting:</span>
								{percentScore(match.score.dimensions.tasting)}
							</div>
						</div>

						<div class="mt-3 rounded-lg bg-surface-panel p-3 text-xs text-muted">
							<p class="font-medium text-ink">{match.explanation.summary}</p>
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
