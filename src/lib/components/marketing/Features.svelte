<!--
  How it works: three steps from raw supplier data to a sourcing decision,
  matching the analytics-first funnel (track -> read -> act).
-->
<script lang="ts">
	interface Step {
		step: string;
		title: string;
		body: string;
		icon: string;
	}

	const steps: Step[] = [
		{
			step: '01',
			title: 'We track the whole market.',
			body: 'Every stocked green coffee from 40+ US importers, collected and normalized daily — origin, process, score, and price on one consistent schema.',
			icon: 'M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418'
		},
		{
			step: '02',
			title: 'The Market Index turns it into a read.',
			body: 'Price movement with 90+ days of history, arrivals and delistings, origin benchmarks, and supplier coverage — distilled into one daily market read.',
			icon: 'M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z'
		},
		{
			step: '03',
			title: 'You act on it.',
			body: 'Trace movement to named lots in the catalog, get the weekly procurement brief with Intelligence, or pull everything into your own tools through the Parchment API.',
			icon: 'M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z'
		}
	];

	const capabilities = [
		'Price index history',
		'Arrivals & delistings',
		'Origin benchmarks',
		'Supplier comparison',
		'Value-lot screening',
		'Origin supply health'
	];
</script>

<section id="features" class="bg-surface-canvas py-24 sm:py-32">
	<div class="mx-auto max-w-7xl px-6 lg:px-8">
		<div class="mx-auto max-w-2xl lg:text-center">
			<h2 class="text-base font-semibold leading-7 text-accent">How it works</h2>
			<p class="mt-2 font-serif text-3xl font-medium tracking-tight text-ink sm:text-4xl">
				From forty offer lists to one market read.
			</p>
			<p class="mt-6 text-lg leading-8 text-muted">
				Green coffee pricing lives in supplier spreadsheets, PDFs, and inbox offer lists. Purveyors
				gathers it, normalizes it, and reads it — every morning.
			</p>
		</div>

		<div class="mx-auto mt-16 max-w-2xl sm:mt-20 lg:max-w-none">
			<ol class="grid grid-cols-1 gap-x-8 gap-y-12 lg:grid-cols-3">
				{#each steps as step}
					<li class="relative flex flex-col">
						<div class="flex items-center gap-x-3">
							<div
								class="flex h-10 w-10 items-center justify-center rounded-md bg-accent-subtle/15 ring-1 ring-accent/25"
							>
								<svg
									class="h-6 w-6 text-ink"
									fill="none"
									viewBox="0 0 24 24"
									stroke-width="1.5"
									stroke="currentColor"
									aria-hidden="true"
								>
									<path stroke-linecap="round" stroke-linejoin="round" d={step.icon} />
								</svg>
							</div>
							<span class="font-serif text-sm font-medium text-muted">{step.step}</span>
						</div>
						<h3 class="mt-4 font-serif text-xl font-medium leading-7 text-ink">{step.title}</h3>
						<p class="mt-2 text-base leading-7 text-muted">{step.body}</p>
					</li>
				{/each}
			</ol>

			<div class="mt-14 border-t border-line pt-8">
				<div class="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
					<span class="text-sm font-semibold text-ink">Inside the index:</span>
					{#each capabilities as capability}
						<span
							class="rounded-full border border-line bg-surface-panel px-3 py-1 text-sm text-muted"
						>
							{capability}
						</span>
					{/each}
				</div>
			</div>
		</div>
	</div>
</section>
