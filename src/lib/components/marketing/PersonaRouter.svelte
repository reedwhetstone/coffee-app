<script lang="ts">
	import { BILLING_OFFERS } from '$lib/billing/offers';

	interface ProductPath {
		label: string;
		headline: string;
		body: string;
		href: string;
		linkLabel: string;
		icon: string;
		proof: readonly string[];
	}

	const productPaths: ProductPath[] = [
		{
			label: 'Source and analyze',
			headline: 'See the market, then ask what it means.',
			body: `Buyers and analysts use the public catalog, Market Index, and Parchment Intelligence to compare current offers and investigate movement. Intelligence is ${BILLING_OFFERS.intelligenceMonthly.price}/month.`,
			href: '/analytics',
			linkLabel: 'Explore market intelligence',
			proof: ['40+ importer catalogs', 'Supplier and origin signals', 'Ask Parchment'],
			icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z'
		},
		{
			label: 'Roast and operate',
			headline: 'Keep the coffee record connected after it arrives.',
			body: `Roasters use Mallard Studio to track inventory, roast profiles, tasting notes, margins, and the Ask Parchment workspace for ${BILLING_OFFERS.studioMonthly.price}/month.`,
			href: '/subscription#studio-details',
			linkLabel: 'See the roaster workspace',
			proof: ['Green inventory', 'Roast and tasting history', 'AI with roaster context'],
			icon: 'M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205l3 1m1.5.5l-1.5-.5M6.75 7.364V3h-3v18m3-13.636l10.5-3.819'
		},
		{
			label: 'Build and automate',
			headline: 'Put coffee-native data inside your own product or agent.',
			body: 'Developers, software platforms, and hardware teams use the Parchment API and CLI for normalized catalog data, stable contracts, and machine-friendly workflows.',
			href: '/api',
			linkLabel: 'Build with Parchment',
			proof: ['REST API', 'SDK and CLI', 'Agent-ready contracts'],
			icon: 'M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5'
		}
	];
</script>

<section class="bg-surface-canvas py-20 sm:py-24" aria-labelledby="product-paths-heading">
	<div class="mx-auto max-w-7xl px-6 lg:px-8">
		<div class="mx-auto max-w-3xl text-center">
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

		<div class="mt-14 grid gap-5 lg:grid-cols-3">
			{#each productPaths as path}
				<a
					href={path.href}
					class="group flex flex-col rounded-2xl border border-line bg-surface-panel p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent hover:shadow-md"
				>
					<div class="flex items-center gap-3">
						<span
							class="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-subtle/15 ring-1 ring-accent/25"
						>
							<svg
								class="h-6 w-6 text-ink"
								fill="none"
								viewBox="0 0 24 24"
								stroke-width="1.5"
								stroke="currentColor"
								aria-hidden="true"
							>
								<path stroke-linecap="round" stroke-linejoin="round" d={path.icon} />
							</svg>
						</span>
						<span class="text-xs font-semibold text-accent">{path.label}</span>
					</div>
					<h3 class="mt-5 font-serif text-2xl font-medium leading-8 text-ink">{path.headline}</h3>
					<p class="mt-3 text-sm leading-6 text-muted">{path.body}</p>
					<div class="mt-5 flex flex-wrap gap-2">
						{#each path.proof as item}
							<span
								class="rounded-full border border-line bg-surface-canvas px-3 py-1 text-xs text-muted"
							>
								{item}
							</span>
						{/each}
					</div>
					<span class="mt-6 text-sm font-semibold text-link group-hover:text-accent">
						{path.linkLabel} <span aria-hidden="true">→</span>
					</span>
				</a>
			{/each}
		</div>
	</div>
</section>
