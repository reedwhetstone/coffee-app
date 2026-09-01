<script lang="ts">
	import { BILLING_OFFERS } from '$lib/billing/offers';
	import SubscriptionProductDetail from './SubscriptionProductDetail.svelte';

	const planContexts = [
		{
			name: 'With Parchment Intelligence',
			question: 'Which current offers deserve a closer look?',
			inputs: ['Live catalog', 'Supplier signals', 'Price history', 'Your portfolio'],
			outcome: 'A sourcing shortlist grounded in current market evidence.',
			tone: 'intelligence'
		},
		{
			name: 'With Mallard Studio',
			question: 'What should we roast next, and what happened last time?',
			inputs: ['Green inventory', 'Roast profiles', 'Tasting notes', 'Confirmed actions'],
			outcome: 'A production answer grounded in your own roastery records.',
			tone: 'studio'
		}
	] as const;

	const intelligenceFlow = [
		{
			title: 'Market movement',
			description: 'Arrivals, delistings, supplier changes, and origin-level price movement.'
		},
		{
			title: 'Supplier evidence',
			description: 'Compare live offers, supplier coverage, and supplier health in context.'
		},
		{
			title: 'Price context',
			description: 'Review origin benchmarks, market signals, and extended price history.'
		},
		{
			title: 'Sourcing decision',
			description: 'Use the Cherry Green Agent and the weekly brief to narrow the next move.'
		}
	] as const;

	const studioWorkflow = [
		{
			title: 'Green inventory',
			description: 'Track lots, quantities, suppliers, landed costs, and availability.'
		},
		{
			title: 'Roast',
			description: 'Save sessions and profiles against the coffee that produced them.'
		},
		{
			title: 'Taste',
			description: 'Keep cupping notes connected to the lot and roast history.'
		},
		{
			title: 'Margin',
			description: 'Connect output and costs to a clearer view of production profitability.'
		}
	] as const;
</script>

