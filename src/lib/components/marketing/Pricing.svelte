<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { SELF_SERVE_PLANS, type SelfServePlan } from '$lib/billing/selfServePlans';
	import { trackBillingOfferEvent } from '$lib/billing/offerAnalytics';
	import SelfServePlanCard from './SelfServePlanCard.svelte';
	import type { PageAuthView } from '$lib/types/auth.types';

	let { auth } = $props<{ auth: PageAuthView }>();
	let isSignedIn = $derived(auth.isSignedIn);
	let pricingSection: HTMLElement | null = null;
	let impressionsTracked = false;

	function trackPricingImpressions() {
		if (impressionsTracked) return;
		impressionsTracked = true;
		for (const plan of SELF_SERVE_PLANS) {
			trackBillingOfferEvent('billing_offer_impression', plan.offer.offerId);
		}
	}

	onMount(() => {
		if (!pricingSection || typeof IntersectionObserver === 'undefined') return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					trackPricingImpressions();
					observer.disconnect();
				}
			},
			{ threshold: 0.1 }
		);

		observer.observe(pricingSection);
		return () => observer.disconnect();
	});

	function handleSelectPlan(plan: SelfServePlan) {
		goto(`/subscription?plan=${plan.offer.offerId}&intent=checkout`);
	}

	function ctaLabel(plan: SelfServePlan) {
		if (plan.id === 'both') return 'Choose both';
		return `${isSignedIn ? 'Start' : 'Choose'} ${plan.id === 'studio' ? 'Studio' : 'Intelligence'}`;
	}
</script>

<section
	bind:this={pricingSection}
	id="pricing"
	class="scroll-mt-24 border-y border-line bg-surface-panel py-16 sm:py-20"
>
	<div class="mx-auto max-w-7xl px-6 lg:px-8">
		<div class="mx-auto max-w-3xl text-center">
			<h2 class="text-sm font-semibold leading-7 text-organic-rust">Simple self-serve plans</h2>
			<p class="mt-2 font-serif text-4xl font-medium tracking-tight text-ink sm:text-5xl">
				Deploy Cherry AI across your coffee operation.
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
	</div>
</section>
