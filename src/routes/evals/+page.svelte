<script lang="ts">
	import type { PageData } from './$types';
	import { PV_MICROLOT_FULL_NAME, PV_MICROLOT_NAME } from '$lib/benchmarks/marketing';
	import Footer from '$lib/components/marketing/Footer.svelte';

	let { data } = $props<{ data: PageData }>();
</script>

<div class="bg-surface-canvas">
	<main class="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
		<header class="max-w-3xl">
			<p class="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Cherry Evals</p>
			<h1 class="mt-3 font-serif text-4xl font-medium tracking-tight text-ink sm:text-5xl">
				Measure the whole intelligence system.
			</h1>
			<p class="mt-6 text-lg leading-8 text-muted">
				Domain benchmarks for green coffee, sensory analysis, sourcing, and roasting.
			</p>
		</header>

		<section class="mt-12" aria-labelledby="available-benchmarks">
			<div class="flex items-end justify-between gap-4">
				<div>
					<p class="text-sm font-medium text-muted">Available evaluation</p>
					<h2 id="available-benchmarks" class="mt-1 text-2xl font-semibold text-ink">
						{PV_MICROLOT_FULL_NAME}
					</h2>
				</div>
				<span class="rounded-full border border-line bg-surface-panel px-3 py-1 text-xs text-muted">
					Published V1 findings
				</span>
			</div>

			<a
				href="/evals/coffeebench-v1"
				class="group mt-5 block rounded-3xl border border-line bg-surface-panel p-6 transition hover:border-accent/60 sm:p-8"
			>
				<div class="grid gap-8 md:grid-cols-[minmax(0,1fr)_17rem] md:items-end">
					<div>
						<p class="text-sm font-semibold text-accent">
							{data.benchmark.caseCount} cases · {data.benchmark.subjectTrialCount} subject trials
						</p>
						<h3 class="mt-2 font-serif text-3xl font-medium text-ink">
							Coffee supply-chain analyst arena
						</h3>
						<p class="mt-4 max-w-2xl leading-7 text-muted">
							A matched evaluation of one model across four system treatments. Harnessed systems
							beat Raw, but Purveyors did not clearly beat Pi and Parchment added no measured
							pairwise lift. Read the hypothesis audit, full pairwise matrix, failure modes, and
							missing data.
						</p>
					</div>
					<div class="rounded-2xl bg-surface-canvas p-5 ring-1 ring-line">
						<p class="text-xs font-semibold uppercase tracking-wide text-muted">Includes</p>
						<ul class="mt-3 space-y-2 text-sm text-ink">
							<li>All 1,800 pairwise ballots</li>
							<li>Findings and product implications</li>
							<li>Methodology and immutable digests</li>
						</ul>
						<p class="mt-5 font-medium text-accent group-hover:underline">
							Explore {PV_MICROLOT_NAME} →
						</p>
					</div>
				</div>
			</a>
		</section>
	</main>
	<Footer />
</div>
