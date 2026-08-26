<script lang="ts">
	import type { PageData } from './$types';
	import Footer from '$lib/components/marketing/Footer.svelte';
	import CoffeeBenchJuryBreakdown from '$lib/components/benchmarks/CoffeeBenchJuryBreakdown.svelte';
	import CoffeeBenchResearchFigures from '$lib/components/benchmarks/CoffeeBenchResearchFigures.svelte';
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
	let historical = $derived(
		benchmark.slices.find((slice) => slice.slice_id === 'historical_control') ?? benchmark.slices[0]
	);
	let liveWeb = $derived(
		benchmark.slices.find((slice) => slice.slice_id === 'live_web') ?? benchmark.slices[0]
	);
	let overallResults = $derived(
		[...overall.track_results[0].subjects].sort(
			(left, right) =>
				(left.pairwise_quality.rank ?? Number.MAX_SAFE_INTEGER) -
				(right.pairwise_quality.rank ?? Number.MAX_SAFE_INTEGER)
		)
	);

	const treatmentDetails = [
		{
			name: 'Raw',
			system: 'One direct model request, without a system prompt or agent loop.',
			tools: 'No tools in either cohort.'
		},
		{
			name: 'Pi Search',
			system: 'Pi agent loop with a general research prompt and up to five steps.',
			tools: 'Brave search and page fetch on live-web cases only.'
		},
		{
			name: 'Purveyors Search',
			system: 'Purveyors AI SDK loop with a green-coffee decision prompt and up to five steps.',
			tools: 'The same Brave search and page fetch contract as Pi.'
		},
		{
			name: 'Purveyors + Parchment + Search',
			system: 'The same Purveyors loop, prompt, model, and step budget.',
			tools: 'The shared web tools plus a frozen Parchment catalog snapshot.'
		}
	] as const;

	function subjectName(subjectId: string): string {
		return (
			benchmark.subjects.find((subject) => subject.subject_id === subjectId)?.display_name ??
			subjectId
		)
			.replace('DeepSeek V4 with ', '')
			.replace('DeepSeek V4 ', '');
	}

	function qualityInterval(result: CoffeeBenchIndependentSubjectResult): string {
		return `${formatMetric(result.pairwise_quality.interval_95.lower, 3)}–${formatMetric(
			result.pairwise_quality.interval_95.upper,
			3
		)}`;
	}

	function formatInteger(value: number): string {
		return new Intl.NumberFormat('en-US').format(value);
	}

	function formatTokens(value: number | null): string {
		return value === null ? 'Unavailable' : formatInteger(Math.round(value));
	}
</script>

