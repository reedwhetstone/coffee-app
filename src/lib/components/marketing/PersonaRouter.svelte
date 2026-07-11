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
		icon: string;
	}

	const personas: Persona[] = [
		{
			label: 'Home roasters',
			icon: 'M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205l3 1m1.5.5l-1.5-.5M6.75 7.364V3h-3v18m3-13.636l10.5-3.819',
			headline: 'Buy better greens.',
			body: 'Browse every US importer at once — origin, process, score, and live pricing in one catalog. Add Mallard Studio for $9/month to track your own inventory and roasts.',
			href: '/catalog',
			linkLabel: 'Browse the catalog'
		},
		{
			label: 'Roasteries & coffee businesses',
			icon: 'M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z',
			headline: 'Source like the big roasters, without their software budget.',
			body: 'Supplier comparison, arrivals, delistings, and origin benchmarks — the full market view before your next contract.',
			href: '/analytics',
			linkLabel: 'Explore the Market Index'
		},
		{
			label: 'Market analysts',
			icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
			headline: 'The daily price index for US green coffee.',
			body: 'Daily-normalized pricing, supply movement, and origin trends across the specialty import market. Free market visibility; deep history with Intelligence.',
			href: '/analytics',
			linkLabel: 'See the market read'
		},
		{
			label: 'Developers',
			icon: 'M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5',
			headline: 'A stable public API for green coffee data.',
			body: 'Call api.purveyors.io/v1/catalog for a consistent schema, real docs, and a free tier to build on. Scale to production tiers when your project does.',
			href: '/api',
			linkLabel: 'Read the API docs'
		},
		{
			label: 'Platforms & enterprise',
			icon: 'M6 6.878V6a2.25 2.25 0 012.25-2.25h7.5A2.25 2.25 0 0118 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 004.5 9v.878m13.5-3A2.25 2.25 0 0119.5 9v.878m0 0a2.246 2.246 0 00-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0121 12v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6c0-.98.626-1.813 1.5-2.122',
			headline: 'Put live coffee data inside your product.',
			body: 'Roasting software and hardware platforms integrate the Parchment API to onboard normalized supplier data directly into their own tools.',
			href: '/contact',
			linkLabel: 'Talk to us'
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
					<div class="flex items-center gap-3">
						<span
							class="flex h-9 w-9 items-center justify-center rounded-md bg-accent-subtle/15 ring-1 ring-accent/25"
						>
							<svg
								class="h-5 w-5 text-ink"
								fill="none"
								viewBox="0 0 24 24"
								stroke-width="1.5"
								stroke="currentColor"
								aria-hidden="true"
							>
								<path stroke-linecap="round" stroke-linejoin="round" d={persona.icon} />
							</svg>
						</span>
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
