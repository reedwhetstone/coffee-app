<script lang="ts">
	import { BILLING_OFFERS } from '$lib/billing/offers';

	const planContexts = [
		{
			name: 'With Intelligence',
			question: 'Which current offers deserve a closer look?',
			inputs: ['Live catalog', 'Supplier signals', 'Price history', 'Your portfolio'],
			outcome: 'A sourcing shortlist grounded in current market evidence.',
			tone: 'intelligence'
		},
		{
			name: 'With Studio',
			question: 'What should we roast next, and what happened last time?',
			inputs: ['Green inventory', 'Roast profiles', 'Tasting notes', 'Confirmed actions'],
			outcome: 'A production answer grounded in your own roastery records.',
			tone: 'studio'
		}
	] as const;

	const intelligenceFlow = [
		{
			label: 'See the movement',
			description: 'Arrivals, delistings, supplier changes, and origin-level price movement.'
		},
		{
			label: 'Compare the evidence',
			description: 'Live offers, market benchmarks, supplier health, and price history in context.'
		},
		{
			label: 'Narrow the decision',
			description: 'Ask Parchment to investigate, explain, and build a sourcing shortlist.'
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
			Every self-serve subscription includes Ask Parchment. The plan determines which coffee data
			and workflows it can bring into the conversation.
		</p>
	</div>

	<section id="ask-parchment-details" class="scroll-mt-24" aria-labelledby="ask-parchment-heading">
		<div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end">
			<div class="max-w-3xl">
				<p class="text-sm font-semibold text-accent">Ask Parchment</p>
				<h3
					id="ask-parchment-heading"
					class="mt-2 font-serif text-3xl font-medium tracking-tight text-ink"
				>
					One place to ask. Different context for the work.
				</h3>
				<p class="mt-4 text-base leading-7 text-muted">
					Ask Parchment works from Purveyors data, the page you are viewing, and the records your
					plan unlocks. It is included with Intelligence, Studio, and the combined plan.
				</p>
			</div>
			<div class="border-l-2 border-chart-teal pl-5">
				<p class="text-sm font-semibold text-ink">Coffee-native AI, included</p>
				<p class="mt-2 text-sm leading-6 text-muted">
					Research the outside market or work from your own roastery records without losing the
					coffee context.
				</p>
				<a href="/chat" class="mt-3 inline-block text-sm font-semibold text-link hover:text-accent">
					Open Ask Parchment <span aria-hidden="true">→</span>
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
			Studio + Intelligence brings both context families into the same workspace.
		</p>
	</section>

	<section
		id="intelligence-details"
		class="scroll-mt-24 border-t border-line pt-12"
		aria-labelledby="intelligence-heading"
	>
		<div class="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
			<div>
				<div class="flex flex-wrap items-center gap-3">
					<p class="text-sm font-semibold text-accent">Parchment Intelligence</p>
					<span class="text-sm font-semibold text-ink">
						{BILLING_OFFERS.intelligenceMonthly.price}{BILLING_OFFERS.intelligenceMonthly.interval}
					</span>
				</div>
				<h3
					id="intelligence-heading"
					class="mt-3 font-serif text-3xl font-medium tracking-tight text-ink sm:text-4xl"
				>
					Know what changed, why it matters, and where to look next.
				</h3>
				<p class="mt-4 max-w-3xl text-base leading-7 text-muted">
					Parchment Intelligence turns daily-normalized offer data into a working market view.
					Compare current offers, investigate movement, and keep the evidence in one sourcing
					conversation with Ask Parchment.
				</p>
				<ul
					class="mt-8 grid gap-px overflow-hidden rounded-2xl bg-line ring-1 ring-line sm:grid-cols-2"
				>
					<li class="bg-surface-panel p-4 text-sm leading-6 text-muted">
						Supplier comparisons and supplier health signals
					</li>
					<li class="bg-surface-panel p-4 text-sm leading-6 text-muted">
						Arrivals, delistings, and origin benchmarks
					</li>
					<li class="bg-surface-panel p-4 text-sm leading-6 text-muted">
						Market signals and extended price-history depth
					</li>
					<li class="bg-surface-panel p-4 text-sm leading-6 text-muted">
						Weekly procurement brief and portfolio context
					</li>
				</ul>
				<div class="mt-6 flex flex-wrap gap-5 text-sm font-semibold">
					<a href="/analytics" class="text-link hover:text-accent">
						Explore the Market Index <span aria-hidden="true">→</span>
					</a>
					<a href="/chat" class="text-link hover:text-accent">
						Ask Parchment <span aria-hidden="true">→</span>
					</a>
				</div>
			</div>

			<div class="border-l-2 border-chart-teal pl-5">
				<p class="text-sm font-semibold text-ink">From market movement to decision</p>
				<ol class="mt-5 space-y-5">
					{#each intelligenceFlow as step, index}
						<li class="flex gap-4">
							<span class="text-sm font-semibold text-chart-teal">0{index + 1}</span>
							<div>
								<h4 class="font-semibold text-ink">{step.label}</h4>
								<p class="mt-1 text-sm leading-6 text-muted">{step.description}</p>
							</div>
						</li>
					{/each}
				</ol>
			</div>
		</div>
	</section>

	<section
		id="studio-details"
		class="scroll-mt-24 border-t border-line pt-12"
		aria-labelledby="studio-heading"
	>
		<div class="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
			<div>
				<div class="flex flex-wrap items-center gap-3">
					<p class="text-sm font-semibold text-accent">Mallard Studio</p>
					<span class="text-sm font-semibold text-ink">
						{BILLING_OFFERS.studioMonthly.price}{BILLING_OFFERS.studioMonthly.interval}
					</span>
				</div>
				<h3
					id="studio-heading"
					class="mt-3 font-serif text-3xl font-medium tracking-tight text-ink sm:text-4xl"
				>
					Keep the coffee, the roast, and the result connected.
				</h3>
				<p class="mt-4 max-w-3xl text-base leading-7 text-muted">
					Mallard Studio replaces disconnected inventory sheets, roast notes, and margin math with
					one operating record. Trace what happened from the green lot through the finished roast.
				</p>
				<div class="mt-7 border-l-2 border-chart-teal pl-5">
					<p class="font-semibold text-ink">Ask Parchment is a core Studio feature.</p>
					<p class="mt-2 text-sm leading-6 text-muted">
						Ask about inventory, compare roast history and tasting notes, and prepare inventory,
						roast, or sales changes for your confirmation.
					</p>
				</div>
				<p class="mt-6 text-sm leading-6 text-muted">
					Studio includes catalog and sourcing context too. Add Intelligence when you also need
					market signals, supplier comparisons, price history, and the broader market view.
				</p>
			</div>

			<div>
				<p class="text-sm font-semibold text-accent">One coffee record through production</p>
				<ol class="mt-5 overflow-hidden rounded-2xl bg-line ring-1 ring-line">
					{#each studioWorkflow as step, index}
						<li class="flex gap-4 border-b border-line bg-surface-panel p-4 last:border-b-0">
							<span class="text-sm font-semibold text-chart-rust">0{index + 1}</span>
							<div>
								<h4 class="font-semibold text-ink">{step.title}</h4>
								<p class="mt-1 text-sm leading-6 text-muted">{step.description}</p>
							</div>
						</li>
					{/each}
				</ol>
			</div>
		</div>
	</section>

	<section
		id="both-details"
		class="scroll-mt-24 border-t-2 border-accent pt-10"
		aria-labelledby="both-heading"
	>
		<div class="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
			<div>
				<div class="flex flex-wrap items-center gap-3">
					<p class="text-sm font-semibold text-accent">Studio + Intelligence</p>
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
					Use Intelligence to understand outside supply and pricing, Studio to manage the coffee
					after it arrives, and Ask Parchment to investigate across both. The products share one
					subscription and renewal date.
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
					<dt class="font-semibold text-ink">Ask Parchment across both</dt>
					<dd class="mt-1 text-sm leading-6 text-muted">
						One conversation with both context families
					</dd>
				</div>
			</dl>
		</div>
	</section>
</section>
