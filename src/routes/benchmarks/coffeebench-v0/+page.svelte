<script lang="ts">
	import type { PageData } from './$types';
	import BenchmarkVisuals from '$lib/components/benchmarks/BenchmarkVisuals.svelte';
	import TrackResults from '$lib/components/benchmarks/TrackResults.svelte';
	import Footer from '$lib/components/marketing/Footer.svelte';
	import {
		COFFEEBENCH_RESULT_PATH,
		type CoffeeBenchPublicExport,
		type CoffeeBenchSlice
	} from '$lib/benchmarks/coffeebench';
	import { formatDuration, formatRate, formatUsd } from '$lib/benchmarks/display';

	let { data } = $props<{ data: PageData }>();
	let benchmark: CoffeeBenchPublicExport = $derived(data.benchmark);
	let overall = $derived(
		benchmark.slices.find((slice: CoffeeBenchSlice) => slice.slice_id === 'overall')
	);
	let cohortSlices = $derived(
		benchmark.slices.filter((slice: CoffeeBenchSlice) => slice.slice_id !== 'overall')
	);

	function sentenceCase(value: string): string {
		return value.replaceAll('_', ' ');
	}
</script>

<div class="bg-surface-canvas">
	<main>
		<header class="border-b border-line bg-surface-panel">
			<div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
				<a href="/benchmarks" class="text-sm font-medium text-accent hover:underline"
					>← Benchmarks</a
				>
				<div class="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end">
					<div class="max-w-4xl">
						<div class="flex flex-wrap items-center gap-3">
							<p class="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
								CoffeeBench v0
							</p>
							<span
								class="rounded-full border border-line bg-surface-canvas px-3 py-1 text-xs text-muted"
							>
								{benchmark.status === 'fixture' ? 'Deterministic fixture' : 'Provisional result'}
							</span>
						</div>
						<h1 class="mt-3 font-serif text-4xl font-medium tracking-tight text-ink sm:text-5xl">
							Can a model make a defensible coffee decision?
						</h1>
						<p class="mt-6 text-lg leading-8 text-muted">
							CoffeeBench evaluates evidence use, belief updating, calibration, actionability, and
							operational performance on a frozen coffee supply-chain analyst suite. Published
							comparison tracks and each subject’s effective evaluator track remain explicit.
						</p>
					</div>
					<div class="rounded-2xl bg-surface-canvas p-5 ring-1 ring-line">
						<p class="text-xs font-semibold uppercase tracking-wide text-muted">Public artifact</p>
						<p class="mt-2 text-sm font-medium text-ink">Result {benchmark.result_version}</p>
						<a
							href={COFFEEBENCH_RESULT_PATH}
							download
							class="mt-4 inline-flex rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-ink hover:opacity-90"
						>
							Download sanitized JSON
						</a>
						<p class="mt-3 text-xs leading-5 text-muted">
							Immutable result-version and content-addressed path. Contains aggregate values and
							public identities only—no cases, evidence, prompts, or evaluator guardrails.
						</p>
					</div>
				</div>
			</div>
		</header>

		<nav
			class="sticky top-[73px] z-30 overflow-x-auto border-b border-line bg-surface-canvas/95 backdrop-blur"
			aria-label="CoffeeBench report sections"
		>
			<div class="mx-auto flex max-w-7xl gap-1 px-4 py-2 sm:px-6 lg:px-8">
				{#each [['#overview', 'Overview'], ['#comparison', 'Comparison'], ['#cohorts', 'Cohorts'], ['#harnesses', 'Harnesses'], ['#methodology', 'Methodology'], ['#limitations', 'Limitations'], ['#provenance', 'Provenance']] as [href, label]}
					<a
						{href}
						class="whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium text-muted hover:bg-surface-panel hover:text-ink"
						>{label}</a
					>
				{/each}
			</div>
		</nav>

		<div class="mx-auto max-w-7xl space-y-20 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
			{#if benchmark.status === 'fixture'}
				<div class="rounded-2xl border border-accent/40 bg-accent/10 p-5" role="note">
					<p class="font-semibold text-ink">Contract preview, not a benchmark result</p>
					<p class="mt-2 text-sm leading-6 text-muted">
						These deterministic values prove the sanitized export, strict reader, and responsive
						presentation together. They must not be cited as model performance or a leaderboard.
					</p>
				</div>
			{/if}

			<section id="overview" class="scroll-mt-36" aria-labelledby="overview-heading">
				<div class="max-w-3xl">
					<p class="text-sm font-semibold text-accent">Overview</p>
					<h2 id="overview-heading" class="mt-2 font-serif text-3xl font-medium text-ink">
						One frozen run, a matched comparison boundary.
					</h2>
					<p class="mt-4 leading-7 text-muted">
						This panel publishes one matched system comparison track across four treatments. The raw
						control still uses model-track evaluator criteria and reduced capabilities; tool-using
						harnesses use system-track criteria. No subject is judged against tools it could not
						use.
					</p>
				</div>
				<dl class="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
					{#each [['Cases', benchmark.methodology.case_count], ['Subject trials', benchmark.methodology.subject_trial_count], ['Absolute evaluations', benchmark.methodology.absolute_evaluation_count], ['Pairwise ballots', benchmark.methodology.pairwise_ballot_count], ['Jury families', benchmark.methodology.jury_family_count]] as [label, value]}
						<div class="rounded-2xl border border-line bg-surface-panel p-5">
							<dt class="text-xs text-muted">{label}</dt>
							<dd class="mt-2 text-2xl font-semibold text-ink">{value}</dd>
						</div>
					{/each}
				</dl>
				<div class="mt-6 grid gap-4 md:grid-cols-2">
					{#each benchmark.tracks as track (track.track_id)}
						<article class="rounded-2xl border border-line bg-surface-panel p-6">
							<h3 class="text-lg font-semibold text-ink">{track.label}</h3>
							<p class="mt-2 text-sm leading-6 text-muted">{track.description}</p>
						</article>
					{/each}
				</div>
			</section>

			<section id="comparison" class="scroll-mt-36" aria-labelledby="comparison-heading">
				<div class="max-w-3xl">
					<p class="text-sm font-semibold text-accent">Overall comparison</p>
					<h2 id="comparison-heading" class="mt-2 font-serif text-3xl font-medium text-ink">
						Quality beside cost, latency, and failure.
					</h2>
					<p class="mt-4 leading-7 text-muted">
						Every value below is copied from Cherry’s precomputed export. This app formats and
						renders the values; it does not derive rank, intervals, cost, rates, or Pareto status.
					</p>
				</div>
				{#if overall}
					<div class="mt-10 space-y-14">
						{#each overall.track_results as trackResult (trackResult.track)}
							<BenchmarkVisuals {trackResult} subjects={benchmark.subjects} />
							<TrackResults {trackResult} subjects={benchmark.subjects} />
						{/each}
					</div>
				{/if}
			</section>

			<section id="cohorts" class="scroll-mt-36" aria-labelledby="cohorts-heading">
				<div class="max-w-3xl">
					<p class="text-sm font-semibold text-accent">Cohort evidence</p>
					<h2 id="cohorts-heading" class="mt-2 font-serif text-3xl font-medium text-ink">
						The same run, sliced by task context.
					</h2>
					<p class="mt-4 leading-7 text-muted">
						Historical-control and live-web values are evaluator-side slices. They are not hints
						shown to subjects, and tracks remain separate within each cohort.
					</p>
				</div>
				<div class="mt-8 space-y-5">
					{#each cohortSlices as slice (slice.slice_id)}
						<details class="rounded-2xl border border-line bg-surface-panel p-5 sm:p-6">
							<summary class="cursor-pointer text-lg font-semibold text-ink">{slice.label}</summary>
							<div class="mt-8 space-y-12">
								{#each slice.track_results as trackResult (trackResult.track)}
									<TrackResults {trackResult} subjects={benchmark.subjects} compactHeading />
								{/each}
							</div>
						</details>
					{/each}
				</div>
			</section>

			<section id="harnesses" class="scroll-mt-36" aria-labelledby="harnesses-heading">
				<div class="max-w-3xl">
					<p class="text-sm font-semibold text-accent">Harness cards</p>
					<h2 id="harnesses-heading" class="mt-2 font-serif text-3xl font-medium text-ink">
						What each subject was allowed to be.
					</h2>
					<p class="mt-4 leading-7 text-muted">
						Identity, model route, evaluator track, and capabilities are pinned before generation.
						Judges evaluate only the capabilities declared here.
					</p>
				</div>
				<div class="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
					{#each benchmark.subjects as subject (subject.subject_id)}
						<article class="rounded-2xl border border-line bg-surface-panel p-6">
							<div class="flex items-start justify-between gap-3">
								<h3 class="font-semibold text-ink">{subject.display_name}</h3>
								<span
									class="rounded-full bg-surface-canvas px-2.5 py-1 text-xs text-muted ring-1 ring-line"
								>
									{subject.track} comparison
								</span>
							</div>
							<dl class="mt-5 space-y-3 text-sm">
								<div>
									<dt class="text-xs text-muted">Evaluator criteria</dt>
									<dd class="mt-1 text-ink">{subject.evaluator_track} track</dd>
								</div>
								<div>
									<dt class="text-xs text-muted">Harness</dt>
									<dd class="mt-1 text-ink">{sentenceCase(subject.harness_family)}</dd>
								</div>
								<div>
									<dt class="text-xs text-muted">Model</dt>
									<dd class="mt-1 text-ink">
										{subject.model.provider} · {subject.model.model} · {subject.model.revision}
										{#if subject.model.quantization}
											· {subject.model.quantization}{/if}
									</dd>
								</div>
								<div>
									<dt class="text-xs text-muted">Capabilities</dt>
									<dd class="mt-1 text-ink">
										{subject.capabilities.length ? subject.capabilities.join(' · ') : 'No tools'}
									</dd>
								</div>
							</dl>
							<p class="mt-5 break-all font-mono text-[11px] text-muted">{subject.card_sha256}</p>
						</article>
					{/each}
				</div>
			</section>

			<section class="scroll-mt-36" aria-labelledby="jury-heading">
				<div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.65fr)]">
					<div>
						<p class="text-sm font-semibold text-accent">Independent jury</p>
						<h2 id="jury-heading" class="mt-2 font-serif text-3xl font-medium text-ink">
							Three judge families, one pinned calibration sample.
						</h2>
						<div class="mt-6 grid gap-4 sm:grid-cols-3">
							{#each benchmark.jury as judge (judge.family)}
								<div class="rounded-2xl border border-line bg-surface-panel p-5">
									<p class="font-semibold capitalize text-ink">{judge.family}</p>
									<p class="mt-2 text-xs leading-5 text-muted">
										{judge.call_count} calls · {judge.provider_call_count} provider calls<br />
										{formatDuration(judge.latency_ms.p50)} / {formatDuration(judge.latency_ms.p95)} p50/p95<br
										/>
										{formatUsd(judge.provider_billed_usd_total)} billed · {formatUsd(
											judge.normalized_cost_usd_total
										)} normalized
									</p>
								</div>
							{/each}
						</div>
					</div>
					<aside class="rounded-2xl border border-line bg-surface-panel p-6">
						<p class="text-xs font-semibold uppercase tracking-wide text-muted">
							Human calibration
						</p>
						<p class="mt-3 text-3xl font-semibold text-ink">
							{formatRate(benchmark.calibration.agreement.agent_majority_agreement_rate)}
						</p>
						<p class="mt-1 text-sm text-muted">agent-majority agreement</p>
						<dl class="mt-5 space-y-3 text-sm">
							<div class="flex justify-between gap-3">
								<dt class="text-muted">Reviewed pairs</dt>
								<dd class="font-medium text-ink">
									{benchmark.calibration.agreement.compared_pair_count}
								</dd>
							</div>
							<div class="flex justify-between gap-3">
								<dt class="text-muted">Majority decisions</dt>
								<dd class="font-medium text-ink">
									{benchmark.calibration.agreement.agent_majority_decision_count}
								</dd>
							</div>
							<div class="flex justify-between gap-3">
								<dt class="text-muted">Unresolved majorities</dt>
								<dd class="font-medium text-ink">
									{benchmark.calibration.agreement.agent_majority_unresolved_count}
								</dd>
							</div>
							<div class="flex justify-between gap-3">
								<dt class="text-muted">Exact ballot agreement</dt>
								<dd class="font-medium text-ink">
									{formatRate(benchmark.calibration.agreement.exact_agreement_rate)}
								</dd>
							</div>
							<div class="flex justify-between gap-3">
								<dt class="text-muted">Decision source</dt>
								<dd class="font-medium text-ink">
									{sentenceCase(benchmark.calibration.decision_source)}
								</dd>
							</div>
						</dl>
					</aside>
				</div>
			</section>

			<section id="methodology" class="scroll-mt-36" aria-labelledby="methodology-heading">
				<div class="max-w-3xl">
					<p class="text-sm font-semibold text-accent">Methodology</p>
					<h2 id="methodology-heading" class="mt-2 font-serif text-3xl font-medium text-ink">
						How to read the result.
					</h2>
				</div>
				<dl class="mt-8 grid gap-5 md:grid-cols-2">
					{#each [['Quality model', benchmark.methodology.quality_model], ['Uncertainty', benchmark.methodology.uncertainty], ['Unacceptable response', benchmark.methodology.unacceptable_response_rule], ['Critical error', benchmark.methodology.critical_error_rule], ['Confidence calibration', benchmark.methodology.confidence_calibration_rule], ['Pareto classification', benchmark.methodology.pareto_rule], ['Missing values', benchmark.methodology.null_semantics], ['Tie value', String(benchmark.methodology.tie_value)]] as [label, explanation]}
						<div class="rounded-2xl border border-line bg-surface-panel p-5">
							<dt class="font-semibold text-ink">{label}</dt>
							<dd class="mt-2 text-sm leading-6 text-muted">{explanation}</dd>
						</div>
					{/each}
				</dl>
			</section>

			<section id="limitations" class="scroll-mt-36" aria-labelledby="limitations-heading">
				<div class="max-w-3xl">
					<p class="text-sm font-semibold text-accent">Limitations</p>
					<h2 id="limitations-heading" class="mt-2 font-serif text-3xl font-medium text-ink">
						What this evaluation cannot establish.
					</h2>
					<ul class="mt-6 list-disc space-y-3 pl-6 leading-7 text-muted">
						{#each benchmark.limitations as limitation}
							<li>{limitation}</li>
						{/each}
					</ul>
				</div>
			</section>

			<section id="provenance" class="scroll-mt-36" aria-labelledby="provenance-heading">
				<div class="max-w-3xl">
					<p class="text-sm font-semibold text-accent">Provenance</p>
					<h2 id="provenance-heading" class="mt-2 font-serif text-3xl font-medium text-ink">
						Public identities, without sealed content.
					</h2>
					<p class="mt-4 leading-7 text-muted">
						Cherry creates these lowercase SHA-256 digests from canonical, sanitized public
						structures. Private generation graphs, source locations, prompts, cases, evaluator
						fields, and provider payloads are not exported.
					</p>
				</div>
				<dl class="mt-8 grid gap-4">
					{#each [['Result ID', benchmark.identities.result_id], ['Generation ID', benchmark.identities.generation_id], ['Result content SHA-256', benchmark.identities.result_content_sha256], ['Public contract SHA-256', benchmark.identities.public_contract_sha256], ['Methodology SHA-256', benchmark.identities.methodology_sha256], ['Subject cards SHA-256', benchmark.identities.subject_cards_sha256]] as [label, value]}
						<div
							class="rounded-xl border border-line bg-surface-panel p-4 sm:grid sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-4"
						>
							<dt class="text-sm font-medium text-ink">{label}</dt>
							<dd class="mt-1 break-all font-mono text-xs text-muted sm:mt-0">{value}</dd>
						</div>
					{/each}
				</dl>
				<div class="mt-6 flex flex-wrap gap-3">
					<a
						href={COFFEEBENCH_RESULT_PATH}
						download
						class="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-ink hover:opacity-90"
						>Download sanitized JSON</a
					>
					<a
						href="/benchmarks"
						class="rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-ink hover:bg-surface-panel"
						>All benchmarks</a
					>
				</div>
			</section>
		</div>
	</main>
	<Footer />
</div>
