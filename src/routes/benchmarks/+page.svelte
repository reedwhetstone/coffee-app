<script lang="ts">
	import type { PageData } from './$types';
	import Footer from '$lib/components/marketing/Footer.svelte';

	let { data } = $props<{ data: PageData }>();
</script>

<div class="bg-surface-canvas">
	<main class="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
		<header class="max-w-3xl">
			<p class="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Benchmarks</p>
			<h1 class="mt-3 font-serif text-4xl font-medium tracking-tight text-ink sm:text-5xl">
				Measure the whole intelligence system.
			</h1>
			<p class="mt-6 text-lg leading-8 text-muted">
				Purveyors benchmarks compare controlled models and complete agent systems on the evidence,
				judgment, calibration, and operational constraints that shape real coffee decisions.
			</p>
		</header>

		<section class="mt-12" aria-labelledby="available-benchmarks">
			<div class="flex items-end justify-between gap-4">
				<div>
					<p class="text-sm font-medium text-muted">Available evaluation</p>
					<h2 id="available-benchmarks" class="mt-1 text-2xl font-semibold text-ink">
						CoffeeBench v0
					</h2>
				</div>
				<span class="rounded-full border border-line bg-surface-panel px-3 py-1 text-xs text-muted">
					Uncalibrated agent-jury preview
				</span>
			</div>

			<a
				href="/benchmarks/coffeebench-v0"
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
							A frozen, track-separated evaluation of raw models and tool-using systems across
							historical-control and live-web coffee analysis. This complete three-family agent-jury
							preview reports pairwise quality, absolute-rubric, and operational evidence
							independently. Human agreement was not measured, and no composite score is reported.
						</p>
					</div>
					<div class="rounded-2xl bg-surface-canvas p-5 ring-1 ring-line">
						<p class="text-xs font-semibold uppercase tracking-wide text-muted">Includes</p>
						<ul class="mt-3 space-y-2 text-sm text-ink">
							<li>Three independent judge families</li>
							<li>Quality, rubric, reliability, cost, and latency</li>
							<li>Methodology and immutable digests</li>
						</ul>
						<p class="mt-5 font-medium text-accent group-hover:underline">Explore CoffeeBench →</p>
					</div>
				</div>
			</a>
		</section>
	</main>
	<Footer />
</div>
