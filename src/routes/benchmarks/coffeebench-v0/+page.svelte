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
	import { formatDuration, formatMetric, formatRate, formatUsd } from '$lib/benchmarks/display';

	let { data } = $props<{ data: PageData }>();
	let benchmark: CoffeeBenchPublicExport = $derived(data.benchmark);
	let overall = $derived(
		benchmark.slices.find((slice: CoffeeBenchSlice) => slice.slice_id === 'overall')
	);
	let cohortSlices = $derived(
		benchmark.slices.filter((slice: CoffeeBenchSlice) => slice.slice_id !== 'overall')
	);
	let isFixture = $derived(benchmark.status === 'fixture');
	let isPreview = $derived(benchmark.status === 'preview');
	let qualityAvailable = $derived(
		(overall?.track_results ?? []).some((track) =>
			track.subjects.some((result) => result.quality_score !== null)
		)
	);

	function sentenceCase(value: string): string {
		return value.replaceAll('_', ' ');
	}

	function subjectName(subjectId: string): string {
		return (
			benchmark.subjects.find((subject) => subject.subject_id === subjectId)?.display_name ??
			subjectId
		);
	}

	function trackName(track: string): string {
		return (
			benchmark.tracks.find((candidate) => candidate.track_id === track)?.label ??
			sentenceCase(track)
		);
	}
</script>

