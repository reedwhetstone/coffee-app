<script lang="ts">
	import type { PageData } from './$types';
	import Footer from '$lib/components/marketing/Footer.svelte';
	import {
		COFFEEBENCH_RESULT_PATH,
		type CoffeeBenchIndependentPublicExport,
		type CoffeeBenchIndependentSubjectResult,
		type CoffeeBenchPairwiseMatchup
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

	function juryFamilyName(family: 'openai' | 'google' | 'anthropic'): string {
		return family === 'openai' ? 'OpenAI' : titleCase(family);
	}

	function formatInteger(value: number): string {
		return new Intl.NumberFormat('en-US').format(value);
	}

	function preferredTreatment(matchup: CoffeeBenchPairwiseMatchup): {
		name: string;
		share: number;
	} {
		if (matchup.subject_a_preference_share === matchup.subject_b_preference_share) {
			return { name: 'Even split', share: matchup.subject_a_preference_share };
		}
		return matchup.subject_a_preference_share > matchup.subject_b_preference_share
			? { name: shortSubjectName(matchup.subject_a), share: matchup.subject_a_preference_share }
			: { name: shortSubjectName(matchup.subject_b), share: matchup.subject_b_preference_share };
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
								CoffeeBench V1
							</p>
							<span
								class="rounded-full border border-line bg-surface-canvas px-3 py-1 text-xs text-muted"
							>
								Published benchmark · complete agent jury
							</span>
						</div>
						<h1 class="mt-3 font-serif text-4xl font-medium tracking-tight text-ink sm:text-5xl">
							Harnessed systems beat Raw. Purveyors-specific lift did not emerge.
						</h1>
						<p class="mt-6 text-lg leading-8 text-muted">
							CoffeeBench holds DeepSeek V4 Flash constant and changes the system around it. Across
							20 matched cases, every harnessed treatment beat Raw. Purveyors Search did not clearly
							beat Pi, and adding Parchment did not improve pairwise quality.
						</p>
					</div>
					<div class="rounded-2xl bg-surface-canvas p-5 ring-1 ring-line">
						<p class="text-xs font-semibold uppercase tracking-wide text-muted">
							Result in one line
						</p>
						<p class="mt-2 font-serif text-xl font-medium text-ink">
							The system-level baseline improved. The product-differentiation hypotheses did not.
						</p>
						<p class="mt-3 text-sm leading-6 text-muted">
							Harnessed treatments were preferred over Raw in 70.3–74.5% of judgments. But V1 does
							not isolate retrieval from orchestration, and it found no measurable incremental lift
							from Parchment.
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
				{#each [['#overview', 'Thesis audit'], ['#findings', 'Findings'], ['#pairwise', 'Pairwise data'], ['#decisions', 'Product decisions'], ['#tracks', 'All metrics'], ['#cohorts', 'Cohorts'], ['#limitations', 'Missing data'], ['#methodology', 'Method'], ['#provenance', 'Data']] as [href, label]}
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
				<p class="font-semibold text-ink">
					Published V1 evidence, with an explicit calibration gap.
				</p>
				<p class="mt-2 max-w-5xl text-sm leading-6 text-muted">
					Three independent model families completed all {formatInteger(
						benchmark.methodology.absolute_evaluation_count
					)} absolute evaluations and {formatInteger(benchmark.methodology.pairwise_ballot_count)} pairwise
					ballots. We are publishing all aggregate findings and matchup counts. Independent human agreement
					was not measured, so this establishes a system result on the frozen suite, not universal model
					superiority.
				</p>
			</div>

			<section id="overview" class="scroll-mt-36" aria-labelledby="overview-heading">
				<div class="max-w-4xl">
					<p class="text-sm font-semibold text-accent">Hypothesis audit</p>
					<h2 id="overview-heading" class="mt-2 font-serif text-3xl font-medium text-ink">
						What V1 tested, including where our thesis failed.
					</h2>
					<p class="mt-4 leading-7 text-muted">
						The same DeepSeek V4 Flash model ran as Raw, Pi Search, Purveyors Search, and Purveyors
						with Parchment plus Search. V1 began with three product hypotheses. One received
						system-level support, one remained unresolved, and one was not supported.
					</p>
				</div>
				<div class="mt-8 grid gap-4 lg:grid-cols-3">
					<article class="rounded-2xl border border-line bg-surface-panel p-6">
						<p class="text-xs font-semibold uppercase tracking-wide text-accent">
							Supported at the system level
						</p>
						<h3 class="mt-2 text-lg font-semibold text-ink">A harnessed system beats Raw.</h3>
						<p class="mt-3 text-sm leading-6 text-muted">
							All three harnessed treatments beat Raw overall. This is not a clean retrieval
							ablation: Raw also removes the agent loop, extra turns, tools, and added context. On
							the historical cohort, the harnessed treatments made zero search calls and still beat
							Raw 58.3–63.6%.
						</p>
					</article>
					<article class="rounded-2xl border border-line bg-surface-panel p-6">
						<p class="text-xs font-semibold uppercase tracking-wide text-accent">Not established</p>
						<h3 class="mt-2 text-lg font-semibold text-ink">Purveyors beats generic search.</h3>
						<p class="mt-3 text-sm leading-6 text-muted">
							Purveyors Search took 55.5% against Pi Search overall, but the quality intervals
							overlap and the direct live-web split narrows to 53.3–46.7. That is a directional
							result, not a demonstrated harness advantage.
						</p>
					</article>
					<article class="rounded-2xl border border-line bg-surface-panel p-6">
						<p class="text-xs font-semibold uppercase tracking-wide text-accent">Not supported</p>
						<h3 class="mt-2 text-lg font-semibold text-ink">Parchment adds incremental quality.</h3>
						<p class="mt-3 text-sm leading-6 text-muted">
							Parchment + Search lost to Purveyors Search 46.8–53.2 overall and 45.0–55.0 on the
							historical cohort; live web was effectively tied at 49.6–50.4. V1 does not prove harm,
							but it provides no Parchment lift.
						</p>
					</article>
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
				<p class="text-sm font-semibold text-accent">What we found</p>
				<h2 id="findings-heading" class="mt-2 max-w-4xl font-serif text-3xl font-medium text-ink">
					One system-level win, one failed hypothesis, and one unresolved contest.
				</h2>
				<p class="mt-4 max-w-4xl leading-7 text-muted">
					The result is not “Purveyors wins,” and V1 cannot attribute the full Raw gap to retrieval
					alone. The defensible conclusion is narrower: complete harnessed systems beat the raw
					model baseline, especially on live-web work, while Purveyors-specific advantages were not
					demonstrated.
				</p>
				<div class="mt-8 grid gap-4 lg:grid-cols-2">
					<article class="rounded-2xl border border-line bg-surface-panel p-6">
						<p class="text-xs font-semibold uppercase tracking-wide text-accent">
							Finding 1 · system-level result
						</p>
						<h3 class="mt-2 text-xl font-semibold text-ink">Harnessed systems beat Raw.</h3>
						<p class="mt-3 text-sm leading-6 text-muted">
							Pi Search, Purveyors Search, and Parchment + Search were preferred to Raw in 70.3%,
							72.2%, and 74.5% of 300 judgments respectively. Raw’s 0.327 quality interval is
							separated below every harnessed treatment. Because the treatment changes more than
							retrieval, this is a system comparison, not isolated retrieval lift.
						</p>
					</article>
					<article class="rounded-2xl border border-line bg-surface-panel p-6">
						<p class="text-xs font-semibold uppercase tracking-wide text-accent">
							Finding 2 · thesis miss
						</p>
						<h3 class="mt-2 text-xl font-semibold text-ink">Parchment lift was not supported.</h3>
						<p class="mt-3 text-sm leading-6 text-muted">
							Adding Parchment did not improve pairwise quality. Purveyors Search beat Parchment +
							Search overall and on historical cases; live web was essentially even. The suite may
							be poorly targeted to Parchment, but that explains the next experiment, not the V1
							result.
						</p>
					</article>
					<article class="rounded-2xl border border-line bg-surface-panel p-6">
						<p class="text-xs font-semibold uppercase tracking-wide text-accent">
							Finding 3 · unresolved
						</p>
						<h3 class="mt-2 text-xl font-semibold text-ink">Purveyors did not separate from Pi.</h3>
						<p class="mt-3 text-sm leading-6 text-muted">
							Purveyors Search ranks first at 0.582 and took 55.5% directly against Pi Search. But
							all three harnessed 95% intervals overlap, and the direct advantage is only 53.3% on
							live web. V1 does not establish a Purveyors orchestration advantage.
						</p>
					</article>
					<article class="rounded-2xl border border-line bg-surface-panel p-6">
						<p class="text-xs font-semibold uppercase tracking-wide text-accent">
							Finding 4 · failure mode
						</p>
						<h3 class="mt-2 text-xl font-semibold text-ink">
							Raw is efficient because it says less.
						</h3>
						<p class="mt-3 text-sm leading-6 text-muted">
							Raw is fastest at 5.8 seconds and uses 73–76% fewer tokens. Its narrow critical-error
							rate is also lowest at 8%. But it misses must-have facts in 41% of trials and produces
							an unacceptable response in 41%, both worst in the field. This is omission, not
							safety.
						</p>
					</article>
					<article class="rounded-2xl border border-line bg-surface-panel p-6 lg:col-span-2">
						<p class="text-xs font-semibold uppercase tracking-wide text-accent">
							Finding 5 · cohort signal
						</p>
						<h3 class="mt-2 text-xl font-semibold text-ink">
							Live search coincides with a much larger gap.
						</h3>
						<p class="mt-3 max-w-5xl text-sm leading-6 text-muted">
							On live-web cases, every search-capable treatment was preferred to Raw in 88.3–90.8%
							of judgments. Raw’s strict pass rate fell to 45% and its unacceptable-response rate
							rose to 55%. This strongly motivates retrieval, but without a same-harness search-off
							arm it still does not identify retrieval as the sole cause.
						</p>
					</article>
				</div>
			</section>

			<section id="pairwise" class="scroll-mt-36" aria-labelledby="pairwise-heading">
				<p class="text-sm font-semibold text-accent">Every head-to-head result</p>
				<h2 id="pairwise-heading" class="mt-2 max-w-4xl font-serif text-3xl font-medium text-ink">
					The complete pairwise evidence, not just the ranking.
				</h2>
				<p class="mt-4 max-w-4xl leading-7 text-muted">
					Each share gives half credit to ties. Expand any matchup to see raw wins, ties, losses,
					and the OpenAI, Google, and Anthropic family splits. All 1,800 ballots are represented.
				</p>

				<div class="mt-8 space-y-8">
					{#each benchmark.slices as slice (slice.slice_id)}
						<div>
							<div class="flex flex-wrap items-baseline justify-between gap-3">
								<h3 class="text-xl font-semibold text-ink">{slice.label}</h3>
								<p class="text-sm text-muted">
									{slice.track_results[0].pairwise_matchups?.[0]?.ballot_count ?? 0} ballots per matchup
								</p>
							</div>
							<div class="mt-4 grid gap-3 lg:grid-cols-2">
								{#each slice.track_results[0].pairwise_matchups ?? [] as matchup (`${slice.slice_id}-${matchup.subject_a}-${matchup.subject_b}`)}
									{@const preferred = preferredTreatment(matchup)}
									<details class="group rounded-2xl border border-line bg-surface-panel p-5">
										<summary class="cursor-pointer list-none">
											<div class="flex items-start justify-between gap-4">
												<div>
													<p class="font-semibold text-ink">
														{shortSubjectName(matchup.subject_a)} vs {shortSubjectName(
															matchup.subject_b
														)}
													</p>
													<p class="mt-1 text-sm text-muted">
														{formatRate(matchup.subject_a_preference_share)} · {formatRate(
															matchup.subject_b_preference_share
														)}
													</p>
												</div>
												<span
													class="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent"
												>
													{preferred.name}
													{formatRate(preferred.share)}
												</span>
											</div>
											<div
												class="mt-4 flex h-2 overflow-hidden rounded-full bg-line"
												aria-hidden="true"
											>
												<div
													class="bg-accent"
													style={`width: ${matchup.subject_a_preference_share * 100}%`}
												></div>
												<div
													class="bg-ink/30"
													style={`width: ${matchup.subject_b_preference_share * 100}%`}
												></div>
											</div>
										</summary>
										<div class="mt-5 border-t border-line pt-5">
											<p class="text-sm text-muted">
												{formatInteger(matchup.subject_a_win_count)}
												{shortSubjectName(matchup.subject_a)} wins ·
												{formatInteger(matchup.tie_count)} ties · {formatInteger(
													matchup.subject_b_win_count
												)}
												{shortSubjectName(matchup.subject_b)} wins
											</p>
											<dl class="mt-4 grid gap-3 sm:grid-cols-3">
												{#each matchup.jury_families as family (family.family)}
													<div class="rounded-xl bg-surface-canvas p-3">
														<dt class="text-xs font-semibold text-ink">
															{juryFamilyName(family.family)}
														</dt>
														<dd class="mt-1 text-xs leading-5 text-muted">
															{formatRate(family.subject_a_preference_share)} · {formatRate(
																family.subject_b_preference_share
															)}<br
															/>{family.subject_a_win_count}–{family.tie_count}–{family.subject_b_win_count}
														</dd>
													</div>
												{/each}
											</dl>
										</div>
									</details>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			</section>

			<section id="decisions" class="scroll-mt-36" aria-labelledby="decisions-heading">
				<p class="text-sm font-semibold text-accent">What V1 changes</p>
				<h2 id="decisions-heading" class="mt-2 max-w-4xl font-serif text-3xl font-medium text-ink">
					Product decisions this evidence supports.
				</h2>
				<div class="mt-8 grid gap-4 md:grid-cols-2">
					{#each [['Keep Raw out of current-information work', 'Raw is cheaper and faster, but its omission rate makes it a poor default when the answer depends on facts outside the prompt.'], ['Stop claiming a Purveyors or Parchment lift', 'V1 did not establish either advantage. Product choices may use other evidence, but this benchmark cannot be cited as proof.'], ['Run clean ablations next', 'Compare the same Purveyors harness with search off versus on, then Parchment off versus on inside a cohort built around structured catalog decisions.'], ['Measure the missing decision variables', 'Capture harness costs and compare benchmark gains with blind expert acceptance before making a quality-cost or production-impact claim.']] as [title, description]}
						<article class="rounded-2xl border border-line bg-surface-panel p-6">
							<h3 class="font-semibold text-ink">{title}</h3>
							<p class="mt-2 text-sm leading-6 text-muted">{description}</p>
						</article>
					{/each}
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
									<dt class="font-medium text-ink">{juryFamilyName(judge.family)}</dt>
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
				<p class="text-sm font-semibold text-accent">Missing or unresolved evidence</p>
				<h2 id="limitations-heading" class="mt-2 font-serif text-3xl font-medium text-ink">
					What V1 cannot establish.
				</h2>
				<p class="mt-4 max-w-4xl leading-7 text-muted">
					These are publication boundaries, not reasons to withhold the observed results. They
					define the next measurements needed before the claims can broaden.
				</p>
				<ul class="mt-8 grid gap-4 md:grid-cols-2">
					{#each benchmark.limitations as limitation}
						<li
							class="rounded-2xl border border-line bg-surface-panel p-5 text-sm leading-6 text-muted"
						>
							{limitation}
						</li>
					{/each}
					<li
						class="rounded-2xl border border-line bg-surface-panel p-5 text-sm leading-6 text-muted"
					>
						V1 has no same-harness search-off arm. Raw changes the harness, tool loop, context, and
						number of model turns together, so the Raw gap cannot be attributed to retrieval alone.
					</li>
					<li
						class="rounded-2xl border border-line bg-surface-panel p-5 text-sm leading-6 text-muted"
					>
						Harness costs are null for Pi Search and both Purveyors treatments. V1 cannot compare
						economics or claim a meaningful quality-cost frontier.
					</li>
					<li
						class="rounded-2xl border border-line bg-surface-panel p-5 text-sm leading-6 text-muted"
					>
						Reasoning-token counts are unavailable, so the token comparison covers reported input
						and output usage, not hidden reasoning usage.
					</li>
					<li
						class="rounded-2xl border border-line bg-surface-panel p-5 text-sm leading-6 text-muted"
					>
						The suite has no isolated Parchment-relevant cohort. Any incremental compliance signal
						is hypothesis-generating, not a demonstrated Parchment lift.
					</li>
					<li
						class="rounded-2xl border border-line bg-surface-panel p-5 text-sm leading-6 text-muted"
					>
						Live-web cases are time-specific. They demonstrate the value of current evidence in this
						run, not permanent correctness of any retrieved source.
					</li>
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