<section aria-labelledby="plan-details-heading" class="space-y-16 border-t border-line pt-12">
	<div class="max-w-4xl">
		<p class="text-sm font-semibold uppercase tracking-[0.16em] text-accent">What you get</p>
		<h2
			id="plan-details-heading"
			class="mt-3 font-serif text-3xl font-medium tracking-tight text-ink sm:text-4xl"
		>
			See the value before you choose a plan.
		</h2>
		<p class="mt-4 max-w-3xl text-base leading-7 text-muted">
			Every self-serve subscription includes Cherry AI. The plan determines which coffee data,
			tools, and workflows Cherry AI can use.
		</p>
	</div>

	<section id="cherry-details" class="scroll-mt-24" aria-labelledby="cherry-heading">
		<span id="ask-parchment-details" class="sr-only" aria-hidden="true"></span>
		<div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end">
			<div class="max-w-3xl">
				<p class="text-sm font-semibold text-accent">Cherry AI</p>
				<h3
					id="cherry-heading"
					class="mt-2 font-serif text-3xl font-medium tracking-tight text-ink"
				>
					One AI system. The right context for the work.
				</h3>
				<p class="mt-4 text-base leading-7 text-muted">
					Cherry AI uses Purveyors data, the page you are viewing, and the records your plan
					unlocks. Cherry AI is included with Parchment Intelligence, Mallard Studio, and the
					combined plan.
				</p>
			</div>
			<div class="border-l-2 border-chart-teal pl-5">
				<p class="text-sm font-semibold text-ink">Coffee-native AI, included</p>
				<p class="mt-2 text-sm leading-6 text-muted">
					Research the outside market or work from your own roastery records without losing the
					coffee context.
				</p>
				<a href="/chat" class="mt-3 inline-block text-sm font-semibold text-link hover:text-accent">
					Open Cherry AI <span aria-hidden="true">→</span>
				</a>
			</div>
		</div>

		<div
			class="mt-8 grid gap-px overflow-hidden rounded-2xl bg-line ring-1 ring-line md:grid-cols-2"
		>
			{#each planContexts as context}
				<article class="bg-surface-panel p-6">
					<p
						class={`text-sm font-semibold ${context.tone === 'intelligence' ? 'text-chart-teal' : 'text-chart-rust'}`}
					>
						{context.name}
					</p>
					<p class="mt-3 font-serif text-xl font-medium leading-7 text-ink">{context.question}</p>
					<p class="mt-4 text-xs font-medium uppercase tracking-wide text-muted">
						{context.inputs.join(' · ')}
					</p>
					<p class="mt-4 border-t border-line pt-4 text-sm leading-6 text-muted">
						{context.outcome}
					</p>
				</article>
			{/each}
		</div>
		<p class="mt-3 text-xs leading-5 text-muted">
			Mallard Studio + Parchment Intelligence brings both context families into the same workspace.
		</p>
	</section>

	<SubscriptionProductDetail
		anchorId="intelligence-details"
		headingId="intelligence-heading"
		name="Parchment Intelligence"
		price={`${BILLING_OFFERS.intelligenceMonthly.price}${BILLING_OFFERS.intelligenceMonthly.interval}`}
		headline="Know what changed, why it matters, and where to look next."
		description="Parchment Intelligence turns daily-normalized offer data into a working market view. Compare current offers, investigate movement, and keep the evidence in one Cherry AI workspace."
		askTitle="The Cherry Green Agent is included with Parchment Intelligence."
		askDescription="Ask about current offers, compare suppliers and price history, investigate market movement, and build a sourcing shortlist from the evidence."
		supportingText="Parchment Intelligence includes portfolio and catalog context too. Add Mallard Studio when you also need inventory, roast, tasting, sales, and margin workflows for your own roastery."
		workflowTitle="From market movement to decision"
		workflow={intelligenceFlow}
		links={[
			{ href: '/analytics', label: 'Explore the Market Index' },
			{ href: '/chat', label: 'Open Cherry AI' }
		]}
	/>

	<SubscriptionProductDetail
		anchorId="studio-details"
		headingId="studio-heading"
		name="Mallard Studio"
		price={`${BILLING_OFFERS.studioMonthly.price}${BILLING_OFFERS.studioMonthly.interval}`}
		headline="Keep the coffee, the roast, and the result connected."
		description="Mallard Studio replaces disconnected inventory sheets, roast notes, and margin math with one operating record. Trace what happened from the green lot through the finished roast."
		askTitle="The Cherry Roast Agent is included with Mallard Studio."
		askDescription="Ask about inventory, compare roast history and tasting notes, and prepare inventory, roast, or sales changes for your confirmation."
		supportingText="Mallard Studio includes catalog and sourcing context too. Add Parchment Intelligence when you also need market signals, supplier comparisons, price history, and the broader market view."
		workflowTitle="One coffee record through production"
		workflow={studioWorkflow}
	/>

	<section
		id="both-details"
		class="scroll-mt-24 border-t border-line pt-12"
		aria-labelledby="both-heading"
	>
		<div class="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
			<div>
				<div class="flex flex-wrap items-center gap-3">
					<p class="text-sm font-semibold text-accent">Mallard Studio + Parchment Intelligence</p>
					<span
						class="rounded-full border border-accent/30 px-3 py-1 text-xs font-semibold text-ink"
					>
						Best value · {BILLING_OFFERS.bothMonthly.price}{BILLING_OFFERS.bothMonthly.interval}
					</span>
				</div>
				<h3
					id="both-heading"
					class="mt-3 font-serif text-3xl font-medium tracking-tight text-ink sm:text-4xl"
				>
					Connect what the market is doing to what your roastery should do next.
				</h3>
				<p class="mt-4 max-w-3xl text-base leading-7 text-muted">
					Use Parchment Intelligence to understand outside supply and pricing, Mallard Studio to
					manage the coffee after it arrives, and the Cherry Synthesis Agent to investigate across
					both. The products share one subscription and renewal date.
				</p>
			</div>

			<dl class="overflow-hidden rounded-2xl bg-line ring-1 ring-line">
				<div class="bg-surface-panel p-4">
					<dt class="font-semibold text-ink">Outside market</dt>
					<dd class="mt-1 text-sm leading-6 text-muted">
						Suppliers, lots, signals, and benchmarks
					</dd>
				</div>
				<div class="border-t border-line bg-surface-panel p-4">
					<dt class="font-semibold text-ink">Your operation</dt>
					<dd class="mt-1 text-sm leading-6 text-muted">Inventory, roast, tasting, and margin</dd>
				</div>
				<div class="border-t border-line bg-surface-canvas p-4">
					<dt class="font-semibold text-ink">Cherry Synthesis Agent across both</dt>
					<dd class="mt-1 text-sm leading-6 text-muted">
						One conversation with both context families
					</dd>
				</div>
			</dl>
		</div>
	</section>
</section>
