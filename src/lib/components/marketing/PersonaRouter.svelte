<!--
  PersonaRouter: routes the five entry personas to the product surface
  built for them. Buyer-native language: job first, product second.
-->
<script lang="ts">
	interface Persona {
		label: string;
		headline: string;
		body: string;
		href: string;
		linkLabel: string;
		dotClass: string;
	}

	const personas: Persona[] = [
		{
			label: 'Home roasters',
			headline: 'Buy better greens.',
			body: 'Browse every US importer at once — origin, process, score, and live pricing in one catalog. Add Mallard Studio for $9/month to track your own inventory and roasts.',
			href: '/catalog',
			linkLabel: 'Browse the catalog',
			dotClass: 'bg-accent'
		},
		{
			label: 'Roasteries & coffee businesses',
			headline: 'Source like the big roasters, without their software budget.',
			body: 'Supplier comparison, arrivals, delistings, and origin benchmarks — the full market view before your next contract.',
			href: '/analytics',
			linkLabel: 'Explore the Market Index',
			dotClass: 'bg-success'
		},
		{
			label: 'Market analysts',
			headline: 'The daily price index for US green coffee.',
			body: 'Daily-normalized pricing, supply movement, and origin trends across the specialty import market. Free market visibility; deep history with Intelligence.',
			href: '/analytics',
			linkLabel: 'See the market read',
			dotClass: 'bg-warning'
		},
		{
			label: 'Developers',
			headline: 'A stable public API for green coffee data.',
			body: 'GET /v1/catalog with a consistent schema, real docs, and a free tier to build on. Scale to production tiers when your project does.',
			href: '/api',
			linkLabel: 'Read the API docs',
			dotClass: 'bg-intelligence'
		},
		{
			label: 'Platforms & enterprise',
			headline: 'Put live coffee data inside your product.',
			body: 'Roasting software and hardware platforms integrate the Parchment API to onboard normalized supplier data directly into their own tools.',
			href: '/contact',
			linkLabel: 'Talk to us',
			dotClass: 'bg-ink'
		}
	];
</script>

<section class="bg-surface-canvas py-20 sm:py-24" aria-label="Who uses Purveyors">
	<div class="mx-auto max-w-7xl px-6 lg:px-8">
		<div class="mx-auto max-w-3xl text-center">
			<h2 class="text-base font-semibold leading-7 text-accent">Who it's for</h2>
			<p class="mt-2 font-serif text-3xl font-medium tracking-tight text-ink sm:text-4xl">
				One market, five ways in.
			</p>
			<p class="mt-4 text-lg leading-8 text-muted">
				Whether you roast on a popcorn popper or run procurement for a platform, Purveyors starts at
				the same place: trustworthy green coffee data.
			</p>
		</div>

		<div class="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
			{#each personas as persona}
				<a
					href={persona.href}
					class="group flex flex-col rounded-lg border border-line bg-surface-panel p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent hover:shadow-md"
				>
					<div class="flex items-center gap-2">
						<span class="h-2 w-2 rounded-full {persona.dotClass}"></span>
						<span class="text-xs font-semibold text-muted">{persona.label}</span>
					</div>
					<h3 class="mt-3 font-serif text-lg font-medium leading-6 text-ink">
						{persona.headline}
					</h3>
					<p class="mt-2 flex-1 text-sm leading-6 text-muted">{persona.body}</p>
					<span class="mt-4 text-sm font-semibold text-link group-hover:text-accent">
						{persona.linkLabel} <span aria-hidden="true">→</span>
					</span>
				</a>
			{/each}
		</div>
	</div>
</section>
