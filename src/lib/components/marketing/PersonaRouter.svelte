<script lang="ts">
	import { BILLING_OFFERS } from '$lib/billing/offers';

	const productPaths = [
		{
			step: '01',
			label: 'Parchment Intelligence',
			headline: 'See more than a list of coffees.',
			body: `Compare live offers, supplier movement, price history, and origin benchmarks, then investigate the evidence with the Cherry Green Agent for ${BILLING_OFFERS.intelligenceMonthly.price}/month.`,
			href: '/analytics',
			linkLabel: 'Explore market intelligence',
			proof: 'Live market · Benchmarks · Cherry Green Agent'
		},
		{
			step: '02',
			label: 'Mallard Studio',
			headline: 'Keep the coffee record connected.',
			body: `Move from green inventory through roasts, tasting, and margins in one workspace. The Cherry Roast Agent works with your roastery context for ${BILLING_OFFERS.studioMonthly.price}/month.`,
			href: '/subscription#studio-details',
			linkLabel: 'See the roaster workspace',
			proof: 'Inventory · Roasts · Tasting · Cherry Roast Agent'
		},
		{
			step: '03',
			label: 'Parchment API',
			headline: 'Build on a coffee-native foundation.',
			body: 'Bring normalized catalog data and stable coffee contracts into software, hardware, automations, and agents without rebuilding the domain layer.',
			href: '/api',
			linkLabel: 'Build with Parchment',
			proof: 'REST API · SDK · CLI · Agent-ready contracts'
		}
	] as const;
</script>

<section
	id="platform"
	class="scroll-mt-24 bg-surface-canvas py-16 sm:py-20"
	aria-labelledby="platform-heading"
>
	<div class="mx-auto max-w-7xl px-6 lg:px-8">
		<div class="grid gap-6 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)] lg:items-end">
			<div>
				<p class="text-sm font-semibold text-organic-rust">One connected coffee system</p>
				<h2
					id="platform-heading"
					class="mt-2 max-w-2xl font-serif text-4xl font-medium leading-tight tracking-tight text-ink sm:text-5xl"
				>
					From market signal to real work.
				</h2>
			</div>
			<p class="max-w-2xl text-lg leading-8 text-muted lg:justify-self-end">
				Start with the public market. Add intelligence or roastery context when the work needs it.
				Build on the same coffee foundation when the interface is yours.
			</p>
		</div>

		<div class="mt-10 grid border-y border-line lg:grid-cols-3">
			{#each productPaths as path, index}
				<article
					class="group flex flex-col py-8 {index > 0
						? 'border-t border-line lg:border-l lg:border-t-0 lg:pl-8'
						: ''} {index < productPaths.length - 1 ? 'lg:pr-8' : ''}"
				>
					<div class="flex items-center justify-between gap-4 text-xs font-semibold">
						<span class="text-organic-rust">{path.step}</span>
						<span class="text-muted">{path.label}</span>
					</div>
					<h3 class="mt-6 font-serif text-2xl font-medium leading-8 text-ink">
						{path.headline}
					</h3>
					<p class="mt-3 text-sm leading-6 text-muted">{path.body}</p>
					<p class="mt-6 border-t border-line pt-4 text-xs font-medium leading-5 text-muted">
						{path.proof}
					</p>
					<a
						href={path.href}
						class="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-link transition-colors group-hover:text-ink"
					>
						{path.linkLabel} <span aria-hidden="true">→</span>
					</a>
				</article>
			{/each}
		</div>
	</div>
</section>