<div class="bg-surface-canvas">
	<main>
		<header class="border-b border-line bg-surface-panel">
			<div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
				<a href="/benchmarks" class="text-sm font-medium text-accent hover:underline"
					>← Benchmarks</a
				>
				<div class="mt-7 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
					<div class="max-w-4xl">
						<p class="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
							CoffeeBench V1 · Research report
						</p>
						<h1 class="mt-4 font-serif text-4xl font-medium tracking-tight text-ink sm:text-6xl">
							The harness mattered more than the specialist tools.
						</h1>
						<p class="mt-6 max-w-3xl text-lg leading-8 text-muted">
							Across 20 matched coffee-research cases, every agent harness was preferred to a raw
							model request. We did not find a clear winner among the harnesses, and an
							always-visible catalog tool added work without improving answer quality.
						</p>
					</div>
					<dl class="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-line ring-1 ring-line">
						{#each [['Cases', formatInteger(benchmark.methodology.case_count)], ['System trials', formatInteger(benchmark.methodology.subject_trial_count)], ['Pairwise votes', formatInteger(benchmark.methodology.pairwise_ballot_count)], ['Judge families', formatInteger(benchmark.methodology.jury_family_count)]] as [label, value]}
							<div class="bg-surface-canvas p-4">
								<dt class="text-xs text-muted">{label}</dt>
								<dd class="mt-1 text-xl font-semibold text-ink">{value}</dd>
							</div>
						{/each}
					</dl>
				</div>
			</div>
		</header>

		<nav
			class="sticky top-[73px] z-30 overflow-x-auto border-b border-line bg-surface-canvas/95 backdrop-blur"
			aria-label="CoffeeBench report sections"
		>
			<div class="mx-auto flex max-w-7xl gap-1 px-4 py-2 sm:px-6 lg:px-8">
				{#each [['#abstract', 'Abstract'], ['#results', 'Results'], ['#experiment', 'Experiment'], ['#jury', 'Judge votes'], ['#discussion', 'Discussion'], ['#methods', 'Methods & data']] as [href, label]}
					<a
						{href}
						class="whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium text-muted hover:bg-surface-panel hover:text-ink"
						>{label}</a
					>
				{/each}
			</div>
		</nav>

		<div class="mx-auto max-w-7xl space-y-24 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
			<section id="abstract" class="scroll-mt-36" aria-labelledby="abstract-heading">
				<div class="grid gap-8 lg:grid-cols-[9rem_minmax(0,1fr)]">
					<p class="text-sm font-semibold uppercase tracking-[0.16em] text-accent">Abstract</p>
					<div class="max-w-4xl">
						<h2 id="abstract-heading" class="sr-only">Abstract</h2>
						<p class="font-serif text-2xl leading-9 text-ink sm:text-3xl sm:leading-10">
							CoffeeBench V1 asked how much the system around a fixed model changes its ability to
							answer real coffee-industry research questions.
						</p>
						<p class="mt-5 leading-7 text-muted">
							We ran DeepSeek V4 Flash as a raw request and inside three agent harnesses. Harnessed
							systems were preferred over Raw in 70.3–74.5% of overall pairwise judgments and
							88.3–90.8% on live-web cases. Purveyors Search ranked first, but its uncertainty
							overlapped the other harnesses. Adding a frozen Parchment catalog did not improve
							pairwise quality. Trace analysis suggests a useful design principle for the next
							round: specialized capabilities should appear when their evidence is relevant, not
							simply because they are available.
						</p>
					</div>
				</div>
			</section>

			<section id="results" class="scroll-mt-36" aria-labelledby="results-heading">
				<div class="max-w-4xl">
					<p class="text-sm font-semibold text-accent">Results</p>
					<h2 id="results-heading" class="mt-2 font-serif text-4xl font-medium text-ink">
						Three findings changed what we want to test next.
					</h2>
				</div>

				<div class="mt-10 grid gap-8 border-y border-line py-8 lg:grid-cols-3">
					<article>
						<p class="text-sm font-semibold text-chart-rust">01</p>
						<h3 class="mt-3 text-xl font-semibold text-ink">
							A capable harness beat a raw request.
						</h3>
						<p class="mt-3 text-sm leading-6 text-muted">
							The largest effect appeared when the task required current information. Yet harnesses
							also beat Raw on historical-control cases with search disabled, so retrieval alone
							does not explain the gain.
						</p>
					</article>
					<article>
						<p class="text-sm font-semibold text-chart-teal">02</p>
						<h3 class="mt-3 text-xl font-semibold text-ink">
							Purveyors led directionally, not decisively.
						</h3>
						<p class="mt-3 text-sm leading-6 text-muted">
							Purveyors Search received 55.5% against Pi Search overall, but the quality intervals
							overlap and the live-web head-to-head narrowed to 53.3–46.7. V1 does not establish a
							harness winner.
						</p>
					</article>
					<article>
						<p class="text-sm font-semibold text-chart-plum">03</p>
						<h3 class="mt-3 text-xl font-semibold text-ink">
							An irrelevant tool became a distraction.
						</h3>
						<p class="mt-3 text-sm leading-6 text-muted">
							The Parchment arm called the catalog 28 times even though no case asked the model to
							choose a coffee for sale. Fifteen calls returned nothing, and four answers carried an
							empty result into unrelated market reasoning.
						</p>
					</article>
				</div>

				<div class="mt-10">
					<CoffeeBenchResearchFigures
						{overallResults}
						{historical}
						{liveWeb}
						subjects={benchmark.subjects}
					/>
				</div>
			</section>

			<section id="experiment" class="scroll-mt-36" aria-labelledby="experiment-heading">
				<div class="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.72fr)]">
					<div>
						<p class="text-sm font-semibold text-accent">Experiment</p>
						<h2 id="experiment-heading" class="mt-2 font-serif text-4xl font-medium text-ink">
							One model, four systems around it.
						</h2>
						<p class="mt-5 max-w-3xl leading-7 text-muted">
							Every treatment used the same DeepSeek V4 Flash 0731 FP8 endpoint, case input,
							evidence, temperature, output limit, and provider route. “Purveyors Search” and Pi
							used the same Brave search backend. Their comparison changes the agent runtime and
							system prompt; Purveyors versus Parchment changes only whether the catalog tool is
							exposed.
						</p>
						<p class="mt-4 max-w-3xl leading-7 text-muted">
							Historical-control cases disabled public-web tools. Live-web cases enabled the same
							search and fetch tools for all three harnesses. The Parchment treatment retained its
							frozen catalog snapshot in both cohorts.
						</p>
					</div>
					<div class="rounded-3xl bg-ink p-6 text-on-dark">
						<p class="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
							Fixed model settings
						</p>
						<dl class="mt-5 grid grid-cols-2 gap-5 text-sm">
							<div>
								<dt class="text-on-dark/65">Model</dt>
								<dd class="mt-1 font-medium">DeepSeek V4 Flash 0731</dd>
							</div>
							<div>
								<dt class="text-on-dark/65">Route</dt>
								<dd class="mt-1 font-medium">OpenRouter → DeepInfra FP8</dd>
							</div>
							<div>
								<dt class="text-on-dark/65">Temperature</dt>
								<dd class="mt-1 font-medium">0.4</dd>
							</div>
							<div>
								<dt class="text-on-dark/65">Top-p</dt>
								<dd class="mt-1 font-medium">1.0</dd>
							</div>
							<div>
								<dt class="text-on-dark/65">Output cap</dt>
								<dd class="mt-1 font-medium">4,096 tokens</dd>
							</div>
							<div>
								<dt class="text-on-dark/65">Fallbacks</dt>
								<dd class="mt-1 font-medium">Disabled</dd>
							</div>
						</dl>
					</div>
				</div>

				<div
					class="mt-10 grid gap-px overflow-hidden rounded-3xl bg-line ring-1 ring-line md:grid-cols-2"
				>
					{#each treatmentDetails as treatment}
						<article class="bg-surface-panel p-6">
							<h3 class="text-lg font-semibold text-ink">{treatment.name}</h3>
							<p class="mt-3 text-sm leading-6 text-muted">{treatment.system}</p>
							<p class="mt-2 text-sm leading-6 text-muted">
								<span class="font-medium text-ink">Tools:</span>
								{treatment.tools}
							</p>
						</article>
					{/each}
				</div>
			</section>

			<section id="jury" class="scroll-mt-36" aria-labelledby="jury-heading">
				<div class="max-w-4xl">
					<p class="text-sm font-semibold text-accent">Judge-model voting</p>
					<h2 id="jury-heading" class="mt-2 font-serif text-4xl font-medium text-ink">
						Every matchup, broken down by model family.
					</h2>
					<p class="mt-4 leading-7 text-muted">
						OpenAI, Google, and Anthropic judge agents each voted on every response pair. The bars
						below show their preference shares with ties split evenly; the headline row combines all
						three families. Switch cohorts to inspect all 1,800 pairwise ballots.
					</p>
				</div>
				<div class="mt-8">
					<CoffeeBenchJuryBreakdown slices={benchmark.slices} subjects={benchmark.subjects} />
				</div>
			</section>

			<section id="discussion" class="scroll-mt-36" aria-labelledby="discussion-heading">
				<div class="max-w-4xl">
					<p class="text-sm font-semibold text-accent">Discussion</p>
					<h2 id="discussion-heading" class="mt-2 font-serif text-4xl font-medium text-ink">
						What we think this means, and what we will do with it.
					</h2>
					<p class="mt-5 leading-7 text-muted">
						The most interesting signal is not the narrow rank order. It is that model capability,
						orchestration, and evidence access behave as a system. The raw model answered quickly
						but left too much important content out. The catalog tool supplied legitimate data, but
						the harness exposed it when the data was unrelated to the decision. Better systems
						should make relevant capability easy to reach and irrelevant capability easy to ignore.
					</p>
				</div>

				<div class="mt-10 grid gap-6 lg:grid-cols-3">
					<article class="border-l-2 border-chart-rust pl-5">
						<h3 class="text-lg font-semibold text-ink">Route specialized tools by intent.</h3>
						<p class="mt-2 text-sm leading-6 text-muted">
							The next Parchment arm will expose catalog search for inventory, supplier, price, and
							purchase decisions, then keep it out of unrelated research tasks.
						</p>
					</article>
					<article class="border-l-2 border-chart-teal pl-5">
						<h3 class="text-lg font-semibold text-ink">Isolate the Cherry model.</h3>
						<p class="mt-2 text-sm leading-6 text-muted">
							Cherry should face the current model inside the same prompt, tools, evidence, and
							output contract. That is the clean way to measure specialist-model lift.
						</p>
					</article>
					<article class="border-l-2 border-chart-plum pl-5">
						<h3 class="text-lg font-semibold text-ink">
							Design output for progressive disclosure.
						</h3>
						<p class="mt-2 text-sm leading-6 text-muted">
							We want Cherry to lead with the decision, evidence, and uncertainty, while making
							deeper structured detail available when the calling harness needs it.
						</p>
					</article>
				</div>
			</section>

			<section
				id="methods"
				class="scroll-mt-36 border-t border-line pt-16"
				aria-labelledby="methods-heading"
			>
				<div class="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.72fr)]">
					<div>
						<p class="text-sm font-semibold text-accent">Methods & data</p>
						<h2 id="methods-heading" class="mt-2 font-serif text-4xl font-medium text-ink">
							A frozen suite with three independent views of quality.
						</h2>
						<p class="mt-5 leading-7 text-muted">
							CoffeeBench used 12 historical-control cases and eight live-web cases, with five
							trials per treatment and case. Three judge-model families produced {formatInteger(
								benchmark.methodology.absolute_evaluation_count
							)} absolute rubric evaluations and {formatInteger(
								benchmark.methodology.pairwise_ballot_count
							)} pairwise ballots. We report Bradley–Terry preference, absolute rubric outcomes, and
							operational measurements separately rather than combining them into one score.
						</p>
						<h3 class="mt-8 text-lg font-semibold text-ink">
							Why total cost is only available for Raw
						</h3>
						<p class="mt-3 leading-7 text-muted">
							Model-call cost was captured for every treatment. The published cost field, however,
							requires a complete model-plus-tool total. Brave search and Parchment tool calls did
							not have pinned marginal prices, so tool-using trials cannot support a complete
							end-to-end cost. Raw used no tools and is therefore the only fully priced treatment.
							Exact model-token usage and latency remain comparable in Figure 3; future runs will
							capture tool-inclusive cost directly.
						</p>
						<h3 class="mt-8 text-lg font-semibold text-ink">Interpretation limits</h3>
						<p class="mt-3 leading-7 text-muted">
							V1 studies one model on 20 cases with an agent jury and no human calibration. It
							identifies useful system patterns and concrete follow-up experiments; it does not
							establish a universal model or harness winner, isolate retrieval as the sole cause of
							the Raw gap, or prove that Parchment exposure caused the observed quality result.
						</p>
					</div>

					<aside class="space-y-5">
						<div class="rounded-2xl border border-line bg-surface-panel p-5">
							<h3 class="font-semibold text-ink">Jury coverage</h3>
							<dl class="mt-4 space-y-3 text-sm">
								{#each benchmark.jury as judge (judge.family)}
									<div class="flex items-center justify-between gap-4">
										<dt class="capitalize text-muted">
											{judge.family === 'openai' ? 'OpenAI' : judge.family}
										</dt>
										<dd class="text-right tabular-nums text-ink">
											{formatInteger(judge.call_count)} calls · p50 {formatDuration(
												judge.latency_ms.p50
											)}
										</dd>
									</div>
								{/each}
							</dl>
						</div>

						<a
							href={COFFEEBENCH_RESULT_PATH}
							class="block rounded-2xl bg-ink p-5 text-on-dark transition hover:-translate-y-0.5"
						>
							<p class="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Open data</p>
							<p class="mt-2 font-serif text-xl">Download the aggregate result JSON</p>
							<p class="mt-2 text-sm leading-6 text-on-dark/70">
								Includes every overall and cohort matchup, judge-family split, rubric aggregate,
								token metric, latency, and content digest.
							</p>
						</a>
					</aside>
				</div>

				<details class="mt-10 rounded-2xl border border-line bg-surface-panel p-5">
					<summary class="cursor-pointer font-semibold text-ink">Full aggregate metrics</summary>
					<div class="mt-5 overflow-x-auto">
						<table class="w-full min-w-[68rem] text-left text-sm">
							<caption class="sr-only">CoffeeBench V1 full overall aggregate metrics</caption>
							<thead class="border-b border-line text-xs text-muted">
								<tr>
									<th class="px-3 py-3 font-medium" scope="col">Treatment</th>
									<th class="px-3 py-3 font-medium" scope="col">Quality · 95% interval</th>
									<th class="px-3 py-3 font-medium" scope="col">Strict pass</th>
									<th class="px-3 py-3 font-medium" scope="col">Must-miss</th>
									<th class="px-3 py-3 font-medium" scope="col">Critical</th>
									<th class="px-3 py-3 font-medium" scope="col">Unacceptable</th>
									<th class="px-3 py-3 font-medium" scope="col">Tokens / task</th>
									<th class="px-3 py-3 font-medium" scope="col">Median latency</th>
									<th class="px-3 py-3 font-medium" scope="col">Complete cost / task</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-line">
								{#each overallResults as result (result.subject_id)}
									<tr>
										<th class="px-3 py-3 font-medium text-ink" scope="row"
											>{subjectName(result.subject_id)}</th
										>
										<td class="px-3 py-3 text-ink"
											>#{result.pairwise_quality.rank} · {formatMetric(
												result.pairwise_quality.score,
												3
											)} · {qualityInterval(result)}</td
										>
										<td class="px-3 py-3 text-ink"
											>{formatRate(result.absolute_rubric.strict_all_requirements_pass_rate)}</td
										>
										<td class="px-3 py-3 text-ink"
											>{formatRate(result.absolute_rubric.must_not_miss_failure_rate)}</td
										>
										<td class="px-3 py-3 text-ink"
											>{formatRate(result.absolute_rubric.critical_error_rate)}</td
										>
										<td class="px-3 py-3 text-ink"
											>{formatRate(result.absolute_rubric.unacceptable_response_rate)}</td
										>
										<td class="px-3 py-3 text-ink"
											>{formatTokens(
												result.operational.token_usage.total_tokens.per_attempted_task
											)}</td
										>
										<td class="px-3 py-3 text-ink"
											>{formatDuration(result.operational.latency.end_to_end_ms.p50)}</td
										>
										<td class="px-3 py-3 text-ink"
											>{formatUsd(
												result.operational.cost.normalized_cost_usd.per_attempted_task
											)}</td
										>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</details>

				<details class="mt-4 rounded-2xl border border-line bg-surface-panel p-5">
					<summary class="cursor-pointer font-semibold text-ink"
						>Result identity and provenance</summary
					>
					<dl class="mt-5 grid gap-4 text-sm md:grid-cols-2">
						<div>
							<dt class="text-muted">Result version</dt>
							<dd class="mt-1 break-all text-ink">{benchmark.result_version}</dd>
						</div>
						<div>
							<dt class="text-muted">Status</dt>
							<dd class="mt-1 capitalize text-ink">{benchmark.status}</dd>
						</div>
						<div>
							<dt class="text-muted">Result content SHA-256</dt>
							<dd class="mt-1 break-all font-mono text-xs text-ink">
								{benchmark.identities.result_content_sha256}
							</dd>
						</div>
						<div>
							<dt class="text-muted">Methodology SHA-256</dt>
							<dd class="mt-1 break-all font-mono text-xs text-ink">
								{benchmark.identities.methodology_sha256}
							</dd>
						</div>
						<div>
							<dt class="text-muted">Subject cards SHA-256</dt>
							<dd class="mt-1 break-all font-mono text-xs text-ink">
								{benchmark.identities.subject_cards_sha256}
							</dd>
						</div>
						<div>
							<dt class="text-muted">Scoring contract</dt>
							<dd class="mt-1 text-ink">{benchmark.methodology.scoring_contract}</dd>
						</div>
					</dl>
				</details>
			</section>
		</div>
	</main>
	<Footer />
</div>
