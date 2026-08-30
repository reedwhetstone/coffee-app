<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { SELF_SERVE_PLANS, type SelfServePlan } from '$lib/billing/selfServePlans';
	import { trackBillingOfferEvent } from '$lib/billing/offerAnalytics';
	import SelfServePlanCard from './SelfServePlanCard.svelte';
	import type { PageAuthView } from '$lib/types/auth.types';

	let { auth } = $props<{ auth: PageAuthView }>();
	let isSignedIn = $derived(auth.isSignedIn);

	onMount(() => {
		for (const plan of SELF_SERVE_PLANS) {
			trackBillingOfferEvent('billing_offer_impression', plan.offer.offerId);
		}
	});

	function handleSelectPlan(plan: SelfServePlan) {
		goto(`/subscription?plan=${plan.offer.offerId}&intent=checkout`);
	}

	function ctaLabel(plan: SelfServePlan) {
		if (plan.id === 'both') return 'Choose both';
		return `${isSignedIn ? 'Start' : 'Choose'} ${plan.id === 'studio' ? 'Studio' : 'Intelligence'}`;
	}
</script>

<section id="pricing" class="scroll-mt-24 bg-surface-panel py-16 sm:py-20">
	<div class="mx-auto max-w-7xl px-6 lg:px-8">
		<div class="mx-auto max-w-3xl text-center">
			<h2 class="text-base font-semibold leading-7 text-accent">Simple self-serve plans</h2>
			<p class="mt-2 font-serif text-4xl font-medium tracking-tight text-ink sm:text-5xl">
				Choose the context Ask Parchment brings to the work.
			</p>
			<p class="mt-5 text-lg leading-8 text-muted">
				Intelligence understands the outside market. Studio understands your own roastery. Both
				connect the sourcing decision to what happens after the coffee arrives.
			</p>
			<p class="mt-3 text-sm font-medium text-success-strong">
				Eligible accounts receive one five-day free trial on their first self-serve paid plan.
			</p>
		</div>

		<div class="mx-auto mt-10 grid max-w-6xl gap-5 lg:grid-cols-3 lg:items-stretch">
			{#each SELF_SERVE_PLANS as plan (plan.id)}
				<SelfServePlanCard {plan} ctaLabel={ctaLabel(plan)} onChoose={handleSelectPlan} />
			{/each}
		</div>

		<div class="mx-auto mt-6 grid max-w-6xl gap-4 lg:grid-cols-[1.35fr_1fr]">
			<div
				class="flex flex-col justify-between gap-5 rounded-2xl border border-line bg-surface-canvas p-6 sm:flex-row sm:items-center"
			>
				<div>
					<p class="text-xs font-semibold text-accent">Developer access</p>
					<h3 class="mt-2 text-lg font-semibold text-ink">Building with green coffee data?</h3>
					<p class="mt-1 text-sm leading-6 text-muted">
						Parchment API has separate Green, Origin, and Enterprise tiers for applications, sync
						jobs, and agents.
					</p>
				</div>
				<a
					href="/api#plans"
					class="shrink-0 rounded-xl border border-line px-4 py-3 text-center text-sm font-semibold text-ink transition-colors hover:border-accent/50 hover:text-accent"
				>
					See API plans
				</a>
			</div>

			<div
				class="flex flex-col justify-between gap-5 rounded-2xl border border-line bg-surface-canvas p-6 sm:flex-row sm:items-center"
			>
				<div>
					<p class="text-xs font-semibold text-muted">Custom needs</p>
					<h3 class="mt-2 text-lg font-semibold text-ink">Need tailored delivery or support?</h3>
				</div>
				<a
					href="/contact"
					class="shrink-0 rounded-xl bg-ink px-4 py-3 text-center text-sm font-semibold text-surface-canvas transition-opacity hover:opacity-90"
				>
					Contact sales
				</a>
			</div>
		</div>
	</div>
</section>
