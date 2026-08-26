<script lang="ts">
	import type { PageData } from './$types';
	import Footer from '$lib/components/marketing/Footer.svelte';
	import {
		COFFEEBENCH_RESULT_PATH,
		type CoffeeBenchIndependentPublicExport,
		type CoffeeBenchIndependentSubjectResult
	} from '$lib/benchmarks/coffeebench';
	import { formatDuration, formatMetric, formatRate, formatUsd } from '$lib/benchmarks/display';

	let { data } = $props<{ data: PageData }>();
	let benchmark: CoffeeBenchIndependentPublicExport = $derived(data.benchmark);
	let overall = $derived(
		benchmark.slices.find((slice) => slice.slice_id === 'overall') ?? benchmark.slices[0]
	);
	let overallResults = $derived(
		[...overall.track_results[0].subjects].sort(
			(left, right) =>
				(left.pairwise_quality.rank ?? Number.MAX_SAFE_INTEGER) -
				(right.pairwise_quality.rank ?? Number.MAX_SAFE_INTEGER)
		)
	);
	let cohortSlices = $derived(benchmark.slices.filter((slice) => slice.slice_id !== 'overall'));

	function subject(subjectId: string) {
		return benchmark.subjects.find((candidate) => candidate.subject_id === subjectId);
	}

	function subjectName(subjectId: string): string {
		return subject(subjectId)?.display_name ?? subjectId;
	}

	function shortSubjectName(subjectId: string): string {
		return subjectName(subjectId).replace('DeepSeek V4 with ', '').replace('DeepSeek V4 ', '');
	}

	function qualityInterval(result: CoffeeBenchIndependentSubjectResult): string {
		return `${formatMetric(result.pairwise_quality.interval_95.lower, 3)}–${formatMetric(
			result.pairwise_quality.interval_95.upper,
			3
		)}`;
	}

	function titleCase(value: string): string {
		return value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
	}

	function formatInteger(value: number): string {
		return new Intl.NumberFormat('en-US').format(value);
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
								Uncalibrated three-family agent-jury preview
							</span>
						</div>
						<h1 class="mt-3 font-serif text-4xl font-medium tracking-tight text-ink sm:text-5xl">
							Can a model make a defensible coffee decision?
						</h1>
						<p class="mt-6 text-lg leading-8 text-muted">
							CoffeeBench holds the base model constant and changes its evidence tools and agent
							harness. This run reports agent-jury preference, rubric outcomes, and operational
							reliability as three independent views.
						</p>
					</div>
					<div class="rounded-2xl bg-surface-canvas p-5 ring-1 ring-line">
						<p class="text-xs font-semibold uppercase tracking-wide text-muted">
							Result in one line
						</p>
						<p class="mt-2 font-serif text-xl font-medium text-ink">
							Purveyors Search led agent-jury quality; Raw was fastest and the only treatment with
							published cost.
						</p>
						<p class="mt-3 text-sm leading-6 text-muted">
							The top three quality intervals overlap, costs are unavailable for three harnesses,
							and no composite score is reported.
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
				{#each [['#overview', 'Purpose'], ['#findings', 'Findings'], ['#tracks', 'Independent tracks'], ['#cohorts', 'Cohorts'], ['#harnesses', 'Harnesses'], ['#methodology', 'Methodology'], ['#limitations', 'Limitations'], ['#provenance', 'Provenance']] as [href, label]}
					<a
						{href}
						class="whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium text-muted hover:bg-surface-panel hover:text-ink"
						>{label}</a
					>
				{/each}
			</div>
		</nav>

		<div class="mx-auto max-w-7xl space-y-20 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
			<div class="rounded-2xl border border-accent/40 bg-accent/10 p-5" role="note">
				<p class="font-semibold text-ink">Agent-jury evidence, not human ground truth.</p>
				<p class="mt-2 max-w-5xl text-sm leading-6 text-muted">
					Three independent model families completed all {formatInteger(
						benchmark.methodology.absolute_evaluation_count
					)} absolute evaluations and {formatInteger(benchmark.methodology.pairwise_ballot_count)} pairwise
					ballots. Independent human agreement was not measured, so these ranks describe the jury’s preferences
					on this frozen suite and do not establish broad superiority.
				</p>
			</div>

			<section id="overview" class="scroll-mt-36" aria-labelledby="overview-heading">
				<div class="max-w-3xl">
					<p class="text-sm font-semibold text-accent">Why CoffeeBench exists</p>
					<h2 id="overview-heading" class="mt-2 font-serif text-3xl font-medium text-ink">
						Measure the system, not just the model.
					</h2>
					<p class="mt-4 leading-7 text-muted">
						Coffee analysis is an evidence task. An answer must use the right facts, respect what
						was knowable at the time, express uncertainty, and lead to a defensible action. This
						matched evaluation tests whether retrieval, domain data, or orchestration improve that
						work without hiding their operational tradeoffs.
					</p>
				</div>
				<dl class="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
					{#each [['Cases', formatInteger(benchmark.methodology.case_count)], ['Subject trials', formatInteger(benchmark.methodology.subject_trial_count)], ['Absolute evaluations', formatInteger(benchmark.methodology.absolute_evaluation_count)], ['Pairwise ballots', formatInteger(benchmark.methodology.pairwise_ballot_count)], ['Ballot coverage', formatRate(benchmark.methodology.pairwise_ballot_count / benchmark.methodology.pairwise_possible_ballot_count)], ['Jury families', formatInteger(benchmark.methodology.jury_family_count)]] as [label, value]}
						<div class="rounded-2xl border border-line bg-surface-panel p-5">
							<dt class="text-xs text-muted">{label}</dt>
							<dd class="mt-2 text-2xl font-semibold text-ink">{value}</dd>
						</div>
					{/each}
				</dl>
			</section>

			<section id="findings" class="scroll-mt-36" aria-labelledby="findings-heading">
				<p class="text-sm font-semibold text-accent">Top-line read</p>
				<h2 id="findings-heading" class="mt-2 max-w-4xl font-serif text-3xl font-medium text-ink">
					Purveyors Search ranked first in agent-jury quality, with important caveats.
				</h2>
				<p class="mt-4 max-w-4xl leading-7 text-muted">
					Its Bradley–Terry score was 0.582. The top three intervals overlap, so the result does not
					support a clean separation among the three search-enabled treatments. Raw ranked fourth in
					pairwise quality while remaining fastest and lowest on critical errors. It was the only
					treatment with published cost and also had the highest unacceptable-response rate.
				</p>
				<div class="mt-8 grid gap-4 md:grid-cols-3">
					<article class="rounded-2xl border border-line bg-surface-panel p-6">
						<p class="text-xs font-semibold uppercase tracking-wide text-accent">
							Agent-jury quality leader
						</p>
						<p class="mt-2 text-3xl font-semibold text-ink">0.582</p>
						<p class="mt-2 text-sm leading-6 text-muted">
							Purveyors Search, rank #1. Its 95% interval was 0.547–0.619.
						</p>
					</article>
					<article class="rounded-2xl border border-line bg-surface-panel p-6">
						<p class="text-xs font-semibold uppercase tracking-wide text-accent">Fastest median</p>
						<p class="mt-2 text-3xl font-semibold text-ink">5.8 s</p>
						<p class="mt-2 text-sm leading-6 text-muted">
							Raw, compared with 8.8–9.8 seconds for the three search-enabled treatments.
						</p>
					</article>
					<article class="rounded-2xl border border-line bg-surface-panel p-6">
						<p class="text-xs font-semibold uppercase tracking-wide text-accent">Raw tradeoff</p>
						<p class="mt-2 text-3xl font-semibold text-ink">8% / 41%</p>
						<p class="mt-2 text-sm leading-6 text-muted">
							Lowest critical-error rate, but highest unacceptable-response rate.
						</p>
					</article>
				</div>
			</section>

			<section id="tracks" class="scroll-mt-36" aria-labelledby="tracks-heading">
				<div class="max-w-4xl">
					<p class="text-sm font-semibold text-accent">Complete result</p>
					<h2 id="tracks-heading" class="mt-2 font-serif text-3xl font-medium text-ink">
						Three independent tracks, no composite score.
					</h2>
					<p class="mt-4 leading-7 text-muted">
						Pairwise quality is an agent-jury preference estimate. Absolute rubric results count
						declared requirements and errors. Operational results report failures, latency, tokens,
						and cost. One view never silently overrides another.
					</p>
				</div>

				<div class="mt-8 grid gap-4 md:grid-cols-3">
					{#each [['Pairwise quality', 'Agent preference rank, score, interval, and full ballot coverage.'], ['Absolute rubric', 'Strict pass, critical error, confidence, and unacceptable-response rates.'], ['Operational reliability', 'Terminal and contract outcomes, transport, latency, token use, and cost.']] as [title, description]}
						<article class="rounded-2xl border border-line bg-surface-panel p-5">
							<h3 class="font-semibold text-ink">{title}</h3>
							<p class="mt-2 text-sm leading-6 text-muted">{description}</p>
						</article>
					{/each}
				</div>

				<div class="mt-8 space-y-4 md:hidden" aria-label="Overall subject result cards">
					{#each overallResults as result (result.subject_id)}
						<article class="rounded-2xl border border-line bg-surface-panel p-5">
							<div class="flex items-start justify-between gap-4">
								<h3 class="font-semibold text-ink">{shortSubjectName(result.subject_id)}</h3>
								<span class="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent"
									>Quality #{result.pairwise_quality.rank}</span
								>
							</div>
							<dl class="mt-5 grid grid-cols-2 gap-x-4 gap-y-5 text-sm">
								<div>
									<dt class="text-muted">Quality score · 95% CI</dt>
									<dd class="mt-1 font-medium text-ink">
										{formatMetric(result.pairwise_quality.score, 3)} · {qualityInterval(result)}
									</dd>
								</div>
								<div>
									<dt class="text-muted">Strict rubric pass</dt>
									<dd class="mt-1 font-medium text-ink">
										{formatRate(result.absolute_rubric.strict_all_requirements_pass_rate)}
									</dd>
								</div>
								<div>
									<dt class="text-muted">Critical / unacceptable</dt>
									<dd class="mt-1 font-medium text-ink">
										{formatRate(result.absolute_rubric.critical_error_rate)} / {formatRate(
											result.absolute_rubric.unacceptable_response_rate
										)}
									</dd>
								</div>
								<div>
									<dt class="text-muted">Terminal / contract</dt>
									<dd class="mt-1 font-medium text-ink">
										{formatRate(result.operational.terminal_failure_rate)} / {formatRate(
											result.operational.response_contract_valid_rate
										)}
									</dd>
								</div>
								<div>
									<dt class="text-muted">Median latency</dt>
									<dd class="mt-1 font-medium text-ink">
										{formatDuration(result.operational.latency.end_to_end_ms.p50)}
									</dd>
								</div>
								<div>
									<dt class="text-muted">Normalized cost / task</dt>
									<dd class="mt-1 font-medium text-ink">
										{formatUsd(result.operational.cost.normalized_cost_usd.per_attempted_task)}
									</dd>
								</div>
							</dl>
						</article>
					{/each}
				</div>

				<div
					class="mt-8 hidden overflow-x-auto rounded-2xl border border-line bg-surface-panel md:block"
				>
					<table class="w-full min-w-[76rem] text-left text-sm">
						<caption class="sr-only">Overall independent-track CoffeeBench result</caption>
						<thead class="border-b border-line bg-surface-canvas text-xs text-muted">
							<tr>
								<th class="px-5 py-4 font-medium" scope="col">Treatment</th>
								<th class="px-4 py-4 font-medium" scope="col">Quality rank</th>
								<th class="px-4 py-4 font-medium" scope="col">Score · 95% CI</th>
								<th class="px-4 py-4 font-medium" scope="col">Strict pass</th>
								<th class="px-4 py-4 font-medium" scope="col">Critical</th>
								<th class="px-4 py-4 font-medium" scope="col">Unacceptable</th>
								<th class="px-4 py-4 font-medium" scope="col">Terminal failure</th>
								<th class="px-4 py-4 font-medium" scope="col">Contract valid</th>
								<th class="px-4 py-4 font-medium" scope="col">Median latency</th>
								<th class="px-4 py-4 font-medium" scope="col">Cost / task</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-line">
							{#each overallResults as result (result.subject_id)}
								<tr>
									<th class="px-5 py-4 font-medium text-ink" scope="row">
										{shortSubjectName(result.subject_id)}
									</th>
									<td class="px-4 py-4 font-semibold text-ink">#{result.pairwise_quality.rank}</td>
									<td class="px-4 py-4 text-ink">
										{formatMetric(result.pairwise_quality.score, 3)} · {qualityInterval(result)}
									</td>
									<td class="px-4 py-4 text-ink"
										>{formatRate(result.absolute_rubric.strict_all_requirements_pass_rate)}</td
									>
									<td class="px-4 py-4 text-ink"
										>{formatRate(result.absolute_rubric.critical_error_rate)}</td
									>
									<td class="px-4 py-4 text-ink"
										>{formatRate(result.absolute_rubric.unacceptable_response_rate)}</td
									>
									<td class="px-4 py-4 text-ink"
										>{formatRate(result.operational.terminal_failure_rate)}</td
									>
									<td class="px-4 py-4 text-ink"
										>{formatRate(result.operational.response_contract_valid_rate)}</td
									>
									<td class="px-4 py-4 text-ink"
										>{formatDuration(result.operational.latency.end_to_end_ms.p50)}</td
									>
									<td class="px-4 py-4 text-ink">
										{formatUsd(result.operational.cost.normalized_cost_usd.per_attempted_task)}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<p class="mt-4 text-sm leading-6 text-muted">
					Costs are unavailable for the three harnessed treatments, so only Raw has a computed
					quality-cost-latency Pareto classification. “Unavailable” never means zero.
				</p>
			</section>

			<section id="cohorts" class="scroll-mt-36" aria-labelledby="cohorts-heading">
				<p class="text-sm font-semibold text-accent">Cohort detail</p>
				<h2 id="cohorts-heading" class="mt-2 font-serif text-3xl font-medium text-ink">
					Historical-control and live-web results stay visible.
				</h2>
				<div class="mt-8 grid gap-6 xl:grid-cols-2">
					{#each cohortSlices as slice (slice.slice_id)}
						<article class="overflow-hidden rounded-2xl border border-line bg-surface-panel">
							<div class="border-b border-line p-5">
								<h3 class="text-lg font-semibold text-ink">{slice.label}</h3>
								<p class="mt-1 text-sm text-muted">
									{slice.track_results[0].subjects[0].operational.trial_count} trials per treatment
								</p>
							</div>
							<div class="overflow-x-auto">
								<table class="w-full min-w-[40rem] text-left text-sm">
									<thead class="bg-surface-canvas text-xs text-muted">
										<tr>
											<th class="px-5 py-3 font-medium" scope="col">Treatment</th>
											<th class="px-3 py-3 font-medium" scope="col">Quality</th>
											<th class="px-3 py-3 font-medium" scope="col">Strict pass</th>
											<th class="px-3 py-3 font-medium" scope="col">Unacceptable</th>
											<th class="px-3 py-3 font-medium" scope="col">Median</th>
										</tr>
									</thead>
									<tbody class="divide-y divide-line">
										{#each [...slice.track_results[0].subjects].sort((left, right) => (left.pairwise_quality.rank ?? Number.MAX_SAFE_INTEGER) - (right.pairwise_quality.rank ?? Number.MAX_SAFE_INTEGER)) as result (result.subject_id)}
											<tr>
												<th class="px-5 py-3 font-medium text-ink" scope="row">
													{shortSubjectName(result.subject_id)}
												</th>
												<td class="px-3 py-3 text-ink">
													#{result.pairwise_quality.rank} · {formatMetric(
														result.pairwise_quality.score,
														3
													)}
												</td>
												<td class="px-3 py-3 text-ink"
													>{formatRate(
														result.absolute_rubric.strict_all_requirements_pass_rate
													)}</td
												>
												<td class="px-3 py-3 text-ink"
													>{formatRate(result.absolute_rubric.unacceptable_response_rate)}</td
												>
												<td class="px-3 py-3 text-ink"
													>{formatDuration(result.operational.latency.end_to_end_ms.p50)}</td
												>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</article>
					{/each}
				</div>
			</section>

			<section id="harnesses" class="scroll-mt-36" aria-labelledby="harnesses-heading">
				<p class="text-sm font-semibold text-accent">Declared treatments</p>
				<h2 id="harnesses-heading" class="mt-2 font-serif text-3xl font-medium text-ink">
					What each subject was allowed to be.
				</h2>
				<div class="mt-8 grid gap-4 md:grid-cols-2">
					{#each benchmark.subjects as card (card.subject_id)}
						<article class="rounded-2xl border border-line bg-surface-panel p-6">
							<div class="flex flex-wrap items-start justify-between gap-3">
								<h3 class="text-lg font-semibold text-ink">{card.display_name}</h3>
								<span class="rounded-full bg-surface-canvas px-3 py-1 text-xs text-muted">
									{titleCase(card.harness_family)}
								</span>
							</div>
							<p class="mt-3 text-sm leading-6 text-muted">
								Evaluator track: {card.evaluator_track}. Capabilities: {card.capabilities.join(
									', '
								)}.
							</p>
							<p class="mt-3 break-all font-mono text-xs text-muted">Card {card.card_sha256}</p>
						</article>
					{/each}
				</div>
			</section>

			<section id="methodology" class="scroll-mt-36" aria-labelledby="methodology-heading">
				<p class="text-sm font-semibold text-accent">Methodology</p>
				<h2 id="methodology-heading" class="mt-2 font-serif text-3xl font-medium text-ink">
					A complete jury, reported without invented certainty.
				</h2>
				<div class="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
					<div class="rounded-2xl border border-line bg-surface-panel p-6">
						<dl class="space-y-5 text-sm">
							<div>
								<dt class="font-semibold text-ink">Pairwise quality</dt>
								<dd class="mt-1 leading-6 text-muted">
									{benchmark.methodology.pairwise_quality_rule}
								</dd>
							</div>
							<div>
								<dt class="font-semibold text-ink">Absolute rubric</dt>
								<dd class="mt-1 leading-6 text-muted">
									{benchmark.methodology.absolute_rubric_rule}
								</dd>
							</div>
							<div>
								<dt class="font-semibold text-ink">Operational reliability</dt>
								<dd class="mt-1 leading-6 text-muted">
									{benchmark.methodology.operational_reliability_rule}
								</dd>
							</div>
							<div>
								<dt class="font-semibold text-ink">Uncertainty</dt>
								<dd class="mt-1 leading-6 text-muted">{benchmark.methodology.uncertainty}</dd>
							</div>
						</dl>
					</div>
					<div class="rounded-2xl border border-line bg-surface-panel p-6">
						<h3 class="font-semibold text-ink">Three judge families; calibration not run.</h3>
						<p class="mt-3 text-sm leading-6 text-muted">
							OpenAI, Google, and Anthropic agents supplied the complete official jury. Their votes
							are preserved as agent judgments; no human decisions were used to rewrite them.
						</p>
						<dl class="mt-5 space-y-4">
							{#each benchmark.jury as judge (judge.family)}
								<div
									class="flex items-start justify-between gap-4 border-t border-line pt-4 first:border-0 first:pt-0"
								>
									<dt class="font-medium text-ink">{titleCase(judge.family)}</dt>
									<dd class="text-right text-sm text-muted">
										{formatInteger(judge.call_count)} calls · p50 {formatDuration(
											judge.latency_ms.p50
										)}
									</dd>
								</div>
							{/each}
						</dl>
					</div>
				</div>
			</section>

			<section id="limitations" class="scroll-mt-36" aria-labelledby="limitations-heading">
				<p class="text-sm font-semibold text-accent">Read before comparing</p>
				<h2 id="limitations-heading" class="mt-2 font-serif text-3xl font-medium text-ink">
					What this preview cannot establish.
				</h2>
				<ul class="mt-8 grid gap-4 md:grid-cols-2">
					{#each benchmark.limitations as limitation}
						<li
							class="rounded-2xl border border-line bg-surface-panel p-5 text-sm leading-6 text-muted"
						>
							{limitation}
						</li>
					{/each}
				</ul>
			</section>

			<section id="provenance" class="scroll-mt-36" aria-labelledby="provenance-heading">
				<p class="text-sm font-semibold text-accent">Replayable publication</p>
				<h2 id="provenance-heading" class="mt-2 font-serif text-3xl font-medium text-ink">
					Public identities, without sealed content.
				</h2>
				<p class="mt-4 max-w-3xl leading-7 text-muted">
					The downloadable JSON is the exact validated Cherry export. Content identities bind its
					methodology, subject cards, contract, and result while evaluator prompts and private
					provider payloads remain excluded.
				</p>
				<div class="mt-8 rounded-2xl border border-line bg-surface-panel p-6">
					<dl class="grid gap-6 md:grid-cols-2">
						<div>
							<dt class="text-xs font-semibold uppercase tracking-wide text-muted">
								Result version
							</dt>
							<dd class="mt-2 break-all font-mono text-xs text-ink">{benchmark.result_version}</dd>
						</div>
						<div>
							<dt class="text-xs font-semibold uppercase tracking-wide text-muted">
								Result content SHA-256
							</dt>
							<dd class="mt-2 break-all font-mono text-xs text-ink">
								{benchmark.identities.result_content_sha256}
							</dd>
						</div>
						<div>
							<dt class="text-xs font-semibold uppercase tracking-wide text-muted">
								Methodology SHA-256
							</dt>
							<dd class="mt-2 break-all font-mono text-xs text-ink">
								{benchmark.identities.methodology_sha256}
							</dd>
						</div>
						<div>
							<dt class="text-xs font-semibold uppercase tracking-wide text-muted">
								Subject cards SHA-256
							</dt>
							<dd class="mt-2 break-all font-mono text-xs text-ink">
								{benchmark.identities.subject_cards_sha256}
							</dd>
						</div>
					</dl>
					<a
						href={COFFEEBENCH_RESULT_PATH}
						class="mt-8 inline-flex rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white hover:opacity-90"
						download
					>
						Download sanitized JSON
					</a>
				</div>
			</section>
		</div>
	</main>
	<Footer />
</div>
