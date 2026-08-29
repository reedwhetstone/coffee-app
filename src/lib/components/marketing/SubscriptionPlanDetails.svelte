<script lang="ts">
	import { BILLING_OFFERS } from '$lib/billing/offers';

	const intelligenceQuestions = [
		'Which washed Colombian coffees are priced below their origin benchmark?',
		'What changed across the suppliers I am comparing?',
		'Turn this market view into a sourcing shortlist.'
	] as const;

	const studioWorkflow = [
		{
			title: 'Green inventory',
			description: 'Track lots, quantities, suppliers, landed costs, and availability.'
		},
		{
			title: 'Roast and taste',
			description: 'Save roast curves, compare profiles, and keep cupping notes with the lot.'
		},
		{
			title: 'Production margins',
			description: 'Connect output and costs to a clearer view of production profitability.'
		}
	] as const;
</script>

<section aria-labelledby="plan-details-heading" class="space-y-6 border-t border-line pt-8">
	<div>
		<p class="text-xs font-semibold uppercase tracking-wide text-accent">What you get</p>
		<h2 id="plan-details-heading" class="mt-2 text-2xl font-semibold text-ink">
			See how each plan fits into the work.
		</h2>
	</div>

	<article
		id="intelligence-details"
		class="scroll-mt-24 overflow-hidden rounded-3xl border border-accent/30 bg-surface-panel shadow-sm"
	>
		<div class="grid lg:grid-cols-[1.05fr_0.95fr]">
			<div class="p-6 sm:p-8 lg:p-10">
				<div class="flex flex-wrap items-center gap-3">
					<p class="text-xs font-semibold uppercase tracking-wide text-accent">
						Parchment Intelligence
					</p>
					<span class="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
						{BILLING_OFFERS.intelligenceMonthly.price}{BILLING_OFFERS.intelligenceMonthly.interval}
					</span>
				</div>
				<h3 class="mt-4 font-serif text-3xl font-medium tracking-tight text-ink sm:text-4xl">
					Ask the market, not just read the charts.
				</h3>
				<p class="mt-4 text-base leading-7 text-muted">
					Ask Parchment turns live catalog data, supplier signals, price movement, and the page you
					are viewing into a sourcing conversation. Ask a first question, inspect the evidence, then
					keep narrowing the decision.
				</p>
				<ul class="mt-6 grid gap-3 text-sm leading-6 text-muted sm:grid-cols-2">
					<li class="rounded-2xl border border-line bg-surface-canvas p-4">
						Compare current offers by origin, process, supplier, and price.
					</li>
					<li class="rounded-2xl border border-line bg-surface-canvas p-4">
						Ask follow-up questions without rebuilding filters or losing context.
					</li>
					<li class="rounded-2xl border border-line bg-surface-canvas p-4">
						Explore arrivals, delistings, supplier health, and origin benchmarks.
					</li>
					<li class="rounded-2xl border border-line bg-surface-canvas p-4">
						Use the weekly procurement brief to catch movement worth investigating.
					</li>
				</ul>
				<div class="mt-6 flex flex-wrap gap-3 text-sm font-semibold">
					<a
						href="/chat"
						class="rounded-xl bg-accent px-4 py-2.5 text-ink transition-opacity hover:opacity-90"
					>
						Open Ask Parchment
					</a>
					<a
						href="/analytics"
						class="rounded-xl border border-line bg-surface-canvas px-4 py-2.5 text-ink transition-colors hover:border-accent/40 hover:text-accent"
					>
						Explore the Market Index
					</a>
				</div>
			</div>

			<div class="border-t border-line bg-surface-canvas p-6 sm:p-8 lg:border-l lg:border-t-0">
				<div class="rounded-3xl border border-line bg-surface-panel p-5 shadow-sm sm:p-6">
					<div class="flex items-center justify-between gap-3 border-b border-line pb-4">
						<div>
							<p class="font-semibold text-ink">Ask Parchment</p>
							<p class="mt-1 text-xs text-muted">
								Coffee context from the page and your conversation
							</p>
						</div>
						<span
							class="rounded-full bg-success-subtle px-3 py-1 text-xs font-semibold text-success-strong"
						>
							AI chat included
						</span>
					</div>
					<div class="mt-5 space-y-3">
						{#each intelligenceQuestions as question, index}
							<div
								class={`rounded-2xl p-4 text-sm leading-6 ${index === 0 ? 'ml-8 bg-accent/10 text-ink' : 'mr-8 border border-line bg-surface-canvas text-muted'}`}
							>
								{question}
							</div>
						{/each}
					</div>
					<p class="mt-5 text-xs leading-5 text-muted">
						Use Ask Parchment as a research workbench. Verify the live evidence before buying.
					</p>
				</div>
			</div>
		</div>
	</article>

	<article
		id="studio-details"
		class="scroll-mt-24 overflow-hidden rounded-3xl border border-line bg-surface-canvas shadow-sm"
	>
		<div class="grid lg:grid-cols-[0.95fr_1.05fr]">
			<div class="bg-surface-panel p-6 sm:p-8 lg:p-10">
				<p class="text-xs font-semibold uppercase tracking-wide text-accent">
					A connected workflow
				</p>
				<div class="mt-5 space-y-4">
					{#each studioWorkflow as step, index}
						<div class="flex gap-4 rounded-2xl border border-line bg-surface-canvas p-4">
							<span
								class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-bold text-accent"
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
					<p class="text-xs font-semibold uppercase tracking-wide text-accent">Mallard Studio</p>
					<span class="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
						{BILLING_OFFERS.studioMonthly.price}{BILLING_OFFERS.studioMonthly.interval}
					</span>
				</div>
				<h3 class="mt-4 font-serif text-3xl font-medium tracking-tight text-ink sm:text-4xl">
					Run the roast operation in one workspace.
				</h3>
				<p class="mt-4 text-base leading-7 text-muted">
					Mallard Studio carries a green lot from inventory through roasting, tasting, and margin
					review. The records stay connected, so the team can see what happened without reconciling
					another set of spreadsheets.
				</p>
				<div class="mt-6 rounded-2xl border border-accent/20 bg-accent/5 p-5">
					<p class="font-semibold text-ink">Ask Parchment is included.</p>
					<p class="mt-2 text-sm leading-6 text-muted">
						Ask inventory, roast, tasting, and margin questions with the page and workspace in
						context, then open the full chat workspace when the question needs more room.
					</p>
				</div>
				<p class="mt-6 text-sm leading-6 text-muted">
					Best for working roasters who need operational records and repeatable handoffs, whether or
					not they also subscribe to the broader market-intelligence layer.
				</p>
			</div>
		</div>
	</article>

	<article
		id="both-details"
		class="scroll-mt-24 rounded-3xl border-2 border-success bg-success-subtle p-6 shadow-sm sm:p-8"
	>
		<div class="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
			<div class="max-w-2xl">
				<div class="flex flex-wrap items-center gap-3">
					<p class="text-xs font-semibold uppercase tracking-wide text-success-strong">
						Studio + Intelligence
					</p>
					<span
						class="rounded-full bg-surface-canvas px-3 py-1 text-xs font-semibold text-success-strong"
					>
						Best value · {BILLING_OFFERS.bothMonthly.price}{BILLING_OFFERS.bothMonthly.interval}
					</span>
				</div>
				<h3 class="mt-4 font-serif text-3xl font-medium tracking-tight text-ink">
					Use the market view and your own operation together.
				</h3>
				<p class="mt-3 text-base leading-7 text-muted">
					Start with supplier and price intelligence, carry the decision into inventory and
					roasting, then ask Parchment across the complete workflow. Both products share one
					subscription and renewal date.
				</p>
			</div>
			<div class="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 text-center text-sm">
				<div class="rounded-2xl border border-success/30 bg-surface-canvas p-4">
					<p class="font-semibold text-ink">Market intelligence</p>
					<p class="mt-1 text-xs text-muted">What should we consider?</p>
				</div>
				<span class="text-xl font-bold text-success-strong">+</span>
				<div class="rounded-2xl border border-success/30 bg-surface-canvas p-4">
					<p class="font-semibold text-ink">Roaster operations</p>
					<p class="mt-1 text-xs text-muted">What did we produce?</p>
				</div>
			</div>
		</div>
	</article>
</section>
