<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { BILLING_OFFERS } from '$lib/billing/offers';
	import { trackBillingOfferEvent } from '$lib/billing/offerAnalytics';
	import type { PageAuthView } from '$lib/types/auth.types';

	let { auth } = $props<{
		auth: PageAuthView;
	}>();

	let isSignedIn = $derived(auth.isSignedIn);

	onMount(() => {
		for (const offer of [
			BILLING_OFFERS.studioMonthly,
			BILLING_OFFERS.intelligenceMonthly,
			BILLING_OFFERS.bothMonthly
		]) {
			trackBillingOfferEvent('billing_offer_impression', offer.offerId);
		}
	});

	function handleSelectPlan(plan: 'studio' | 'intelligence' | 'both') {
		const offerId =
			plan === 'intelligence'
				? BILLING_OFFERS.intelligenceMonthly.offerId
				: plan === 'both'
					? BILLING_OFFERS.bothMonthly.offerId
					: BILLING_OFFERS.studioMonthly.offerId;
		goto(`/subscription?plan=${offerId}&intent=checkout`);
	}
</script>

<section id="pricing" class="scroll-mt-24 bg-surface-panel py-16 sm:py-20">
	<div class="mx-auto max-w-7xl px-6 lg:px-8">
		<div class="mx-auto max-w-3xl text-center">
			<h2 class="text-base font-semibold leading-7 text-accent">Simple self-serve plans</h2>
			<p class="mt-2 font-serif text-4xl font-medium tracking-tight text-ink sm:text-5xl">
				Choose the tools that match your work.
			</p>
			<p class="mt-5 text-lg leading-8 text-muted">
				Intelligence for sourcing decisions. Studio for roaster operations. Both when you want the
				market view and your production workflow together.
			</p>
			<p class="mt-3 text-sm font-medium text-success-strong">
				Eligible accounts receive one five-day free trial on their first self-serve paid plan.
			</p>
		</div>

		<div class="mx-auto mt-10 grid max-w-6xl gap-5 lg:grid-cols-3 lg:items-stretch">
			<div
				class="order-2 flex h-full flex-col rounded-3xl border border-accent/40 bg-surface-canvas p-6 shadow-sm transition-colors hover:border-accent sm:p-8 lg:order-1"
			>
				<div class="flex items-start justify-between gap-4">
					<div>
						<p class="text-xs font-semibold uppercase tracking-wide text-accent">
							For coffee buyers
						</p>
						<h3 class="mt-2 text-2xl font-semibold text-ink">Parchment Intelligence</h3>
					</div>
					<span class="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
						Market view
					</span>
				</div>
				<p class="mt-4 text-sm leading-6 text-muted">
					Ask Parchment about the market, compare suppliers, follow arrivals and delistings, and
					understand origin-level price movement before you buy.
				</p>
				<p class="mt-6 flex items-baseline gap-1">
					<span class="text-4xl font-bold tracking-tight text-ink"
						>{BILLING_OFFERS.intelligenceMonthly.price}</span
					>
					<span class="text-sm font-semibold text-muted"
						>{BILLING_OFFERS.intelligenceMonthly.interval}</span
					>
				</p>
				<p class="mt-2 text-sm text-muted">Five-day free trial if eligible.</p>
				<ul class="mt-6 space-y-3 text-sm leading-6 text-muted">
					<li>Ask Parchment AI chat for sourcing and market questions</li>
					<li>Supplier comparisons and health signals</li>
					<li>Arrivals, delistings, and price history</li>
				</ul>
				<div class="mt-auto pt-8">
					<button
						onclick={() => handleSelectPlan('intelligence')}
						class="w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-ink transition-opacity hover:opacity-90"
					>
						{isSignedIn ? 'Start Intelligence' : 'Choose Intelligence'}
					</button>
					<a
						href="/subscription#intelligence-details"
						class="mt-3 block text-center text-sm font-medium text-muted underline underline-offset-4 transition-colors hover:text-ink"
					>
						Learn more
					</a>
				</div>
			</div>

			<div
				class="order-1 flex h-full flex-col rounded-3xl border-2 border-success bg-surface-canvas p-6 shadow-md sm:p-8 lg:order-2"
			>
				<div class="flex items-start justify-between gap-4">
					<div>
						<p class="text-xs font-semibold uppercase tracking-wide text-success-strong">
							For teams that buy and roast
						</p>
						<h3 class="mt-2 text-2xl font-semibold text-ink">Studio + Intelligence</h3>
					</div>
					<span
						class="rounded-full bg-success-subtle px-3 py-1 text-xs font-semibold text-success-strong"
					>
						Best value
					</span>
				</div>
				<p class="mt-4 text-sm leading-6 text-muted">
					See the whole market, bring those decisions into inventory, roast, tasting, and margin
					workflows, and ask Parchment across both.
				</p>
				<p class="mt-6 flex items-baseline gap-1">
					<span class="text-4xl font-bold tracking-tight text-ink"
						>{BILLING_OFFERS.bothMonthly.price}</span
					>
					<span class="text-sm font-semibold text-muted">{BILLING_OFFERS.bothMonthly.interval}</span
					>
				</p>
				<p class="mt-2 text-sm text-muted">Five-day free trial if eligible. Save $2/month.</p>
				<ul class="mt-6 space-y-3 text-sm leading-6 text-muted">
					<li>Everything in Intelligence</li>
					<li>Everything in Mallard Studio</li>
					<li>Ask Parchment across market and roaster workflows</li>
				</ul>
				<div class="mt-auto pt-8">
					<button
						onclick={() => handleSelectPlan('both')}
						class="w-full rounded-xl bg-success px-4 py-3 text-sm font-semibold text-ink transition-opacity hover:opacity-90"
					>
						Choose both
					</button>
					<a
						href="/subscription#both-details"
						class="mt-3 block text-center text-sm font-medium text-muted underline underline-offset-4 transition-colors hover:text-ink"
					>
						Learn more
					</a>
				</div>
			</div>

			<div
				class="order-3 flex h-full flex-col rounded-3xl border border-line bg-surface-canvas p-6 shadow-sm transition-colors hover:border-accent/50 sm:p-8"
			>
				<div class="flex items-start justify-between gap-4">
					<div>
						<p class="text-xs font-semibold uppercase tracking-wide text-accent">
							For coffee roasters
						</p>
						<h3 class="mt-2 text-2xl font-semibold text-ink">Mallard Studio</h3>
					</div>
					<span class="rounded-full border border-line px-3 py-1 text-xs font-semibold text-muted">
						Operations
					</span>
				</div>
				<p class="mt-4 text-sm leading-6 text-muted">
					Track green inventory, roast profiles, tasting notes, and production margins without
					another spreadsheet.
				</p>
				<p class="mt-6 flex items-baseline gap-1">
					<span class="text-4xl font-bold tracking-tight text-ink"
						>{BILLING_OFFERS.studioMonthly.price}</span
					>
					<span class="text-sm font-semibold text-muted"
						>{BILLING_OFFERS.studioMonthly.interval}</span
					>
				</p>
				<p class="mt-2 text-sm text-muted">Five-day free trial if eligible.</p>
				<ul class="mt-6 space-y-3 text-sm leading-6 text-muted">
					<li>Green coffee inventory and lot tracking</li>
					<li>Roast profiles and cupping notes</li>
					<li>Profit and production reporting</li>
				</ul>
				<div class="mt-auto pt-8">
					<button
						onclick={() => handleSelectPlan('studio')}
						class="w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-ink transition-opacity hover:opacity-90"
					>
						{isSignedIn ? 'Start Studio' : 'Choose Studio'}
					</button>
					<a
						href="/subscription#studio-details"
						class="mt-3 block text-center text-sm font-medium text-muted underline underline-offset-4 transition-colors hover:text-ink"
					>
						Learn more
					</a>
				</div>
			</div>
		</div>

		<div class="mx-auto mt-6 grid max-w-6xl gap-4 lg:grid-cols-[1.35fr_1fr]">
			<div
				class="flex flex-col justify-between gap-5 rounded-2xl border border-line bg-surface-canvas p-6 sm:flex-row sm:items-center"
			>
				<div>
					<p class="text-xs font-semibold uppercase tracking-wide text-accent">Developer access</p>
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
					<p class="text-xs font-semibold uppercase tracking-wide text-muted">Custom needs</p>
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