<div class="bg-surface-canvas">
	<main>
		<header class="border-b border-line bg-surface-panel">
			<div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
				<a href="/benchmarks" class="text-sm font-medium text-accent hover:underline"
					>← Benchmarks</a
				>
				<div class="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
					<div class="max-w-4xl">
						<div class="flex flex-wrap items-center gap-3">
							<p class="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
								CoffeeBench v0
							</p>
							<span
								class="rounded-full border border-line bg-surface-canvas px-3 py-1 text-xs text-muted"
							>
								{isFixture
									? 'Example data · full run not started'
									: isPreview
										? 'Uncalibrated single-judge preview'
										: 'Provisional result'}
							</span>
						</div>
						<h1 class="mt-3 font-serif text-4xl font-medium tracking-tight text-ink sm:text-5xl">
							Can a model make a defensible coffee decision?
						</h1>
						<p class="mt-6 text-lg leading-8 text-muted">
							CoffeeBench evaluates evidence use, belief updating, calibration, actionability, and
							operational performance on a frozen coffee supply-chain analyst suite.
							{isFixture
								? 'The planned publication keeps comparison tracks and evaluator criteria explicit.'
								: 'Published comparison tracks and each subject’s effective evaluator track remain explicit.'}
						</p>
					</div>
					<div class="rounded-2xl bg-surface-canvas p-5 ring-1 ring-line">
						<p class="text-xs font-semibold uppercase tracking-wide text-muted">Benchmark thesis</p>
						<p class="mt-2 font-serif text-xl font-medium text-ink">
							Measure the lift created by the system around the model.
						</p>
						<p class="mt-3 text-sm leading-6 text-muted">
							Hold the base model constant, change its harness and evidence access, then ask whether
							better decisions survive the added cost, latency, and failure risk.
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
				{#each [['#overview', 'Purpose'], ['#findings', 'Findings'], ['#comparison', 'Comparison'], ['#cohorts', 'Cohorts'], ['#harnesses', 'Harnesses'], ['#methodology', 'Methodology'], ['#limitations', 'Limitations'], ['#provenance', 'Provenance']] as [href, label]}
					<a
						{href}
						class="whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium text-muted hover:bg-surface-panel hover:text-ink"
						>{label}</a
					>
				{/each}
			</div>
		</nav>

		<div class="mx-auto max-w-7xl space-y-20 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
			{#if isFixture}
				<div
					class="flex flex-col gap-2 rounded-2xl border border-accent/40 bg-accent/10 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
					role="note"
				>
					<p class="font-semibold text-ink">Example data only. No benchmark result exists yet.</p>
					<p class="max-w-2xl text-sm leading-6 text-muted sm:text-right">
						The reporting software is tested; the full {benchmark.methodology
							.subject_trial_count}-trial panel, judging, and human calibration have not run.
					</p>
				</div>
			{:else if isPreview}
				<div class="rounded-2xl border border-accent/40 bg-accent/10 p-5" role="note">
					<p class="font-semibold text-ink">Measured preview, not a quality leaderboard.</p>
					<p class="mt-2 max-w-4xl text-sm leading-6 text-muted">
						One Luna judge family completed the absolute evaluation pass, but human calibration was
						not run. Every pairwise comparison contained at least one response marked unacceptable,
						so none supplied a model-backed preference for Bradley–Terry fitting. Reliability,
						critical-error, latency, and token results are measured; quality scores and ranks are
						intentionally unavailable.
					</p>
				</div>
			{/if}

			<section id="overview" class="scroll-mt-36" aria-labelledby="overview-heading">
				<div class="max-w-3xl">
					<p class="text-sm font-semibold text-accent">Why CoffeeBench exists</p>
					<h2 id="overview-heading" class="mt-2 font-serif text-3xl font-medium text-ink">
						Measure the system, not just the model.
					</h2>
					<p class="mt-4 leading-7 text-muted">
						Coffee analysis is an evidence task: the answer must use the right facts, respect what
						was knowable at the time, express uncertainty, and lead to a defensible action. A
						generic model leaderboard cannot show whether retrieval, domain tools, or orchestration
						actually improve that work.
					</p>
				</div>
				<div class="mt-8 grid gap-4 md:grid-cols-3">
					<article class="rounded-2xl border border-line bg-surface-panel p-6">
						<p class="text-xs font-semibold uppercase tracking-wide text-accent">Harness lift</p>
						<h3 class="mt-2 text-lg font-semibold text-ink">
							Does the system make the model better?
						</h3>
						<p class="mt-3 text-sm leading-6 text-muted">
							Matched treatments isolate the contribution of search, Purveyors data, Parchment
							tools, and the surrounding agent harness.
						</p>
					</article>
					<article class="rounded-2xl border border-line bg-surface-panel p-6">
						<p class="text-xs font-semibold uppercase tracking-wide text-accent">
							Evidence discipline
						</p>
						<h3 class="mt-2 text-lg font-semibold text-ink">Can the answer be trusted?</h3>
						<p class="mt-3 text-sm leading-6 text-muted">
							Historical controls test hindsight leakage; live-web tasks test current-source use.
							Judges score the criteria each treatment could actually satisfy.
						</p>
					</article>
					<article class="rounded-2xl border border-line bg-surface-panel p-6">
						<p class="text-xs font-semibold uppercase tracking-wide text-accent">
							Decision utility
						</p>
						<h3 class="mt-2 text-lg font-semibold text-ink">Is the lift worth operating?</h3>
						<p class="mt-3 text-sm leading-6 text-muted">
							Quality is read beside failure, token use, normalized cost, and latency so a stronger
							answer is not mistaken for a better production system.
						</p>
					</article>
				</div>
				<dl class="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
					{#each [[isFixture ? 'Planned cases' : 'Cases', benchmark.methodology.case_count], [isFixture ? 'Planned subject trials' : 'Subject trials', benchmark.methodology.subject_trial_count], [isFixture ? 'Planned absolute evaluations' : 'Absolute evaluations', benchmark.methodology.absolute_evaluation_count], [isFixture ? 'Planned pairwise ballots' : 'Pairwise ballots', benchmark.methodology.pairwise_ballot_count], [isFixture ? 'Planned jury families' : 'Jury families', benchmark.methodology.jury_family_count]] as [label, value]}
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

			<section id="findings" class="scroll-mt-36" aria-labelledby="findings-heading">
				<p class="text-sm font-semibold text-accent">Top-line read</p>
				{#if isFixture}
					<div class="mt-2 rounded-3xl border border-accent/40 bg-accent/10 p-6 sm:p-8" role="note">
						<p class="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
							Run status · Not started
						</p>
						<h2 id="findings-heading" class="mt-3 font-serif text-3xl font-medium text-ink">
							The full benchmark panel has not run. There are no performance findings yet.
						</h2>
						<p class="mt-4 max-w-3xl leading-7 text-muted">
							The software contract and page have passed their tests. The {benchmark.methodology
								.subject_trial_count}
							subject trials, {benchmark.methodology.absolute_evaluation_count} absolute evaluations,
							{benchmark.methodology.pairwise_ballot_count} pairwise ballots, and blind human calibration
							remain unexecuted. Every result value below is deterministic example data used only to
							prove the reporting interface.
						</p>
						<div class="mt-6 grid gap-4 sm:grid-cols-2">
							<div class="rounded-2xl bg-surface-panel p-5 ring-1 ring-line">
								<p class="text-xs text-muted">Measured findings</p>
								<p class="mt-1 text-xl font-semibold text-ink">None yet</p>
							</div>
							<div class="rounded-2xl bg-surface-panel p-5 ring-1 ring-line">
								<p class="text-xs text-muted">What this preview proves</p>
								<p class="mt-1 text-sm font-medium leading-6 text-ink">
									Sanitized export → strict validation → responsive publication
								</p>
							</div>
						</div>
					</div>
				{:else if isPreview}
					<div class="mt-2 max-w-4xl">
						<p class="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
							Run status · Measured preview
						</p>
						<h2 id="findings-heading" class="mt-3 font-serif text-3xl font-medium text-ink">
							This run measured reliability and operations, but not a defensible quality ranking.
						</h2>
						<p class="mt-4 max-w-3xl leading-7 text-muted">
							The raw treatment had the lowest observed terminal-failure and critical-error rates in
							this panel. That is operational evidence, not a quality win: all four treatments had
							high unacceptable-response rates, and no pairwise ballot qualified for the quality
							model.
						</p>
					</div>
					<div class="mt-8 grid gap-4 md:grid-cols-3">
						<article class="rounded-2xl border border-line bg-surface-panel p-6">
							<p class="text-xs font-semibold uppercase tracking-wide text-accent">
								Lowest terminal failure
							</p>
							<p class="mt-2 text-3xl font-semibold text-ink">15%</p>
							<p class="mt-2 text-sm leading-6 text-muted">
								DeepSeek V4 Raw, versus 34%–59% for the three harnessed treatments.
							</p>
						</article>
						<article class="rounded-2xl border border-line bg-surface-panel p-6">
							<p class="text-xs font-semibold uppercase tracking-wide text-accent">
								Lowest critical-error rate
							</p>
							<p class="mt-2 text-3xl font-semibold text-ink">30%</p>
							<p class="mt-2 text-sm leading-6 text-muted">
								DeepSeek V4 Raw, versus 47%–61% for the three harnessed treatments.
							</p>
						</article>
						<article class="rounded-2xl border border-line bg-surface-panel p-6">
							<p class="text-xs font-semibold uppercase tracking-wide text-accent">
								Quality ranking
							</p>
							<p class="mt-2 text-3xl font-semibold text-ink">Unavailable</p>
							<p class="mt-2 text-sm leading-6 text-muted">
								0 of 600 pairwise ballots supplied an eligible model-backed preference.
							</p>
						</article>
					</div>
				{:else}
					<div class="mt-2 max-w-3xl">
						<h2 id="findings-heading" class="font-serif text-3xl font-medium text-ink">
							What this run found, and what it does not prove.
						</h2>
						<p class="mt-4 leading-7 text-muted">
							The leaders below are precomputed within their matched comparison tracks. They
							estimate harness contribution for these treatments and cases; they do not establish
							universal model superiority.
						</p>
					</div>
					<div class="mt-8 grid gap-4 md:grid-cols-2">
						{#each overall?.track_results ?? [] as trackResult (trackResult.track)}
							{#each trackResult.subjects.filter((result) => result.rank === 1) as result (result.subject_id)}
								<article class="rounded-2xl border border-line bg-surface-panel p-6">
									<p class="text-xs font-semibold uppercase tracking-wide text-accent">
										{trackName(trackResult.track)} quality leader
									</p>
									<h3 class="mt-2 text-xl font-semibold text-ink">
										{subjectName(result.subject_id)}
									</h3>
									<p class="mt-3 text-sm leading-6 text-muted">
										Quality {formatMetric(result.quality_score, 3)} · 95% interval {formatMetric(
											result.quality_interval_95.lower,
											3
										)}–{formatMetric(result.quality_interval_95.upper, 3)}. Read this lead beside
										the operational trade-offs below before selecting a system.
									</p>
								</article>
							{/each}
						{/each}
						<article class="rounded-2xl border border-line bg-surface-panel p-6">
							<p class="text-xs font-semibold uppercase tracking-wide text-accent">Implication</p>
							<h3 class="mt-2 text-xl font-semibold text-ink">
								Quality alone is not the decision.
							</h3>
							<p class="mt-3 text-sm leading-6 text-muted">
								The practical winner is the treatment whose quality lift remains defensible after
								cost, latency, failures, critical errors, and confidence calibration are considered
								together.
							</p>
						</article>
					</div>
				{/if}
			</section>

			<section id="comparison" class="scroll-mt-36" aria-labelledby="comparison-heading">
				<div class="max-w-3xl">
					<p class="text-sm font-semibold text-accent">
						{isFixture ? 'Preview of the result structure' : 'Overall comparison'}
					</p>
					<h2 id="comparison-heading" class="mt-2 font-serif text-3xl font-medium text-ink">
						{qualityAvailable
							? 'Quality beside cost, latency, and failure.'
							: 'Reliability, latency, and token evidence without a quality rank.'}
					</h2>
					<p class="mt-4 leading-7 text-muted">
						{qualityAvailable
							? 'Start with quality and its uncertainty, then test whether the apparent lift survives cost, latency, and failure.'
							: 'Bradley–Terry scores are unavailable because no pairwise ballot supplied an eligible model-backed preference. Compare the measured outcome rates and operational evidence without inferring a quality order.'}
						Every value is copied from Cherry’s precomputed export; this app does not derive rank, intervals,
						cost, rates, or Pareto status.
					</p>
				</div>
				<div class="mt-6 grid gap-3 sm:grid-cols-3" aria-label="Recommended result reading order">
					{#each qualityAvailable ? [['1', 'Quality', 'Compare scores and uncertainty before calling a leader.'], ['2', 'Trade-offs', 'Ask what extra tokens, cost, and latency buy.'], ['3', 'Reliability', 'Check failures, critical errors, and calibration before acting.']] : [['1', 'Reliability', 'Compare failure, unacceptable-response, and critical-error rates.'], ['2', 'Operations', 'Read latency and token use without converting them into a quality claim.'], ['3', 'Limits', 'Keep the single-judge, uncalibrated, and salvage disclosures attached.']] as [step, label, explanation]}
						<div class="rounded-xl border border-line bg-surface-panel p-4">
							<p class="text-xs font-semibold text-accent">{step} · {label}</p>
							<p class="mt-1 text-xs leading-5 text-muted">{explanation}</p>
						</div>
					{/each}
				</div>
				{#if overall}
					<div class="mt-10 space-y-14">
						{#each overall.track_results as trackResult (trackResult.track)}
							<BenchmarkVisuals {trackResult} subjects={benchmark.subjects} fixture={isFixture} />
							<TrackResults {trackResult} subjects={benchmark.subjects} fixture={isFixture} />
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
									<TrackResults
										{trackResult}
										subjects={benchmark.subjects}
										compactHeading
										fixture={isFixture}
									/>
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
							{benchmark.jury.length === 1
								? 'One preview judge family; human calibration not run.'
								: `${benchmark.jury.length} judge families, one pinned calibration sample.`}
						</h2>
						<div
							class={benchmark.jury.length > 1
								? 'mt-6 grid gap-4 sm:grid-cols-3'
								: 'mt-6 grid gap-4'}
						>
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
						{#if benchmark.calibration.agreement}
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
						{:else}
							<p class="mt-3 text-3xl font-semibold text-ink">Not run</p>
							<p class="mt-3 text-sm leading-6 text-muted">
								No human calibration decision or agreement rate exists for this preview. The single
								judge’s measurements must remain attached to that limitation.
							</p>
						{/if}
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
				<p class="mt-4 max-w-3xl text-xs leading-5 text-muted">
					Research artifact only. The immutable JSON contains aggregate public values and sanitized
					identities, never cases, evidence, prompts, evaluator guardrails, or provider payloads.
				</p>
			</section>
		</div>
	</main>
	<Footer />
</div>
