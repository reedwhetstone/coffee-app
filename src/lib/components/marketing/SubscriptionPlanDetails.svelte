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

<section aria-labelledby="plan-details-heading" class="space-y-8 border-t border-line pt-10">
	<div class="max-w-3xl">
		<p class="text-xs font-semibold text-accent">What you get</p>
		<h2
			id="plan-details-heading"
			class="mt-2 font-serif text-3xl font-medium tracking-tight text-ink"
		>
			See the value before you choose a plan.
		</h2>
		<p class="mt-3 text-base leading-7 text-muted">
			Every self-serve subscription includes Ask Parchment. The plan determines which coffee data
			and workflows it can bring into the conversation.
		</p>
	</div>

	<article
		id="ask-parchment-details"
		class="overflow-hidden rounded-3xl border border-intelligence/30 bg-surface-canvas shadow-sm"
	>
		<div class="grid lg:grid-cols-[0.9fr_1.1fr]">
			<div class="relative overflow-hidden bg-ink p-6 text-on-dark sm:p-8 lg:p-10">
				<div
					class="absolute -right-14 -top-14 h-44 w-44 rounded-full border border-intelligence/40"
					aria-hidden="true"
				></div>
				<div
					class="absolute -right-4 top-10 h-28 w-28 rounded-full border border-accent/40"
					aria-hidden="true"
				></div>
				<div class="relative">
					<div class="flex flex-wrap items-center gap-3">
						<span class="rounded-full bg-intelligence px-3 py-1 text-xs font-semibold text-white">
							AI workbench included
						</span>
						<span class="text-xs font-semibold text-on-dark/65">Ask Parchment</span>
					</div>
					<h3 class="mt-5 font-serif text-3xl font-medium tracking-tight sm:text-4xl">
						One place to ask. Different context for the work.
					</h3>
					<p class="mt-4 text-base leading-7 text-on-dark/75">
						Ask Parchment does more than answer generic coffee questions. It works from Purveyors
						data, the page you are viewing, and the records your plan unlocks.
					</p>
					<a
						href="/chat"
						class="mt-7 inline-flex rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-ink transition-opacity hover:opacity-90"
					>
						Open Ask Parchment
					</a>
				</div>
			</div>

			<div class="grid gap-4 bg-surface-panel p-6 sm:p-8">
				{#each planContexts as context}
					<div class="rounded-2xl border border-line bg-surface-canvas p-5 shadow-sm">
						<div class="flex flex-wrap items-center justify-between gap-3">
							<p
								class={`text-xs font-semibold ${context.tone === 'intelligence' ? 'text-intelligence-strong' : 'text-accent'}`}
							>
								{context.name}
							</p>
							<span class="text-xs text-muted">Ask Parchment context</span>
						</div>
						<p class="mt-3 font-serif text-xl font-medium leading-7 text-ink">
							“{context.question}”
						</p>
						<div class="mt-4 flex flex-wrap gap-2">
							{#each context.inputs as input}
								<span
									class="rounded-full border border-line bg-surface-panel px-3 py-1 text-xs text-muted"
								>
									{input}
								</span>
							{/each}
						</div>
						<div class="mt-4 flex gap-3 border-t border-line pt-4">
							<span
								class={`mt-1 h-2 w-2 shrink-0 rounded-full ${context.tone === 'intelligence' ? 'bg-intelligence' : 'bg-accent'}`}
							></span>
							<p class="text-sm leading-6 text-muted">{context.outcome}</p>
						</div>
					</div>
				{/each}
				<p class="px-1 text-xs leading-5 text-muted">
					Studio + Intelligence brings both context families into the same workspace.
				</p>
			</div>
		</div>
	</article>

	<article
		id="intelligence-details"
		class="scroll-mt-24 overflow-hidden rounded-3xl border border-intelligence/30 bg-surface-canvas shadow-sm"
	>
		<div class="grid lg:grid-cols-[1.05fr_0.95fr]">
			<div class="p-6 sm:p-8 lg:p-10">
				<div class="flex flex-wrap items-center gap-3">
					<p class="text-xs font-semibold text-intelligence-strong">Parchment Intelligence</p>
					<span
						class="rounded-full bg-intelligence-subtle px-3 py-1 text-xs font-semibold text-intelligence-strong"
					>
						{BILLING_OFFERS.intelligenceMonthly.price}{BILLING_OFFERS.intelligenceMonthly.interval}
					</span>
				</div>
				<h3 class="mt-4 font-serif text-3xl font-medium tracking-tight text-ink sm:text-4xl">
					Know what changed, why it matters, and where to look next.
				</h3>
				<p class="mt-4 text-base leading-7 text-muted">
					Parchment Intelligence turns daily-normalized offer data into a working market view.
					Instead of checking dozens of supplier lists, you can compare current offers, investigate
					movement, and keep the evidence in one sourcing conversation.
				</p>
				<ul class="mt-6 grid gap-3 text-sm leading-6 text-muted sm:grid-cols-2">
					<li class="rounded-2xl border border-line bg-surface-panel p-4">
						Supplier comparisons and supplier health signals
					</li>
					<li class="rounded-2xl border border-line bg-surface-panel p-4">
						Arrivals, delistings, and origin benchmarks
					</li>
					<li class="rounded-2xl border border-line bg-surface-panel p-4">
						Market signals and extended price-history depth
					</li>
					<li class="rounded-2xl border border-line bg-surface-panel p-4">
						Weekly procurement brief and portfolio context
					</li>
				</ul>
				<div class="mt-6 flex flex-wrap gap-3 text-sm font-semibold">
					<a
						href="/analytics"
						class="rounded-xl bg-intelligence px-4 py-2.5 text-white transition-opacity hover:opacity-90"
					>
						Explore the Market Index
					</a>
					<a
						href="/chat"
						class="rounded-xl border border-line bg-surface-canvas px-4 py-2.5 text-ink transition-colors hover:border-intelligence/40 hover:text-intelligence-strong"
					>
						Ask Parchment
					</a>
				</div>
			</div>

			<div
				class="border-t border-line bg-intelligence-subtle/50 p-6 sm:p-8 lg:border-l lg:border-t-0"
			>
				<p class="text-xs font-semibold text-intelligence-strong">
					From market movement to decision
				</p>
				<ol class="mt-5 space-y-4">
					{#each intelligenceFlow as step, index}
						<li
							class="relative flex gap-4 rounded-2xl border border-intelligence/15 bg-surface-canvas p-4"
						>
							<span
								class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-intelligence text-sm font-bold text-white"
							>
								{index + 1}
							</span>
							<div>
								<h4 class="font-semibold text-ink">{step.label}</h4>
								<p class="mt-1 text-sm leading-6 text-muted">{step.description}</p>
							</div>
						</li>
					{/each}
				</ol>
			</div>
		</div>
	</article>

	<article
		id="studio-details"
		class="scroll-mt-24 overflow-hidden rounded-3xl border border-accent/35 bg-surface-canvas shadow-sm"
	>
		<div class="grid lg:grid-cols-[0.95fr_1.05fr]">
			<div class="bg-surface-panel p-6 sm:p-8 lg:p-10">
				<p class="text-xs font-semibold text-accent">One coffee record through production</p>
				<div class="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
					{#each studioWorkflow as step, index}
						<div class="flex gap-4 rounded-2xl border border-line bg-surface-canvas p-4">
							<span
								class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-bold text-ink"
							>
								{index + 1}
							</span>
							<div>
								<h4 class="font-semibold text-ink">{step.title}</h4>
								<p class="mt-1 text-sm leading-6 text-muted">{step.description}</p>
							</div>
						</div>
					{/each}
				</div>
			</div>

			<div class="p-6 sm:p-8 lg:p-10">
				<div class="flex flex-wrap items-center gap-3">
					<p class="text-xs font-semibold text-accent">Mallard Studio</p>
					<span class="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-ink">
						{BILLING_OFFERS.studioMonthly.price}{BILLING_OFFERS.studioMonthly.interval}
					</span>
				</div>
				<h3 class="mt-4 font-serif text-3xl font-medium tracking-tight text-ink sm:text-4xl">
					Keep the coffee, the roast, and the result connected.
				</h3>
				<p class="mt-4 text-base leading-7 text-muted">
					Mallard Studio replaces disconnected inventory sheets, roast notes, and margin math with
					one operating record. Your team can trace what happened from the green lot through the
					finished roast.
				</p>
				<div class="mt-6 rounded-2xl border border-intelligence/25 bg-intelligence-subtle p-5">
					<div class="flex items-center gap-3">
						<span
							class="flex h-9 w-9 items-center justify-center rounded-xl bg-intelligence text-white"
							aria-hidden="true"
						>
							<svg
								class="h-5 w-5"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.847-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.847a4.5 4.5 0 003.09 3.09L15.75 12l-2.847.813a4.5 4.5 0 00-3.09 3.09z"
								/>
							</svg>
						</span>
						<p class="font-semibold text-ink">Ask Parchment is a core Studio feature.</p>
					</div>
					<p class="mt-3 text-sm leading-6 text-muted">
						Ask about inventory, compare roast history and tasting notes, and prepare inventory,
						roast, or sales changes for your confirmation.
					</p>
				</div>
				<p class="mt-6 text-sm leading-6 text-muted">
					Studio includes catalog and sourcing context too. Add Intelligence when you also need
					market signals, supplier comparisons, price history, and the broader market view.
				</p>
			</div>
		</div>
	</article>

	<article
		id="both-details"
		class="scroll-mt-24 overflow-hidden rounded-3xl border-2 border-success bg-success-subtle shadow-sm"
	>
		<div class="grid lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
			<div class="p-6 sm:p-8 lg:p-10">
				<div class="flex flex-wrap items-center gap-3">
					<p class="text-xs font-semibold text-success-strong">Studio + Intelligence</p>
					<span
						class="rounded-full bg-surface-canvas px-3 py-1 text-xs font-semibold text-success-strong"
					>
						Best value · {BILLING_OFFERS.bothMonthly.price}{BILLING_OFFERS.bothMonthly.interval}
					</span>
				</div>
				<h3 class="mt-4 font-serif text-3xl font-medium tracking-tight text-ink sm:text-4xl">
					Connect what the market is doing to what your roastery should do next.
				</h3>
				<p class="mt-4 text-base leading-7 text-muted">
					Use Intelligence to understand outside supply and pricing, Studio to manage the coffee
					after it arrives, and Ask Parchment to investigate across both. The products share one
					subscription and renewal date.
				</p>
			</div>
			<div class="border-t border-success/25 p-6 sm:p-8 lg:border-l lg:border-t-0">
				<div class="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center text-sm">
					<div class="rounded-2xl border border-success/30 bg-surface-canvas p-4">
						<p class="font-semibold text-ink">Outside market</p>
						<p class="mt-1 text-xs leading-5 text-muted">Suppliers, lots, signals, benchmarks</p>
					</div>
					<span class="text-xl font-bold text-success-strong">→</span>
					<div class="rounded-2xl border border-success/30 bg-surface-canvas p-4">
						<p class="font-semibold text-ink">Your operation</p>
						<p class="mt-1 text-xs leading-5 text-muted">Inventory, roast, taste, margin</p>
					</div>
				</div>
				<div class="mt-4 rounded-2xl bg-ink p-5 text-on-dark">
					<p class="text-xs font-semibold text-accent">Ask Parchment across both</p>
					<p class="mt-2 text-sm leading-6 text-on-dark/75">
						Research a coffee in the market, carry it into your portfolio, then keep its sourcing
						and production context together.
					</p>
				</div>
			</div>
		</div>
	</article>
</section>
