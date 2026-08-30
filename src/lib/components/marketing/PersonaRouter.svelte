<script lang="ts">
	import { BILLING_OFFERS } from '$lib/billing/offers';

	interface ProductPath {
		step: string;
		label: string;
		headline: string;
		body: string;
		href: string;
		linkLabel: string;
		proof: readonly string[];
		accentClass: string;
	}

	const productPaths: ProductPath[] = [
		{
			step: '01',
			label: 'Source and analyze',
			headline: 'See the market, then ask what it means.',
			body: `Buyers and analysts use the public catalog, Market Index, and Parchment Intelligence to compare current offers and investigate movement. Intelligence is ${BILLING_OFFERS.intelligenceMonthly.price}/month.`,
			href: '/analytics',
			linkLabel: 'Explore market intelligence',
			proof: ['40+ importer catalogs', 'Supplier and origin signals', 'Ask Parchment'],
			accentClass: 'text-chart-rust'
		},
		{
			step: '02',
			label: 'Roast and operate',
			headline: 'Keep the coffee record connected after it arrives.',
			body: `Roasters use Mallard Studio to track inventory, roast profiles, tasting notes, margins, and the Ask Parchment workspace for ${BILLING_OFFERS.studioMonthly.price}/month.`,
			href: '/subscription#studio-details',
			linkLabel: 'See the roaster workspace',
			proof: ['Green inventory', 'Roast and tasting history', 'AI with roaster context'],
			accentClass: 'text-chart-teal'
		},
		{
			step: '03',
			label: 'Build and automate',
			headline: 'Put coffee-native data inside your own product or agent.',
			body: 'Developers, software platforms, and hardware teams use the Parchment API and CLI for normalized catalog data, stable contracts, and machine-friendly workflows.',
			href: '/api',
			linkLabel: 'Build with Parchment',
			proof: ['REST API', 'SDK and CLI', 'Agent-ready contracts'],
			accentClass: 'text-chart-plum'
		}
	];
</script>

<section class="bg-surface-canvas py-20 sm:py-24" aria-labelledby="product-paths-heading">
	<div class="mx-auto max-w-7xl px-6 lg:px-8">
		<div class="max-w-4xl">
			<h2 class="text-base font-semibold leading-7 text-accent">Ways to use Purveyors</h2>
			<p
				id="product-paths-heading"
				class="mt-2 font-serif text-3xl font-medium tracking-tight text-ink sm:text-4xl"
			>
				One coffee data layer, built for decisions and systems.
			</p>
			<p class="mt-4 text-lg leading-8 text-muted">
				Start with the public market, add the context your work needs, or bring Purveyors into your
				own software.
			</p>
		</div>

		<div class="mt-10 grid gap-8 border-y border-line py-8 lg:grid-cols-3">
			{#each productPaths as path}
				<a href={path.href} class="group flex flex-col">
					<div class="flex items-center gap-3 text-sm font-semibold">
						<span class={path.accentClass}>{path.step}</span>
						<span class="text-accent">{path.label}</span>
					</div>
					<h3 class="mt-4 font-serif text-2xl font-medium leading-8 text-ink">{path.headline}</h3>
					<p class="mt-3 text-sm leading-6 text-muted">{path.body}</p>
					<ul class="mt-5 space-y-2 border-t border-line pt-4 text-sm text-muted">
						{#each path.proof as item}
							<li class="flex gap-2">
								<span class={path.accentClass} aria-hidden="true">·</span>
								<span>{item}</span>
							</li>
						{/each}
					</ul>
					<span class="mt-6 text-sm font-semibold text-link group-hover:text-accent">
						{path.linkLabel} <span aria-hidden="true">→</span>
					</span>
				</a>
			{/each}
		</div>
	</div>
</section>
